// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sample from '../src/data/enforcement-sample.json';
import { bandTotal, countsFromPoints, autoValueText, caughtText, liveSummary } from '../src/utils/enforcement-counts';
import { clampLabelCenter, plotGeometry } from '../src/utils/enforcement-layout';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

describe('enforcement counts', () => {
  const points = sample.points as [number, number][];

  it('partitions the plotted points into integers that sum to the test split', () => {
    const counts = countsFromPoints(points, sample.gates.auto, sample.gates.review);
    expect(bandTotal(counts)).toBe(points.length);
    expect(bandTotal(counts)).toBe(sample.meta.split.test);
    expect(counts).toEqual(sample.test);
    expect(counts.auto_tp + counts.review_spam + counts.allow_spam).toBe(sample.meta.test_spam);
  });

  it('clamps a band label so it cannot extend past the plot', () => {
    const center = clampLabelCenter(380, 370, 390, 92, 390);
    expect(center + 46).toBeLessThanOrEqual(390);
    expect(center - 46).toBeGreaterThanOrEqual(0);
  });

  it('reserves a non-zero figure at the server viewBox width', () => {
    const frame = plotGeometry(points, 640);
    expect(frame.W).toBe(640);
    expect(frame.H).toBe(205);
  });
});

describe('enforcement readout at zero actions', () => {
  it('does not report 100% or NaN% when the auto band is empty', () => {
    const text = autoValueText('1.000', 0, 0, 0);
    expect(text).toContain('No automatic actions');
    expect(text).not.toContain('100%');
    expect(text).not.toContain('NaN');
    expect(liveSummary(0, 0, 4, 2, 0)).not.toMatch(/100%|NaN/);
    expect(caughtText(0, 0)).toBe('No spam in this sample');
    expect(caughtText(3, 10)).not.toContain('NaN');
  });
});

describe('enforcement source locks', () => {
  const script = read('src/scripts/enforcement-gates.ts');
  const css = read('src/styles/enforcement-gates.css');
  const page = read('src/pages/work/enforcement-gates.astro');

  it('moves handles with custom properties, not inline transforms', () => {
    expect(script).not.toContain('style.transform');
    expect(script).not.toContain("setAttribute('style'");
    expect(script).not.toContain('setAttribute("style"');
    expect(script).not.toContain('style.cssText');
    expect(script).toContain("setProperty('--hf'");
    expect(script).toContain("setProperty('--lf'");
    expect(css).toContain('overflow-x: clip');
    expect(css).toContain('min-height: 62svh');
    expect(css).toContain('min-height: 62vh');
    expect(page).not.toMatch(/\sstyle="/);
    expect(page).not.toContain('\u2014');
  });
});
