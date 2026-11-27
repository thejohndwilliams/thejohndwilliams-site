/**
 * enforcement-gates.ts - the hero figure on /work/enforcement-gates/.
 *
 * One dot per test message (a mirrored beeswarm on a logit score axis):
 * spam piles up from the baseline as filled cream dots, legitimate messages
 * hang below it as grey rings. Two handles set the review floor and the
 * auto-action gate; each arrow key moves a line past exactly one message.
 * Step buttons do the same with a single pointer. The accent colour marks
 * only harms: legitimate messages above the gate (wrongly removed) and spam
 * below the floor (missed).
 *
 * Positions are CSS variables (--hf, --lf, --plot-ar), never inline
 * transforms: the production CSP is style-src 'self'. One polite live
 * region announces button changes. A focused handle announces itself.
 */
import data from '../data/enforcement-sample.json';
import { wilson } from '../utils/wilson';
import { clampLabelCenter, lineX, logit, plotGeometry, type PlotGeometry, type PlotPoint } from '../utils/enforcement-layout';
import { autoValueText, caughtText, liveSummary, reviewValueText } from '../utils/enforcement-counts';

type Point = PlotPoint & { el?: SVGCircleElement; state?: string };

const SVGNS = 'http://www.w3.org/2000/svg';
const TICKS = [0.001, 0.01, 0.1, 0.5, 0.9, 0.99, 0.999];

let abort: AbortController | null = null;
let resizeObs: ResizeObserver | null = null;
let liveTimer = 0;

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

function teardown(): void {
  abort?.abort();
  abort = null;
  resizeObs?.disconnect();
  resizeObs = null;
  window.clearTimeout(liveTimer);
}

