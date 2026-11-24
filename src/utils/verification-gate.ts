/**
 * The decision rule of the verification gate, as published on
 * /work/verification-gate/. A faithful port of the decide step in John's
 * tri_fleet_gate.py (personal tooling, not public): the page's figure and its
 * static table both run this, so what the reader sees is the rule itself,
 * not a description of it.
 *
 * Input per reviewer: what came back (a schema verdict, prose, or nothing),
 * whether a PASS cited raw evidence, and whether the vendor served a
 * weaker model than the one requested.
 */

export type Returned = 'pass' | 'fail' | 'prose' | 'none';
export type Severity = 'strict' | 'standard';

export interface ReviewerInput {
  returned: Returned;
  /** Only read when returned === 'pass'. */
  cited: boolean;
  downgraded: boolean;
}

export interface Normalized {
  ok: boolean;
  verdict: 'PASS' | 'FAIL';
  gaps: string[];
}

export interface Decision {
  decision: 'PASS' | 'BLOCKED';
  blockers: string[];
  caveats: string[];
  verdicts: Array<'PASS' | 'FAIL'>;
}

/** Anything unparseable or hedged is a FAIL. A PASS with no cited evidence is demoted. */
export function normalize(r: ReviewerInput): Normalized {
  if (r.returned === 'none') return { ok: false, verdict: 'FAIL', gaps: ['returned no usable result'] };
  if (r.returned === 'prose') return { ok: true, verdict: 'FAIL', gaps: ['answered in prose, not a binary verdict'] };
  if (r.returned === 'fail') return { ok: true, verdict: 'FAIL', gaps: ['named a gap in the evidence'] };
  if (!r.cited) return { ok: true, verdict: 'FAIL', gaps: ['passed without citing evidence, so the pass is demoted'] };
  return { ok: true, verdict: 'PASS', gaps: [] };
}

export function decide(inputs: ReviewerInput[], severity: Severity, allowSingle = false): Decision {
  const names = inputs.map((_, i) => `Reviewer ${String.fromCharCode(65 + i)}`);
  const ns = inputs.map(normalize);
  const blockers: string[] = [];
  const caveats: string[] = [];

  ns.forEach((n, i) => {
    if (inputs[i].downgraded) blockers.push(`${names[i]} was served a weaker model than requested, so its review is void`);
    if (n.verdict === 'FAIL') {
      for (const g of n.gaps) (severity === 'strict' ? blockers : caveats).push(
        severity === 'strict' ? `${names[i]} ${g}` : `Dissent: ${names[i]} ${g}`,
      );
    }
  });

  if (severity === 'standard' && !ns.some((n) => n.verdict === 'PASS')) {
    blockers.push('Routine claim, and no reviewer passed it');
  }

  const usable = ns.filter((n) => n.ok).length;
  if (usable < ns.length) {
    const msg = `Only ${usable} of ${ns.length} reviewers returned a usable result`;
    if (allowSingle && usable === 1) caveats.push(`Single review: ${msg.toLowerCase()}`);
    else blockers.push(msg);
  }

  const verdicts = ns.map((n) => n.verdict);
  if (new Set(verdicts).size > 1) {
    const msg = 'The reviewers disagree. Investigate the disputed item; never average the verdicts';
    (severity === 'strict' ? blockers : caveats).push(msg);
  }

  return { decision: blockers.length ? 'BLOCKED' : 'PASS', blockers, caveats, verdicts };
}

/** Worked cases for the page's static table (and the no-script reader). */
export const CASES: Array<{ label: string; severity: Severity; a: ReviewerInput; b: ReviewerInput }> = [
  { label: 'Both pass and cite the evidence', severity: 'strict', a: { returned: 'pass', cited: true, downgraded: false }, b: { returned: 'pass', cited: true, downgraded: false } },
  { label: 'One passes without citing anything', severity: 'strict', a: { returned: 'pass', cited: true, downgraded: false }, b: { returned: 'pass', cited: false, downgraded: false } },
  { label: 'One answers in prose', severity: 'strict', a: { returned: 'pass', cited: true, downgraded: false }, b: { returned: 'prose', cited: false, downgraded: false } },
  { label: 'They disagree on a consequential claim', severity: 'strict', a: { returned: 'pass', cited: true, downgraded: false }, b: { returned: 'fail', cited: false, downgraded: false } },
  { label: 'They disagree on a routine claim', severity: 'standard', a: { returned: 'pass', cited: true, downgraded: false }, b: { returned: 'fail', cited: false, downgraded: false } },
  { label: 'A vendor served a weaker model', severity: 'standard', a: { returned: 'pass', cited: true, downgraded: false }, b: { returned: 'pass', cited: true, downgraded: true } },
];
