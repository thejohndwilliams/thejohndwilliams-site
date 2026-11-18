import { describe, it, expect } from 'vitest';
import { wilson, runToCertify } from '../src/utils/wilson';

describe('wilson interval', () => {
  it('matches a known value', () => {
    const [lo, hi] = wilson(119, 124);
    expect(lo).toBeCloseTo(0.9091, 3);
    expect(hi).toBeCloseTo(0.9827, 3);
  });
  it('a 99% lower bound takes 381 consecutive correct decisions', () => {
    expect(runToCertify(0.99)).toBe(381);
  });

  it('n = 0 covers the whole interval', () => {
    expect(wilson(0, 0)).toEqual([0, 1]);
    expect(wilson(5, 0)).toEqual([0, 1]);
  });

  it('all successes pin the upper bound at 1 and keep a lower bound below 1', () => {
    const [lo, hi] = wilson(40, 40);
    expect(hi).toBe(1);
    expect(lo).toBeGreaterThan(0);
    expect(lo).toBeLessThan(1);
  });

  it('all failures pin the lower bound at 0 and keep an upper bound above 0', () => {
    const [lo, hi] = wilson(0, 40);
    expect(lo).toBe(0);
    expect(hi).toBeGreaterThan(0);
    expect(hi).toBeLessThan(1);
  });
});
