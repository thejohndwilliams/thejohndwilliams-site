"""Synthetic public-post signal triage and outage-detection benchmark.

Generates a deterministic 720-post synthetic stream across 36 five-minute
windows (01:15 to 04:10 UTC) and evaluates cumulative Boolean/proximity
query gates plus a two-window multi-region burst rule.

All posts are synthetic benchmark fixtures modeled on public app and
cloud disruption chatter. No personal, customer, platform or employer data
is used.

    python3 scripts/signals/evaluate.py

Writes src/data/signal-triage.json and prints summary metrics + SHA-256.
"""
import hashlib
import json
import math
import random
from pathlib import Path

SEED = 11
WINDOWS = 36
WINDOW_MINUTES = 5
FAULT_WINDOW = 12       # 02:15 UTC: regional outage begins
STATUS_ACK_WINDOW = 19  # 02:50 UTC: public status page acknowledges outage
PREC_GATE = 0.90
RECALL_GATE = 0.80
BURST_MIN_COUNT = 5
BURST_MIN_REGIONS = 2

OUT = Path(__file__).resolve().parents[2] / 'src' / 'data' / 'signal-triage.json'


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if n == 0:
        return (0.0, 1.0)
    p = k / n
    d = 1 + z * z / n
    c = p + z * z / (2 * n)
    m = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return (max(0.0, (c - m) / d), min(1.0, (c + m) / d))


