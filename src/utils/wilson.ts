/** Wilson score interval for a binomial proportion (95% by default).
 *  Used by the enforcement-gates case study to state what a sample of
 *  decisions can and cannot certify. */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n <= 0) return [0, 1];
  const p = k / n;
  const z2 = z * z;
  const d = 1 + z2 / n;
  const c = p + z2 / (2 * n);
  const m = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)];
}

/** Smallest run of consecutive correct decisions whose Wilson lower bound
 *  reaches `target`. */
export function runToCertify(target: number, z = 1.96): number {
  let n = 1;
  while (wilson(n, n, z)[0] < target && n < 100000) n += 1;
  return n;
}