export function initEnforcementGates(): void {
  teardown();
  const root = document.querySelector<HTMLElement>('[data-enf-figure]');
  const page = document.querySelector<HTMLElement>('[data-enf-page]');
  if (!root || !page) return;
  const svg = root.querySelector<SVGSVGElement>('[data-enf-svg]');
  const plot = root.querySelector<HTMLElement>('[data-enf-plot]');
  const hAuto = root.querySelector<HTMLElement>('[data-handle="auto"]');
  const hReview = root.querySelector<HTMLElement>('[data-handle="review"]');
  const reset = root.querySelector<HTMLButtonElement>('[data-enf-reset]');
  const live = root.querySelector<HTMLElement>('[data-enf-live]');
  const labels = {
    allow: root.querySelector<HTMLElement>('[data-band="allow"]'),
    review: root.querySelector<HTMLElement>('[data-band="review"]'),
    auto: root.querySelector<HTMLElement>('[data-band="auto"]'),
  };
  if (!svg || !plot || !hAuto || !hReview) return;

  abort = new AbortController();
  const { signal } = abort;

  const raw = data.points as [number, number][];
  let geo: PlotGeometry = plotGeometry(raw, plot.clientWidth || 640);
  let pts = geo.pts as Point[];
  const n = raw.length;
  const spamPrefix = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) spamPrefix[i + 1] = spamPrefix[i] + raw[i][1];
  const totalSpam = spamPrefix[n];
  const firstAtLeast = (t: number) => {
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (raw[mid][0] < t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const PUBLISHED = { auto: firstAtLeast(data.gates.auto), review: firstAtLeast(data.gates.review) };
  const st = { ...PUBLISHED };
  {
    const params = new URLSearchParams(window.location.search);
    const rawAuto = params.get('auto');
    const rawRev = params.get('review');
    if (rawAuto !== null) {
      const v = Number(rawAuto);
      if (Number.isFinite(v) && v >= 0 && v <= 1) st.auto = firstAtLeast(v);
    }
    if (rawRev !== null) {
      const v = Number(rawRev);
      if (Number.isFinite(v) && v >= 0 && v <= 1) st.review = firstAtLeast(v);
    }
    st.review = Math.max(0, Math.min(n, st.review));
    st.auto = Math.max(st.review, Math.min(n, st.auto));
  }
  let lastHandle: HTMLElement = hAuto;

  let bandAuto: SVGRectElement | undefined;
  let bandReview: SVGRectElement | undefined;

  // The plot is drawn at most MAX_W logical pixels wide. Wider containers
  // (the pinned story stage on large screens) scale the SVG up whole, so
  // dots, piles and lines grow together instead of the swarm going flat.
  // CSS px = logical px * scale().
  const MAX_W = 1160;
  const scale = () => (geo.W > 0 ? plot!.clientWidth / geo.W : 1);

  function layout(): void {
    const W = Math.min(MAX_W, Math.round(plot!.clientWidth));
    if (W < 10) return;
    geo = plotGeometry(raw, W);
    pts = geo.pts as Point[];
    const { H, padL, padR, base, axis, r, rh } = geo;

    svg!.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg!.setAttribute('width', String(W));
    svg!.setAttribute('height', String(H));
    svg!.replaceChildren();

    const defs = document.createElementNS(SVGNS, 'defs');
    const pat = document.createElementNS(SVGNS, 'pattern');
    pat.setAttribute('id', 'enf-hatch');
    pat.setAttribute('width', '6');
    pat.setAttribute('height', '6');
    pat.setAttribute('patternUnits', 'userSpaceOnUse');
    pat.setAttribute('patternTransform', 'rotate(45)');
    const pl = document.createElementNS(SVGNS, 'line');
    pl.setAttribute('x1', '0');
    pl.setAttribute('y1', '0');
    pl.setAttribute('x2', '0');
    pl.setAttribute('y2', '6');
    pl.setAttribute('class', 'enf-hatch-line');
    pat.appendChild(pl);
    defs.appendChild(pat);
    svg!.appendChild(defs);

    bandReview = document.createElementNS(SVGNS, 'rect');
    bandReview.setAttribute('class', 'enf-band enf-band--review');
    bandReview.setAttribute('y', '0');
    bandReview.setAttribute('height', String(H - axis));
    svg!.appendChild(bandReview);
    bandAuto = document.createElementNS(SVGNS, 'rect');
    bandAuto.setAttribute('class', 'enf-band enf-band--auto');
    bandAuto.setAttribute('y', '0');
    bandAuto.setAttribute('height', String(H - axis));
    svg!.appendChild(bandAuto);

    const baseline = document.createElementNS(SVGNS, 'line');
    baseline.setAttribute('class', 'enf-baseline');
    baseline.setAttribute('x1', String(padL));
    baseline.setAttribute('x2', String(W - padR));
    baseline.setAttribute('y1', String(base));
    baseline.setAttribute('y2', String(base));
    svg!.appendChild(baseline);

    const lmin = logit(pts[0].s) - 0.4;
    const lmax = logit(pts[n - 1].s) + 0.4;
    const xOf = (l: number) => padL + ((l - lmin) / (lmax - lmin)) * (W - padL - padR);
    for (const t of TICKS) {
      const x = xOf(logit(t));
      if (x < padL || x > W - padR) continue;
      const tick = document.createElementNS(SVGNS, 'text');
      tick.setAttribute('class', 'enf-tick');
      tick.setAttribute('x', String(x));
      tick.setAttribute('y', String(H - 8));
      tick.setAttribute('text-anchor', 'middle');
      tick.textContent = String(t);
      svg!.appendChild(tick);
      const mark = document.createElementNS(SVGNS, 'line');
      mark.setAttribute('class', 'enf-tick-mark');
      mark.setAttribute('x1', String(x));
      mark.setAttribute('x2', String(x));
      mark.setAttribute('y1', String(H - axis + 4));
      mark.setAttribute('y2', String(H - axis + 9));
      svg!.appendChild(mark);
    }

    const g = document.createElementNS(SVGNS, 'g');
    for (const p of pts) {
      const c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', p.x.toFixed(2));
      c.setAttribute('cy', (p.y === 1 ? base - 4 - p.py - r : base + 4 + p.py + rh).toFixed(2));
      c.setAttribute('r', (p.y === 1 ? r : rh - 0.25).toFixed(2));
      p.el = c;
      p.state = '';
      g.appendChild(c);
    }
    svg!.appendChild(g);
    update(false);
  }

  function setBind(key: string, value: string): void {
    page!.querySelectorAll<HTMLElement>(`[data-bind="${key}"]`).forEach((el) => {
      if (el.textContent !== value) el.textContent = value;
    });
  }

  function placeLabel(el: HTMLElement | null, bandLeft: number, bandRight: number): void {
    if (!el) return;
    const width = el.offsetWidth;
    const k = scale();
    const l = bandLeft * k;
    const r = bandRight * k;
    const center = clampLabelCenter((l + r) / 2, l, r, width, geo.W * k);
    el.style.setProperty('--lf', `${center}px`);
    // A band narrower than its label cannot hold it. Hide it instead of
    // painting across the neighbour. The element stays in the tree.
    el.classList.toggle('is-clipped', r - l < width + 4);
  }

  function scoreAt(idx: number): string {
    if (n === 0) return 'unavailable';
    if (idx >= n) return '1.000';
    const score = pts[idx]?.s;
    if (!(score >= 0)) return 'unavailable';
    return score.toFixed(3);
  }

  function update(announce = true): void {
    const a = st.auto;
    const rv = st.review;
    const autoN = n - a;
    const autoTp = totalSpam - spamPrefix[a];
    const autoFp = autoN - autoTp;
    const reviewN = a - rv;
    const reviewSpam = spamPrefix[a] - spamPrefix[rv];
    const missed = spamPrefix[rv];
    const [lo, hi] = wilson(autoTp, autoN);
    const { W, padL, padR } = geo;

    setBind('auto', String(autoTp));
    setBind('review', String(reviewN));
    setBind('missed', String(missed));
    setBind('wrong', String(autoFp));
    setBind('precision', autoN > 0 ? pct(autoTp / autoN) : 'n/a');
    setBind('precisionCI', autoN > 0 ? `${pct(lo)} to ${pct(hi)}` : 'no actions');
    setBind('reviewMix', `${reviewSpam} spam, ${reviewN - reviewSpam} legitimate`);
    setBind('caught', caughtText(autoTp + reviewSpam, totalSpam));

    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const cls = p.y === 1 ? (i < rv ? 'd s is-missed' : 'd s') : i >= a ? 'd h is-wrong' : 'd h';
      if (p.state !== cls && p.el) {
        p.el.setAttribute('class', cls);
        p.state = cls;
      }
    }

    const xa = lineX(geo, a);
    const xr = lineX(geo, rv);
    if (bandAuto) {
      bandAuto.setAttribute('x', String(xa));
      bandAuto.setAttribute('width', String(Math.max(0, W - xa)));
      bandReview!.setAttribute('x', String(xr));
      bandReview!.setAttribute('width', String(Math.max(0, xa - xr)));
    }
    const frac = (x: number) => (W > 0 ? x / W : 0);
    hAuto!.style.setProperty('--hf', String(frac(xa)));
    hReview!.style.setProperty('--hf', String(frac(xr)));
    placeLabel(labels.allow, padL, xr);
    placeLabel(labels.review, xr, xa);
    placeLabel(labels.auto, xa, W - padR);
    root!.classList.toggle('is-narrow-review', (xa - xr) * scale() < 64);

    hAuto!.setAttribute('aria-valuemin', '0');
    hAuto!.setAttribute('aria-valuemax', String(n));
    hAuto!.setAttribute('aria-valuenow', String(a));
    hReview!.setAttribute('aria-valuemin', '0');
    hReview!.setAttribute('aria-valuemax', String(n));
    hReview!.setAttribute('aria-valuenow', String(rv));
    hAuto!.setAttribute('aria-valuetext', autoValueText(scoreAt(a), autoTp, autoN, autoFp));
    hReview!.setAttribute('aria-valuetext', reviewValueText(scoreAt(rv), reviewN, missed));

    const moved = a !== PUBLISHED.auto || rv !== PUBLISHED.review;
    if (reset) reset.hidden = !moved;
    if (!announce || !live) return;
    const handleFocused = document.activeElement === hAuto || document.activeElement === hReview;
    window.clearTimeout(liveTimer);
    if (handleFocused) return;
    const text = liveSummary(autoTp, autoN, reviewN, missed, autoFp);
    liveTimer = window.setTimeout(() => {
      if (live.textContent !== text) live.textContent = text;
    }, 400);
  }

  function syncUrl(): void {
    try {
      const url = new URL(window.location.href);
      const moved = st.auto !== PUBLISHED.auto || st.review !== PUBLISHED.review;
      if (moved) {
        url.searchParams.set('auto', scoreAt(st.auto));
        url.searchParams.set('review', scoreAt(st.review));
      } else {
        url.searchParams.delete('auto');
        url.searchParams.delete('review');
      }
      const next = url.pathname + url.search + url.hash;
      const cur = window.location.pathname + window.location.search + window.location.hash;
      if (next !== cur) window.history.replaceState(window.history.state, '', next);
    } catch {}
  }

  function setIdx(which: 'auto' | 'review', idx: number, commitUrl = false): void {
    const v = Math.max(0, Math.min(n, idx));
    if (which === 'auto') st.auto = Math.max(v, st.review);
    else st.review = Math.min(v, st.auto);
    update();
    if (commitUrl) syncUrl();
  }

  function idxFromX(x: number): number {
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].x < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  for (const [h, which] of [[hAuto, 'auto'], [hReview, 'review']] as const) {
    h.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      lastHandle = h;
      h.focus({ preventScroll: true });
      h.setPointerCapture(e.pointerId);
      root!.classList.add('is-dragging');
    }, { signal });
    h.addEventListener('pointermove', (e) => {
      if (!h.hasPointerCapture(e.pointerId)) return;
      const rect = plot!.getBoundingClientRect();
      setIdx(which, idxFromX((e.clientX - rect.left) / scale()));
    }, { signal });
    const end = (e: PointerEvent) => {
      if (h.hasPointerCapture(e.pointerId)) h.releasePointerCapture(e.pointerId);
      root!.classList.remove('is-dragging');
      syncUrl();
    };
    h.addEventListener('pointerup', end, { signal });
    h.addEventListener('pointercancel', end, { signal });
    h.addEventListener('keydown', (e) => {
      lastHandle = h;
      const cur = which === 'auto' ? st.auto : st.review;
      const map: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
      if (e.key in map) {
        setIdx(which, cur + map[e.key], true);
        e.preventDefault();
      } else if (e.key === 'Home') {
        setIdx(which, 0, true);
        e.preventDefault();
      } else if (e.key === 'End') {
        setIdx(which, n, true);
        e.preventDefault();
      }
    }, { signal });
  }

  root.querySelectorAll<HTMLButtonElement>('[data-nudge]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const which = btn.dataset.nudge === 'auto' ? 'auto' : 'review';
      const dir = Number(btn.dataset.dir);
      if (dir !== 1 && dir !== -1) return;
      lastHandle = which === 'auto' ? hAuto! : hReview!;
      const cur = which === 'auto' ? st.auto : st.review;
      setIdx(which, cur + dir, true);
    }, { signal });
  });

  reset?.addEventListener('click', () => {
    window.clearTimeout(liveTimer);
    liveTimer = 0;
    if (live) live.textContent = '';
    st.auto = PUBLISHED.auto;
    st.review = PUBLISHED.review;
    lastHandle.focus({ preventScroll: true });
    update(false);
    syncUrl();
  }, { signal });

  layout();
  root.setAttribute('data-ready', '');
  document.fonts?.ready.then(() => {
    if (signal.aborted) return;
    update(false);
  }).catch(() => undefined);
  let lastW = Math.round(plot.clientWidth);
  resizeObs = new ResizeObserver(() => {
    const w = Math.round(plot.clientWidth);
    if (w === lastW) return;
    lastW = w;
    // Past MAX_W the drawing is unchanged; only the CSS scale moves, so the
    // labels need re-placing but the dots do not need redrawing.
    if (Math.min(MAX_W, w) !== geo.W) layout();
    else update(false);
  });
  resizeObs.observe(plot);
  document.addEventListener('astro:before-swap', teardown, { once: true, signal });
}

initEnforcementGates();
document.addEventListener('astro:after-swap', initEnforcementGates);
