// Interactive query-gate console and burst timeline on /work/signal-triage/.
// Evaluates the 720-post benchmark stream live as clauses are toggled.
// Without script, the cumulative stage table and static timeline carry every figure.
import benchmark from '../data/signal-triage.json';
import {
  evaluateStream,
  specimenVerdict,
  type Clauses,
  type SpecimenPost,
  type StreamMeta,
  type StreamRow,
} from '../utils/signal-triage';
import { CHECKS, SCENARIOS } from '../data/signal-presend';

let abort: AbortController | null = null;

const pct = (v: number, d = 1): string => `${(v * 100).toFixed(d)}%`;

function init(): void {
  abort?.abort();
  const page = document.querySelector<HTMLElement>('[data-sig-page]');
  const root = document.querySelector<HTMLElement>('[data-sig-console]');
  if (!page || !root) return;

  const live = root.querySelector<HTMLElement>('[data-sig-live]');
  const decisionEl = root.querySelector<HTMLElement>('[data-sig-decision]');
  const reasonsEl = root.querySelector<HTMLElement>('[data-sig-reasons]');
  if (!live || !decisionEl || !reasonsEl) return;

  abort = new AbortController();
  const { signal } = abort;
  live.hidden = false;

  const rows = benchmark.rows as unknown as StreamRow[];
  const meta = benchmark.meta as StreamMeta;
  const specimens = benchmark.specimens as SpecimenPost[];

  const state: Clauses = {
    prox: true,
    excl: true,
    corr: true,
    dedup: true,
  };

  const bindText = (key: string, value: string): void => {
    page.querySelectorAll<HTMLElement>(`[data-sig-bind="${key}"]`).forEach((el) => {
      el.textContent = value;
    });
  };

  const render = (): void => {
    const res = evaluateStream(rows, meta, state);

    root.dataset.sigState = res.ships ? 'ships' : 'blocked';
    decisionEl.textContent = res.ships ? 'Clears the gate' : 'Blocked at gate';

    reasonsEl.replaceChildren();
    for (const r of res.reasons) {
      const li = document.createElement('li');
      li.textContent = r;
      reasonsEl.append(li);
    }

    bindText('precision', pct(res.precision));
    bindText('precisionCI', `${pct(res.wilson[0])} to ${pct(res.wilson[1])}`);
    bindText('recall', pct(res.recall));
    bindText('recallSub', `${res.tp} of ${meta.signal_total} true reports`);
    bindText('fp', String(res.fp));
    bindText('preFault', `${res.preFaultAlarms} pre-fault ${res.preFaultAlarms === 1 ? 'page' : 'pages'}`);
    bindText('lead', res.leadMinutes !== null ? `${res.leadMinutes} min` : 'None');
    bindText('detectAt', res.detectTime ? `Fires ${res.detectTime} UTC` : 'No burst trigger');

    specimens.forEach((sp) => {
      const rowEl = root.querySelector<HTMLElement>(`[data-specimen="${sp.id}"]`);
      if (!rowEl) return;
      const v = specimenVerdict(sp, state);
      rowEl.dataset.verdict = v.kind;
      const tag = rowEl.querySelector<HTMLElement>('[data-specimen-tag]');
      if (tag) tag.textContent = v.label;
    });

    // Update gated bars on the timeline SVG so the reader sees pre-fault spikes appear/vanish.
    const bars = page.querySelectorAll<SVGRectElement>('[data-sig-bar]');
    const maxY = Number(page.querySelector<SVGSVGElement>('[data-sig-svg]')?.dataset.maxCount || 28);
    const plotTop = 28;
    const plotBottom = 184;
    const plotH = plotBottom - plotTop;
    bars.forEach((bar) => {
      const w = Number(bar.dataset.sigBar);
      const count = res.winCounts[w] ?? 0;
      const h = Math.max(0, Math.min(1, count / maxY)) * plotH;
      const y = plotBottom - h;
      bar.setAttribute('y', y.toFixed(1));
      bar.setAttribute('height', h.toFixed(1));
      const isTrigger = res.detectWindow !== null && (w === res.detectWindow || w === res.detectWindow - 1);
      const isFalseBurst = w < meta.fault_window && count >= meta.burst_min_count;
      bar.classList.toggle('is-alert', isTrigger || isFalseBurst);
    });
  };

  root.querySelectorAll<HTMLButtonElement>('[data-clause]').forEach((btn) => {
    const key = btn.dataset.clause as keyof Clauses;
    btn.addEventListener(
      'click',
      () => {
        state[key] = !state[key];
        btn.setAttribute('aria-pressed', String(state[key]));
        render();
      },
      { signal },
    );
  });

  render();
}

// Proximity figure: the marks are computed at build; script only chooses which
// query form leads and dims the posts that form would drop.
function initProx(signal: AbortSignal): void {
  const fig = document.querySelector<HTMLElement>('[data-sig-prox]');
  const live = fig?.querySelector<HTMLElement>('[data-sig-prox-live]');
  const tallyEl = fig?.querySelector<HTMLElement>('[data-sig-prox-tally]');
  if (!fig || !live || !tallyEl) return;
  live.hidden = false;
  fig.classList.add('is-live');
  const buttons = fig.querySelectorAll<HTMLButtonElement>('[data-prox-mode]');
  const choose = (mode: string): void => {
    fig.dataset.mode = mode;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.proxMode === mode)));
    const active = fig.querySelector<HTMLButtonElement>(`[data-prox-mode="${mode}"]`);
    if (active?.dataset.tally) tallyEl.textContent = active.dataset.tally;
    fig.querySelectorAll<HTMLElement>('.sig-prox__post').forEach((post) => {
      post.dataset.kept = post.dataset[mode] ?? 'false';
    });
  };
  buttons.forEach((b) => b.addEventListener('click', () => choose(b.dataset.proxMode ?? 'relevance'), { signal }));
}

// Pre-send gate: scenarios come from src/data/signal-presend.ts.
function initGate(signal: AbortSignal): void {
  const fig = document.querySelector<HTMLElement>('[data-sig-gate]');
  const live = fig?.querySelector<HTMLElement>('[data-sig-gate-live]');
  const outcome = fig?.querySelector<HTMLElement>('[data-sig-gate-outcome]');
  const detail = fig?.querySelector<HTMLElement>('[data-sig-gate-detail]');
  if (!fig || !live || !outcome || !detail) return;
  live.hidden = false;
  const buttons = fig.querySelectorAll<HTMLButtonElement>('[data-scenario-id]');
  const choose = (id: string): void => {
    const sc = SCENARIOS.find((x) => x.id === id) ?? SCENARIOS[0];
    fig.dataset.scenario = sc.id;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scenarioId === sc.id)));
    for (const c of CHECKS) {
      const row = fig.querySelector<HTMLElement>(`[data-check="${c.id}"]`);
      const st = sc.states[c.id];
      if (!row) continue;
      row.dataset.fail = String(Boolean(st?.fail));
      const stateEl = row.querySelector<HTMLElement>('[data-check-state]');
      if (stateEl) stateEl.textContent = st ? st.text : 'Pass';
    }
    outcome.textContent = sc.outcome;
    detail.textContent = sc.detail;
  };
  buttons.forEach((b) => b.addEventListener('click', () => choose(b.dataset.scenarioId ?? 'clean'), { signal }));
}

document.addEventListener('astro:page-load', () => {
  init();
  if (abort) {
    initProx(abort.signal);
    initGate(abort.signal);
  }
});
