// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import benchmark from '../src/data/signal-triage.json';
import {
  evaluateStream,
  specimenVerdict,
  type SpecimenPost,
  type StreamMeta,
  type StreamRow,
} from '../src/utils/signal-triage';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const sha256 = (rel: string) =>
  createHash('sha256').update(readFileSync(join(process.cwd(), rel))).digest('hex');

describe('signal triage evaluation engine', () => {
  const rows = benchmark.rows as unknown as StreamRow[];
  const meta = benchmark.meta as StreamMeta;

  it('reproduces every Python benchmark stage to four decimals', () => {
    for (const stage of benchmark.stages) {
      const res = evaluateStream(rows, meta, stage.clauses);
      expect(res.tp, `${stage.label} tp`).toBe(stage.tp);
      expect(res.fp, `${stage.label} fp`).toBe(stage.fp);
      expect(Number(res.precision.toFixed(4)), `${stage.label} precision`).toBe(stage.precision);
      expect(Number(res.recall.toFixed(4)), `${stage.label} recall`).toBe(stage.recall);
      expect(res.wilson.map((v) => Number(v.toFixed(4))), `${stage.label} wilson`).toEqual(stage.wilson);
      expect(res.ships, `${stage.label} ships`).toBe(stage.ships);
      expect(res.preFaultAlarms, `${stage.label} preFaultAlarms`).toBe(stage.pre_fault_alarms);
      expect(res.leadMinutes, `${stage.label} leadMinutes`).toBe(stage.lead_minutes);
    }
  });

  it('blocks when shingle deduplication is disabled because coordinated spam trips a pre-fault alarm', () => {
    const withoutDedup = evaluateStream(rows, meta, { prox: true, excl: true, corr: true, dedup: false });
    expect(withoutDedup.ships).toBe(false);
    expect(withoutDedup.precision).toBeLessThan(meta.precision_gate);
    expect(withoutDedup.preFaultAlarms).toBeGreaterThan(0);

    const full = evaluateStream(rows, meta, { prox: true, excl: true, corr: true, dedup: true });
    expect(full.ships).toBe(true);
    expect(full.precision).toBeGreaterThanOrEqual(meta.precision_gate);
    expect(full.recall).toBeGreaterThanOrEqual(meta.recall_gate);
    expect(full.preFaultAlarms).toBe(0);
    expect(full.leadMinutes).toBe(25);
  });

  it('classifies specimen posts accurately under gated vs ungated clauses', () => {
    const specimens = benchmark.specimens as SpecimenPost[];
    const gated = { prox: true, excl: true, corr: true, dedup: true };
    const ungated = { prox: false, excl: false, corr: false, dedup: false };
    for (const sp of specimens) {
      const vg = specimenVerdict(sp, gated);
      if (sp.label === 1) expect(vg.kind).toBe('captured');
      else expect(vg.kind).toBe('filtered');

      const vu = specimenVerdict(sp, ungated);
      if (sp.label === 0) expect(vu.kind).toBe('false-alarm');
    }
  });

  it('chain-of-custody SHA-256 digests match the published provenance strings', () => {
    const sigPage = read('src/pages/work/signal-triage.astro');
    const enfPage = read('src/pages/work/enforcement-gates.astro');
    expect(sigPage).toContain(sha256('src/data/signal-triage.json'));
    expect(enfPage).toContain(sha256('src/data/enforcement-sample.json'));
    expect(sigPage).not.toMatch(/\sstyle="/);
    expect(sigPage).not.toContain('\u2014');
  });
});
