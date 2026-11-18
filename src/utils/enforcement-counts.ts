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
