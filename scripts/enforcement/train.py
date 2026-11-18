"""Precision-gated enforcement sample: train, set gates, measure.

Public data only: the UCI SMS Spam Collection (Almeida, Gomez Hidalgo,
Yamakami 2011; CC BY 4.0). No personal or employer data is used.

    python3 scripts/enforcement/train.py /path/to/SMSSpamCollection

Writes src/data/enforcement-sample.json, which the /work/enforcement-gates/
page reads at build time. Method:
  1. Drop exact duplicate texts (spam is heavily duplicated; leaving copies
     across splits would flatter every number).
  2. Stratified split: 60% train, 20% calibration, 20% test (seed 7).
  3. TF-IDF word 1-2 grams + char 3-5 grams, logistic regression.
  4. Gates are chosen on calibration only:
       auto-action: lowest score where calibration precision >= 0.99
       review floor: highest score keeping auto + review recall >= 0.98
  5. Everything published is measured on the untouched test split.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from scipy.sparse import hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split

SEED = 7
OUT = Path(__file__).resolve().parents[2] / 'src' / 'data' / 'enforcement-sample.json'


def load(path):
    rows = []
    for line in Path(path).read_text(encoding='utf-8', errors='replace').splitlines():
        label, _, text = line.partition('\t')
        if label in ('ham', 'spam') and text:
            rows.append((text.strip(), 1 if label == 'spam' else 0))
    return rows


def wilson(k, n, z=1.96):
    if n == 0:
        return (0.0, 1.0)
    p = k / n
    d = 1 + z * z / n
    c = p + z * z / (2 * n)
    m = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return ((c - m) / d, (c + m) / d)


def band_counts(scores, y, auto, floor):
    act = scores >= auto
    rev = (scores >= floor) & ~act
    allow = scores < floor
    return {
        'auto_tp': int((act & (y == 1)).sum()), 'auto_fp': int((act & (y == 0)).sum()),
        'review_spam': int((rev & (y == 1)).sum()), 'review_ham': int((rev & (y == 0)).sum()),
        'allow_spam': int((allow & (y == 1)).sum()), 'allow_ham': int((allow & (y == 0)).sum()),
    }


def choose_gates(scores, labels):
    """Return (auto, floor) or None when no threshold reaches the rules."""
    order = np.sort(np.unique(scores))
    if order.size == 0:
        return None
    auto = None
    for t in order:
        act = scores >= t
        n_act = int(np.asarray(act).sum())
        if n_act == 0:
            continue
        if float((labels[act] == 1).sum()) / n_act >= 0.99:
            auto = float(t)
            break
    if auto is None:
        return None
    total_spam = int((labels == 1).sum())
    if total_spam <= 0:
        return None
    floor = None
    for t in order[::-1]:
        tv = float(t)
        if tv > auto:
            continue
        caught = int(((scores >= t) & (labels == 1)).sum())
        if caught / total_spam >= 0.98:
            floor = tv
            break
    if floor is None:
        floor = float(order[0])
    if floor > auto:
        floor = auto
    return auto, floor


def main(src):
    path = Path(src)
    if not path.is_file():
        print(f'No input file at {path}. Nothing was written.', file=sys.stderr)
        return 1
    raw = load(path)
    if not raw:
        print('No labelled messages in the input. Nothing was written.', file=sys.stderr)
        return 1
    seen, rows = set(), []
    for text, label in raw:
        if text in seen:
            continue
        seen.add(text)
        rows.append((text, label))
    texts = np.array([t for t, _ in rows], dtype=object)
    y = np.array([l for _, l in rows])

    x_tr, x_rest, y_tr, y_rest = train_test_split(texts, y, test_size=0.4, stratify=y, random_state=SEED)
    x_cal, x_te, y_cal, y_te = train_test_split(x_rest, y_rest, test_size=0.5, stratify=y_rest, random_state=SEED)

    word = TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True, lowercase=True)
    char = TfidfVectorizer(analyzer='char_wb', ngram_range=(3, 5), min_df=2, sublinear_tf=True, lowercase=True)
    xt = hstack([word.fit_transform(x_tr), char.fit_transform(x_tr)]).tocsr()
    clf = LogisticRegression(C=8.0, max_iter=4000, random_state=SEED)
    clf.fit(xt, y_tr)

    def score(x):
        return clf.predict_proba(hstack([word.transform(x), char.transform(x)]).tocsr())[:, 1]

    s_cal, s_te = score(x_cal), score(x_te)

    # Gates and counts use the same 6-decimal scores the page stores.
    s_cal_r = np.round(np.asarray(s_cal, dtype=float), 6)
    s_te_r = np.round(np.asarray(s_te, dtype=float), 6)
    picked = choose_gates(s_cal_r, y_cal)
    if picked is None:
        print('No gate qualifies: no calibration threshold reached precision 0.99. Nothing was written.', file=sys.stderr)
        return 1
    auto, floor = picked
    auto_r = round(float(auto), 6)
    floor_r = round(float(floor), 6)
    if floor_r > auto_r:
        floor_r = auto_r
    act = s_cal_r >= auto_r
    n_act = int(np.asarray(act).sum())
    precision = (float((y_cal[act] == 1).sum()) / n_act) if n_act else 0.0
    if n_act == 0 or precision < 0.99:
        print(f'Rounded auto gate does not meet precision 0.99 (got {precision:.4f} on {n_act}). Nothing was written.', file=sys.stderr)
        return 1
    cal = band_counts(s_cal_r, y_cal, auto_r, floor_r)
    te = band_counts(s_te_r, y_te, auto_r, floor_r)
    for name, counts, expected in (('calibration', cal, len(y_cal)), ('test', te, len(y_te))):
        total = sum(counts.values())
        if total != int(expected):
            print(f'{name} counts sum to {total}, expected {expected}. Nothing was written.', file=sys.stderr)
            return 1
    k, n = te['auto_tp'], te['auto_tp'] + te['auto_fp']
    lo, hi = wilson(k, n)

    pts = sorted(zip(s_te_r.tolist(), y_te.tolist()))
    out = {
        'meta': {
            'dataset': 'UCI SMS Spam Collection',
            'license': 'CC BY 4.0',
            'citation': 'Almeida, Gomez Hidalgo and Yamakami, 2011',
            'messages_raw': len(raw),
            'messages_unique': len(rows),
            'spam_unique': int(y.sum()),
            'split': {'train': len(y_tr), 'calibration': len(y_cal), 'test': len(y_te)},
            'test_spam': int(y_te.sum()),
            'model': 'TF-IDF word 1-2 grams and character 3-5 grams, logistic regression',
            'seed': SEED,
        },
        'gates': {'auto': auto_r, 'review': floor_r,
                  'rule_auto': 'lowest score with calibration precision at or above 0.99',
                  'rule_review': 'highest floor keeping auto plus review recall at or above 0.98'},
        'calibration': cal,
        'test': te,
        'test_auto_precision_wilson': [round(lo, 4), round(hi, 4)],
        'points': [[round(s, 6), int(l)] for s, l in pts],
    }
    OUT.write_text(json.dumps(out, separators=(',', ':')))
    print(json.dumps({k: v for k, v in out.items() if k != 'points'}, indent=1))
    return 0


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python3 scripts/enforcement/train.py /path/to/SMSSpamCollection', file=sys.stderr)
        raise SystemExit(2)
    raise SystemExit(main(sys.argv[1]))
