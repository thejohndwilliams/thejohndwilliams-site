import { describe, it, expect } from 'vitest';
import { decide, normalize, CASES } from '../src/utils/verification-gate';

const pass = { returned: 'pass' as const, cited: true, downgraded: false };
const soft = { returned: 'pass' as const, cited: false, downgraded: false };
const fail = { returned: 'fail' as const, cited: false, downgraded: false };
const prose = { returned: 'prose' as const, cited: false, downgraded: false };
const none = { returned: 'none' as const, cited: false, downgraded: false };

// Mirrors tri_fleet_gate.py's normalize and decide steps (2026-11-24).
describe('verification gate decision rule', () => {
  it('a pass with no cited evidence is demoted to a fail', () => {
    expect(normalize(soft).verdict).toBe('FAIL');
    expect(normalize(pass).verdict).toBe('PASS');
  });
  it('prose is a fail; no answer is unusable', () => {
    expect(normalize(prose)).toMatchObject({ ok: true, verdict: 'FAIL' });
    expect(normalize(none)).toMatchObject({ ok: false, verdict: 'FAIL' });
  });
  it('strict: only two cited passes go through', () => {
    expect(decide([pass, pass], 'strict').decision).toBe('PASS');
    expect(decide([pass, soft], 'strict').decision).toBe('BLOCKED');
    expect(decide([pass, fail], 'strict').decision).toBe('BLOCKED');
  });
  it('standard: one pass carries it, dissent is recorded, disagreement is a caveat', () => {
    const d = decide([pass, fail], 'standard');
    expect(d.decision).toBe('PASS');
    expect(d.caveats.some((c) => c.startsWith('Dissent'))).toBe(true);
    expect(d.caveats.some((c) => c.includes('never average'))).toBe(true);
    expect(decide([fail, fail], 'standard').decision).toBe('BLOCKED');
  });
  it('a downgraded model voids the review at any severity', () => {
    expect(decide([pass, { ...pass, downgraded: true }], 'standard').decision).toBe('BLOCKED');
  });
  it('fewer than two usable reviewers blocks unless single review is allowed', () => {
    expect(decide([pass, none], 'standard').decision).toBe('BLOCKED');
    expect(decide([pass, none], 'standard', true).decision).toBe('PASS');
  });
  it('the published worked cases resolve as the page states', () => {
    expect(CASES.map((c) => decide([c.a, c.b], c.severity).decision)).toEqual(['PASS', 'BLOCKED', 'BLOCKED', 'BLOCKED', 'PASS', 'BLOCKED']);
  });
});
