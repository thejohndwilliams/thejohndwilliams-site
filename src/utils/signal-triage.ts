import { wilson } from './wilson';

export interface Clauses {
  prox: boolean;
  excl: boolean;
  corr: boolean;
  dedup: boolean;
}

/** [win, label, anchor, prox, excl, corr, dedup, region] */
export type StreamRow = [number, number, number, number, number, number, number, number];

export interface SpecimenPost {
  id: string;
  time: string;
  region: string;
  text: string;
  label: 0 | 1;
  note: string;
  flags: { prox: number; excl: number; corr: number; dedup: number };
}

export interface StreamMeta {
  dataset: string;
  scope: string;
  posts_total: number;
  signal_total: number;
  windows: number;
  window_minutes: number;
  start_utc: string;
  end_utc: string;
  fault_window: number;
  fault_utc: string;
  status_ack_window: number;
  status_ack_utc: string;
  precision_gate: number;
  recall_gate: number;
  burst_min_count: number;
  burst_min_regions: number;
  seed: number;
}

export interface TriageEvaluation {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  precision: number;
  recall: number;
  wilson: [number, number];
  ships: boolean;
  reasons: string[];
  preFaultAlarms: number;
  detectWindow: number | null;
  detectTime: string | null;
  leadMinutes: number | null;
  winCounts: number[];
}

export function hhmmFromWindow(windowIdx: number, windowMinutes = 5): string {
  const totalMin = 75 + windowIdx * windowMinutes; // 01:15 UTC start
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function matchesClauses(
  flags: { prox: number; excl: number; corr: number; dedup: number },
  clauses: Clauses,
  anchor = 1,
): boolean {
  if (anchor !== 1) return false;
  if (clauses.prox && flags.prox !== 1) return false;
  if (clauses.excl && flags.excl !== 1) return false;
  if (clauses.corr && flags.corr !== 1) return false;
  if (clauses.dedup && flags.dedup !== 1) return false;
  return true;
}

export function specimenVerdict(
  specimen: SpecimenPost,
  clauses: Clauses,
): { matched: boolean; kind: 'captured' | 'filtered' | 'false-alarm' | 'missed'; label: string } {
  const matched = matchesClauses(specimen.flags, clauses, 1);
  if (specimen.label === 1 && matched) return { matched, kind: 'captured', label: 'Captured signal' };
  if (specimen.label === 1 && !matched) return { matched, kind: 'missed', label: 'Missed signal' };
  if (specimen.label === 0 && matched) return { matched, kind: 'false-alarm', label: 'False alarm' };
  return { matched, kind: 'filtered', label: 'Filtered noise' };
}

export function evaluateStream(
  rows: StreamRow[],
  meta: StreamMeta,
  clauses: Clauses,
): TriageEvaluation {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  const winCounts = new Array<number>(meta.windows).fill(0);
  const winRegions = Array.from({ length: meta.windows }, () => new Set<number>());

  for (let i = 0; i < rows.length; i++) {
    const [w, label, anchor, pOk, eOk, cOk, dOk, reg] = rows[i];
    const matched =
      anchor === 1 &&
      (!clauses.prox || pOk === 1) &&
      (!clauses.excl || eOk === 1) &&
      (!clauses.corr || cOk === 1) &&
      (!clauses.dedup || dOk === 1);

    if (matched) {
      winCounts[w] += 1;
      if (reg > 0) winRegions[w].add(reg);
      if (label === 1) tp += 1;
      else fp += 1;
    } else if (label === 1) {
      fn += 1;
    } else {
      tn += 1;
    }
  }

  const nMatched = tp + fp;
  const nSig = tp + fn;
  const precision = nMatched > 0 ? tp / nMatched : 0;
  const recall = nSig > 0 ? tp / nSig : 0;
  const ci = wilson(tp, nMatched);

  let preFaultAlarms = 0;
  let detectWindow: number | null = null;

  for (let w = 1; w < meta.windows; w++) {
    const combined = new Set<number>([...winRegions[w - 1], ...winRegions[w]]);
    const fired =
      winCounts[w - 1] >= meta.burst_min_count &&
      winCounts[w] >= meta.burst_min_count &&
      combined.size >= meta.burst_min_regions;
    if (fired) {
      if (w < meta.fault_window) preFaultAlarms += 1;
      else if (detectWindow === null) detectWindow = w;
    }
  }

  const detectTime = detectWindow !== null ? hhmmFromWindow(detectWindow, meta.window_minutes) : null;
  const leadMinutes =
    detectWindow !== null ? (meta.status_ack_window - detectWindow) * meta.window_minutes : null;

  const reasons: string[] = [];
  if (precision < meta.precision_gate) {
    reasons.push(`Precision ${(precision * 100).toFixed(1)}% is below the ${(meta.precision_gate * 100).toFixed(0)}% release gate (${fp} false alarms).`);
  }
  if (recall < meta.recall_gate) {
    reasons.push(`Recall ${(recall * 100).toFixed(1)}% is below the ${(meta.recall_gate * 100).toFixed(0)}% coverage floor.`);
  }
  if (preFaultAlarms > 0) {
    reasons.push(`Fires ${preFaultAlarms} pre-fault false ${preFaultAlarms === 1 ? 'page' : 'pages'} on routine or coordinated chatter before ${meta.fault_utc} UTC.`);
  }
  if (reasons.length === 0) {
    reasons.push(
      `Clears both release gates (${(precision * 100).toFixed(1)}% precision, ${(recall * 100).toFixed(1)}% recall) with zero pre-fault pages.`,
    );
  }

  const ships = precision >= meta.precision_gate && recall >= meta.recall_gate && preFaultAlarms === 0;

  return {
    tp,
    fp,
    fn,
    tn,
    precision,
    recall,
    wilson: ci,
    ships,
    reasons,
    preFaultAlarms,
    detectWindow,
    detectTime,
    leadMinutes,
    winCounts,
  };
}