def hhmm(window_idx: int) -> str:
    total_min = 75 + window_idx * WINDOW_MINUTES  # 01:15 UTC start
    h = (total_min // 60) % 24
    m = total_min % 60
    return f'{h:02d}:{m:02d}'


def generate_stream(rng: random.Random) -> list[list[int]]:
    """Return rows of [win, label, anchor, prox, excl, corr, dedup, region].

    Flags are independent per-clause pass indicators (1 = passes that clause,
    0 = filtered out by that clause) for posts that hit the base anchor rule.
    region: 0 = none/unknown, 1 = North corridor, 2 = Central metro, 3 = Coast.
    """
    rows: list[list[int]] = []

    # Per-window true disruption report counts (total = 96 across 36 windows).
    # Trickle of isolated local drops pre-fault (windows 0..11: 4 total),
    # sharp ramp after 02:15 UTC fault (window 12+), tapering after 03:35 UTC.
    signal_schedule = [
        0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,   # 01:15 - 02:10 (4 isolated)
        3, 5, 6, 8, 9, 10, 9, 8, 7, 6, 5, 4,  # 02:15 - 03:10 (80 fault core)
        3, 2, 2, 1, 1, 1, 1, 1, 0, 0, 0, 0,   # 03:15 - 04:10 (12 tail)
    ]
    assert sum(signal_schedule) == 96

    for w in range(WINDOWS):
        n_sig = signal_schedule[w]
        for i in range(n_sig):
            # True signals almost always pass proximity/exclusions/dedup;
            # a small realistic fraction omit explicit region/symptom tokens
            # or use vague wording, creating honest recall cost (~88.5%).
            prox = 1 if rng.random() < 0.97 else 0
            excl = 1 if rng.random() < 0.98 else 0
            corr = 1 if rng.random() < 0.92 else 0
            dedup = 1 if rng.random() < 0.99 else 0
            region = (i % 3) + 1 if w >= FAULT_WINDOW else 1
            rows.append([w, 1, 1, prox, excl, corr, dedup, region])

        # Background noise & confounders in this window (target total 720 posts).
        # Base chatter + two pre-fault confounder spikes:
        #   Window 5 (01:40 UTC): scheduled maintenance announcements
        #   Window 9 (02:00 UTC): copy-pasted bot spam burst
        base_noise = 14
        if w in (4, 5):
            base_noise += 8   # maintenance chatter across two windows
        elif w in (8, 9):
            base_noise += 8   # coordinated copy-paste burst across two windows
        elif FAULT_WINDOW <= w <= 22:
            base_noise += 6   # secondary news/commentary echo during event

        for j in range(base_noise):
            # Non-anchor background posts vs anchor-hitting confounders:
            if w in (4, 5) and j >= 14:
                # Scheduled maintenance posts: hit anchor + proximity + corr, fail exclusions
                rows.append([w, 0, 1, 1, 0, 1, 1, (j % 2) + 1])
            elif w in (8, 9) and j >= 14:
                # Coordinated copy-paste spam mimicking real symptom wording:
                # passes prox + excl + corr lexically, defeated only by shingle dedup.
                is_first = 1 if (w == 8 and j == 14) else 0
                rows.append([w, 0, 1, 1, 1, 1, is_first, (j % 3) + 1])
            elif FAULT_WINDOW <= w <= 22 and j >= 14:
                # Secondary echo / headline reshares during outage: hit anchor + prox + excl,
                # fail first-hand corroboration (except rare borderline leak).
                corr_leak = 1 if (w in (16, 19) and j == 14) else 0
                rows.append([w, 0, 1, 1, 1, corr_leak, 1, (j % 3) + 1])
            else:
                roll = rng.random()
                if roll < 0.62:
                    # Ordinary chatter that does not even hit anchor keywords
                    rows.append([w, 0, 0, 0, 1, 0, 1, 0])
                elif roll < 0.84:
                    # Idiom confounder ("calm down", "offline for the night"): fails proximity
                    rows.append([w, 0, 1, 0, 1, 0, 1, 0])
                elif roll < 0.94:
                    # Gaming lobby / patch chatter: passes proximity, fails exclusions
                    rows.append([w, 0, 1, 1, 0, 0, 1, 1])
                elif roll < 0.992:
                    # Vague link reshare: passes prox + excl, fails corroboration
                    rows.append([w, 0, 1, 1, 1, 0, 1, 1])
                else:
                    # Residual false positive surviving all four lexical gates
                    rows.append([w, 0, 1, 1, 1, 1, 1, 1])

    # Pad or trim background non-anchor chatter in final window so stream is exact 720.
    while len(rows) < 720:
        rows.append([WINDOWS - 1, 0, 0, 0, 1, 0, 1, 0])
    return rows[:720]


def evaluate(rows: list[list[int]], prox: bool, excl: bool, corr: bool, dedup: bool) -> dict:
    tp = fp = fn = tn = 0
    win_counts = [0] * WINDOWS
    win_true = [0] * WINDOWS
    win_regions: list[set[int]] = [set() for _ in range(WINDOWS)]

    for w, label, anchor, p_ok, e_ok, c_ok, d_ok, reg in rows:
        if label == 1:
            win_true[w] += 1
        matched = (
            anchor == 1
            and (not prox or p_ok == 1)
            and (not excl or e_ok == 1)
            and (not corr or c_ok == 1)
            and (not dedup or d_ok == 1)
        )
        if matched:
            win_counts[w] += 1
            if reg > 0:
                win_regions[w].add(reg)
            if label == 1:
                tp += 1
            else:
                fp += 1
        else:
            if label == 1:
                fn += 1
            else:
                tn += 1

    n_matched = tp + fp
    n_sig = tp + fn
    prec = tp / n_matched if n_matched else 0.0
    rec = tp / n_sig if n_sig else 0.0
    ci_lo, ci_hi = wilson(tp, n_matched)

    # Burst rule: >= BURST_MIN_COUNT matched posts in each of 2 consecutive windows,
    # spanning >= BURST_MIN_REGIONS distinct regions across the pair.
    pre_fault_alarms = 0
    detect_window = None
    for w in range(1, WINDOWS):
        combined_regions = win_regions[w - 1] | win_regions[w]
        fired = (
            win_counts[w - 1] >= BURST_MIN_COUNT
            and win_counts[w] >= BURST_MIN_COUNT
            and len(combined_regions) >= BURST_MIN_REGIONS
        )
        if fired:
            if w < FAULT_WINDOW:
                pre_fault_alarms += 1
            elif detect_window is None:
                detect_window = w

    lead_minutes = (
        (STATUS_ACK_WINDOW - detect_window) * WINDOW_MINUTES
        if detect_window is not None
        else None
    )

    return {
        'tp': tp,
        'fp': fp,
        'fn': fn,
        'tn': tn,
        'precision': round(prec, 4),
        'recall': round(rec, 4),
        'wilson': [round(ci_lo, 4), round(ci_hi, 4)],
        'ships': bool(prec >= PREC_GATE and rec >= RECALL_GATE),
        'pre_fault_alarms': pre_fault_alarms,
        'detect_window': detect_window,
        'detect_time': hhmm(detect_window) if detect_window is not None else None,
        'lead_minutes': lead_minutes,
        'win_counts': win_counts,
        'win_true': win_true,
    }


SPECIMENS = [
    {
        'id': 's1',
        'time': '01:42 UTC',
        'region': 'North',
        'text': 'Scheduled maintenance window 01:00 to 03:00 UTC; the app may be offline briefly.',
        'label': 0,
        'note': 'Planned work',
        'flags': {'prox': 1, 'excl': 0, 'corr': 1, 'dedup': 1},
    },
    {
        'id': 's2',
        'time': '01:51 UTC',
        'region': 'None',
        'text': 'Phone battery died on the train, going offline for the night.',
        'label': 0,
        'note': 'Casual idiom',
        'flags': {'prox': 0, 'excl': 1, 'corr': 0, 'dedup': 1},
    },
    {
        'id': 's3',
        'time': '02:01 UTC',
        'region': 'Central',
        'text': 'App offline for me in the Central region, login keeps failing; claim your outage credit now [15 identical copies]',
        'label': 0,
        'note': 'Coordinated spam',
        'flags': {'prox': 1, 'excl': 1, 'corr': 1, 'dedup': 0},
    },
    {
        'id': 's4',
        'time': '02:18 UTC',
        'region': 'Central',
        'text': 'Checkout offline at our Central region store; every card payment times out and login returns error 502.',
        'label': 1,
        'note': 'Witness signal',
        'flags': {'prox': 1, 'excl': 1, 'corr': 1, 'dedup': 1},
    },
    {
        'id': 's5',
        'time': '02:23 UTC',
        'region': 'Coast',
        'text': 'App will not load and payments time out at both of our Gulf region shops since 02:16 UTC.',
        'label': 1,
        'note': 'Witness signal',
        'flags': {'prox': 1, 'excl': 1, 'corr': 1, 'dedup': 1},
    },
    {
        'id': 's6',
        'time': '02:34 UTC',
        'region': 'Central',
        'text': 'Repost: thread on why big apps keep having outages every quarter.',
        'label': 0,
        'note': 'Commentary echo',
        'flags': {'prox': 1, 'excl': 1, 'corr': 0, 'dedup': 1},
    },
]


def main() -> int:
    rng = random.Random(SEED)
    rows = generate_stream(rng)

    stages_spec = [
        ('Anchor keywords only', False, False, False, False),
        ('+ Proximity (NEAR/6)', True, False, False, False),
        ('+ Negative exclusions', True, True, False, False),
        ('+ First-hand corroboration', True, True, True, False),
        ('+ Shingle deduplication', True, True, True, True),
    ]
    stages = []
    for label, pr, ex, co, de in stages_spec:
        res = evaluate(rows, pr, ex, co, de)
        stages.append({
            'label': label,
            'clauses': {'prox': pr, 'excl': ex, 'corr': co, 'dedup': de},
            'tp': res['tp'],
            'fp': res['fp'],
            'precision': res['precision'],
            'recall': res['recall'],
            'wilson': res['wilson'],
            'ships': res['ships'],
            'pre_fault_alarms': res['pre_fault_alarms'],
            'detect_time': res['detect_time'],
            'lead_minutes': res['lead_minutes'],
        })

    ungated = evaluate(rows, False, False, False, False)
    gated = evaluate(rows, True, True, True, True)
    assert gated['ships'], f'Full gate did not meet target: {gated}'
    assert gated['pre_fault_alarms'] == 0, f'Expected 0 pre-fault alarms: {gated}'
    assert gated['lead_minutes'] is not None and gated['lead_minutes'] >= 20, f'Expected early warning: {gated}'

    payload = {
        'meta': {
            'dataset': 'Synthetic public-post disruption stream',
            'scope': 'Personal project, synthetic benchmark',
            'posts_total': len(rows),
            'signal_total': sum(r[1] for r in rows),
            'windows': WINDOWS,
            'window_minutes': WINDOW_MINUTES,
            'start_utc': hhmm(0),
            'end_utc': hhmm(WINDOWS - 1),
            'fault_window': FAULT_WINDOW,
            'fault_utc': hhmm(FAULT_WINDOW),
            'status_ack_window': STATUS_ACK_WINDOW,
            'status_ack_utc': hhmm(STATUS_ACK_WINDOW),
            'precision_gate': PREC_GATE,
            'recall_gate': RECALL_GATE,
            'burst_min_count': BURST_MIN_COUNT,
            'burst_min_regions': BURST_MIN_REGIONS,
            'seed': SEED,
        },
        'stages': stages,
        'ungated_series': ungated['win_counts'],
        'gated_series': gated['win_counts'],
        'specimens': SPECIMENS,
        'rows': rows,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(payload, separators=(',', ':'))
    OUT.write_text(serialized + '\n', encoding='utf-8')
    digest = hashlib.sha256((serialized + '\n').encode('utf-8')).hexdigest()
    print(json.dumps({'sha256': digest, 'stages': stages}, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
