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
});
