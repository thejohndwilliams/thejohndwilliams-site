/** Integer band counts. Scores may be rounded for storage; counts are
 *  taken after that rounding so the three bands always partition the split. */

export type Bands = {
  auto_tp: number;
  auto_fp: number;
  review_spam: number;
  review_ham: number;
  allow_spam: number;
  allow_ham: number;
};

export function countsFromPoints(
  points: ReadonlyArray<readonly [number, number]>,
  auto: number,
  floor: number,
): Bands {
  const c: Bands = {
    auto_tp: 0,
    auto_fp: 0,
    review_spam: 0,
    review_ham: 0,
    allow_spam: 0,
    allow_ham: 0,
  };
  for (const [s, y] of points) {
    const spam = y === 1;
    if (s >= auto) {
      if (spam) c.auto_tp += 1;
      else c.auto_fp += 1;
    } else if (s >= floor) {
      if (spam) c.review_spam += 1;
      else c.review_ham += 1;
    } else if (spam) c.allow_spam += 1;
    else c.allow_ham += 1;
  }
  return c;
}

export function bandTotal(c: Bands): number {
  return c.auto_tp + c.auto_fp + c.review_spam + c.review_ham + c.allow_spam + c.allow_ham;
}

export function indexAtLeast(points: ReadonlyArray<readonly [number, number]>, threshold: number): number {
  let lo = 0;
  let hi = points.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] < threshold) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function scoreLabel(points: ReadonlyArray<readonly [number, number]>, idx: number): string {
  if (points.length === 0) return 'unavailable';
  if (idx >= points.length) return '1.000';
  const score = points[idx]?.[0];
  if (!(typeof score === 'number') || !(score >= 0)) return 'unavailable';
  return score.toFixed(3);
}

function spamBetween(points: ReadonlyArray<readonly [number, number]>, from: number, to: number): number {
  let n = 0;
  for (let i = from; i < to; i++) if (points[i][1] === 1) n += 1;
  return n;
}

/** Accessible value of the two sliders at a pair of boundary indexes. */
export function sliderText(
  points: ReadonlyArray<readonly [number, number]>,
  autoIdx: number,
  reviewIdx: number,
): { autoNow: number; reviewNow: number; autoText: string; reviewText: string } {
  const n = points.length;
  const autoN = n - autoIdx;
  const autoTp = spamBetween(points, autoIdx, n);
  const reviewN = autoIdx - reviewIdx;
  const missed = spamBetween(points, 0, reviewIdx);
  return {
    autoNow: autoIdx,
    reviewNow: reviewIdx,
    autoText: autoValueText(scoreLabel(points, autoIdx), autoTp, autoN, autoN - autoTp),
    reviewText: reviewValueText(scoreLabel(points, reviewIdx), reviewN, missed),
  };
}

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

/** Accessible value for the auto-action slider. Zero actions are named,
 *  never reported as 100% or NaN%. */
export function autoValueText(score: string, tp: number, n: number, fp: number): string {
  if (!(n > 0)) return `Auto-action gate at score ${score}. No automatic actions.`;
  return `Auto-action gate at score ${score}. Precision ${pct(tp / n)}. ${fp} wrongly removed.`;
}

export function reviewValueText(score: string, reviewN: number, missed: number): string {
  return `Review floor at score ${score}. ${reviewN} in review. ${missed} missed.`;
}

export function caughtText(caught: number, spam: number): string {
  if (!(spam > 0)) return 'No spam in this sample';
  return `${pct(caught / spam)} caught overall`;
}

export function liveSummary(tp: number, n: number, reviewN: number, missed: number, fp: number): string {
  if (!(n > 0)) return `No automatic actions. ${reviewN} in review. ${missed} missed.`;
  return `Precision ${pct(tp / n)}. ${reviewN} in review. ${missed} missed. ${fp} wrongly removed.`;
}
