/**
 * enforcement-story.ts - the scroll story on /work/enforcement-gates/.
 *
 * The hero figure pins and the reader scrolls through eight steps. Each
 * step is a state of the same 1,032 dots, so nothing is illustrated that
 * the data does not contain:
 *   0 inbox   the messages, unsorted
 *   1 scored  each flies to its model score on the line
 *   2 truth   the answer key: spam rises, legitimate messages fall
 *   3 gate    the auto-action band sweeps in from the right
 *   4 wrong   everything dims except the legitimate messages it removed
 *   5 review  the review band opens; its messages stay lit
 *   6 missed  spam below the floor stays lit
 *   7 play    the reader takes the handles
 * Then the later figures play as they arrive: the interval rows draw, the
 * certification run fills to 381, the QA grid fills square by square, the
 * appeal path counts through, and the requirements set in.
 *
 * Ownership: enforcement-gates.ts owns cx, cy, class and the band rects.
 * This file only writes the SVG `transform` attribute on dots, data-*
 * attributes, and CSS custom properties (CSSOM, allowed under the
 * style-src 'self' CSP). When that script re-lays the plot on resize,
 * a MutationObserver rebuilds this file's cache.
 *
 * Reduced motion, no script, or a viewport too short to pin: every figure
 * shows its final state and the step text reads as an ordered list.
 */
import { ease, motionAllowed, runScenes, span, type Scene } from './scrub';
import { wilson } from '../utils/wilson';

const STEPS = 8;
const ENTER = 0.55; // share of each step spent arriving; the rest holds.
const MIN_PIN_H = 560;

let abort: AbortController | null = null;
let mo: MutationObserver | null = null;

function teardown(): void {
  abort?.abort();
  abort = null;
  mo?.disconnect();
  mo = null;
}

function rand(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Cache = {
  els: SVGCircleElement[];
  cx: Float32Array;
  cy: Float32Array;
  k0x: Float32Array;
  k0y: Float32Array;
  k1y: Float32Array;
  d01: Float32Array;
  d12: Float32Array;
  dirty: Uint8Array;
  last: string[];
};

function buildCache(svg: SVGSVGElement): Cache | null {
  const els = Array.from(svg.querySelectorAll<SVGCircleElement>('g > circle'));
  const n = els.length;
  if (!n) return null;
  const vb = svg.viewBox.baseVal;
  const W = vb?.width || svg.clientWidth || 640;
  const H = vb?.height || svg.clientHeight || 240;
  const baseEl = svg.querySelector('.enf-baseline');
  const base = baseEl ? Number(baseEl.getAttribute('y1')) : H * 0.4;

  const cx = new Float32Array(n);
  const cy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    cx[i] = Number(els[i].getAttribute('cx'));
    cy[i] = Number(els[i].getAttribute('cy'));
  }

  // Inbox: a loose block of identical dots, in shuffled order.
  const rnd = rand(1032);
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const availW = W * 0.62;
  const availH = H * 0.74;
  const cols = Math.max(8, Math.ceil(Math.sqrt(n * (availW / availH))));
  const rows = Math.ceil(n / cols);
  const cell = Math.min(availW / cols, availH / rows);
  const x0 = W / 2 - ((cols - 1) * cell) / 2;
  const y0 = H * 0.44 - ((rows - 1) * cell) / 2;
  const k0x = new Float32Array(n);
  const k0y = new Float32Array(n);
  const d01 = new Float32Array(n);
  for (let slot = 0; slot < n; slot++) {
    const i = order[slot];
    const c = slot % cols;
    const r = Math.floor(slot / cols);
    k0x[i] = x0 + c * cell + (rnd() - 0.5) * cell * 0.35;
    k0y[i] = y0 + r * cell + (rnd() - 0.5) * cell * 0.35;
    d01[i] = rnd();
  }

  // Scored: every dot on the line at its score, a hair of jitter so the
  // density shows. Truth: the published beeswarm (cx, cy).
  const k1y = new Float32Array(n);
  const d12 = new Float32Array(n);
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, cx[i]);
    maxX = Math.max(maxX, cx[i]);
  }
  for (let i = 0; i < n; i++) {
    k1y[i] = base + (rnd() - 0.5) * 5;
    d12[i] = (cx[i] - minX) / Math.max(1, maxX - minX);
  }
  return { els, cx, cy, k0x, k0y, k1y, d01, d12, dirty: new Uint8Array(n), last: new Array<string>(n).fill('') };
}

const SPREAD = 0.45;
const local = (t: number, delay: number) => ease(span(t, delay * SPREAD, delay * SPREAD + (1 - SPREAD)));

function initStory(root: HTMLElement, signal: AbortSignal): Scene | null {
  const scrolly = root.querySelector<HTMLElement>('[data-enf-scrolly]');
  const stage = root.querySelector<HTMLElement>('[data-enf-stage]');
  const svg = root.querySelector<SVGSVGElement>('[data-enf-svg]');
  const steps = Array.from(root.querySelectorAll<HTMLElement>('[data-story-step]'));
  const rail = Array.from(root.querySelectorAll<HTMLElement>('[data-story-tick]'));
  if (!scrolly || !stage || !svg || steps.length !== STEPS) return null;
  if (!motionAllowed() || window.innerHeight < MIN_PIN_H) return null;

  root.classList.add('is-scrolly');
  signal.addEventListener('abort', () => root.classList.remove('is-scrolly'));

  let cache = buildCache(svg);
  let lastP = -1;
  let settled = false;

  const hAuto = root.querySelector<HTMLElement>('[data-handle="auto"]');
  const hReview = root.querySelector<HTMLElement>('[data-handle="review"]');

  function tagReview(): void {
    if (!cache) return;
    const a = Number(hAuto?.getAttribute('aria-valuenow'));
    const rv = Number(hReview?.getAttribute('aria-valuenow'));
    cache.els.forEach((el, i) => {
      if (i >= rv && i < a) el.setAttribute('data-rb', '');
      else el.removeAttribute('data-rb');
    });
  }

  function placeDots(k: number, tp: number): void {
    if (!cache) return;
    const { els, cx, cy, k0x, k0y, k1y, d01, d12, dirty, last } = cache;
    if (k >= 3) {
      if (settled) return;
      for (let i = 0; i < els.length; i++) {
        if (dirty[i]) {
          els[i].removeAttribute('transform');
          dirty[i] = 0;
          last[i] = '';
        }
      }
      settled = true;
      return;
    }
    settled = false;
    for (let i = 0; i < els.length; i++) {
      let x: number;
      let y: number;
      if (k === 0) {
        x = k0x[i];
        y = k0y[i];
      } else if (k === 1) {
        const t = local(tp, d01[i]);
        x = k0x[i] + (cx[i] - k0x[i]) * t;
        y = k0y[i] + (k1y[i] - k0y[i]) * t;
      } else {
        const t = local(tp, d12[i]);
        x = cx[i];
        y = k1y[i] + (cy[i] - k1y[i]) * t;
      }
      const dx = x - cx[i];
      const dy = y - cy[i];
      if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) {
        if (dirty[i]) {
          els[i].removeAttribute('transform');
          dirty[i] = 0;
          last[i] = '';
        }
      } else {
        // Write only a changed position. Rewriting an identical transform
        // still invalidates the dot's style, and scene 0 rewrote all 1,032
        // stationary dots on every frame (2026-11-25 stutter root cause).
        const tf = `translate(${dx.toFixed(1)} ${dy.toFixed(1)})`;
        if (last[i] !== tf) {
          els[i].setAttribute('transform', tf);
          last[i] = tf;
        }
        dirty[i] = 1;
      }
    }
  }

  function counts(k: number, tp: number): void {
    steps.forEach((step, s) => {
      step.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
        const target = Number(el.dataset.count);
        const v = s < k ? target : s > k ? 0 : Math.round(target * ease(span(tp, 0, 0.85)));
        const text = v.toLocaleString('en-US');
        if (el.textContent !== text) el.textContent = text;
      });
    });
  }

  const written = new Map<string, string>();
  function setVar(name: string, v: number): void {
    const str = v.toFixed(3);
    if (written.get(name) === str) return;
    written.set(name, str);
    root.style.setProperty(name, str);
  }
  function setData(key: string, v: string): void {
    if (root.dataset[key] !== v) root.dataset[key] = v;
  }

  function render(p: number): void {
    lastP = p;
    const f = Math.min(STEPS - 1e-6, p * STEPS);
    const k = Math.floor(f);
    const into = f - k;
    const tp = k === 0 ? 1 : ease(span(into, 0, ENTER));

    placeDots(k, tp);

    // Write only what changed, rounded. These custom properties inherit
    // down to all 1,032 dots, so an unchanged-but-rewritten value (or an
    // unrounded float that differs every frame) recalculated the whole
    // figure's style on every scroll frame (2026-11-25 stutter root cause).
    const show = (from: number) => (k > from ? 1 : k < from ? 0 : tp);
    setVar('--show-axis', show(1));
    setVar('--show-auto', show(3));
    setVar('--show-readout', show(3));
    setVar('--show-review', show(5));
    setVar('--show-allow', show(6));
    setVar('--sweep-auto', show(3));
    setVar('--sweep-review', show(5));
    // Dim rises as step 4 arrives and lifts as step 7 arrives.
    const dim = k < 4 ? 0 : k === 4 ? tp : k < 7 ? 1 : 1 - tp;
    setVar('--dim', dim);
    // While the scroll itself drives the dimming, the dots' opacity
    // transition must be off: restarting a 260ms transition on ~1,000 SVG
    // dots every frame ran main-thread animations through the whole figure.
    setData('dimming', dim > 0 && dim < 1 ? 'true' : 'false');

    setData('scene', String(k));
    setData('neutral', k < 2 || (k === 2 && tp < 0.5) ? 'true' : 'false');
    setData('harms', k < 4 ? 'none' : k < 6 ? 'wrong' : 'all');
    const focus = k === 4 ? 'wrong' : k === 5 ? 'review' : k === 6 ? 'missed' : k === 7 && tp < 1 ? root.dataset.focus ?? '' : '';
    if (focus === 'review' && root.dataset.focus !== 'review') tagReview();
    setData('focus', focus);

    steps.forEach((step, s) => step.classList.toggle('is-active', s === k));
    rail.forEach((tick, s) => tick.classList.toggle('is-on', s <= k));
    counts(k, tp);
  }

  mo = new MutationObserver(() => {
    cache = buildCache(svg);
    settled = false;
    if (lastP >= 0) render(lastP);
  });
  mo.observe(svg, { childList: true });

  return {
    el: scrolly,
    mode: 'pin',
    pinned: () => stage.offsetHeight,
    render,
  };
}

function ciScene(page: HTMLElement): Scene | null {
  const fig = page.querySelector<HTMLElement>('[data-enf-ci]');
  if (!fig) return null;
  const rows = Array.from(fig.querySelectorAll<SVGGElement>('[data-ci-row]')).map((g) => {
    const line = g.querySelector<SVGLineElement>('.enf-ci__range')!;
    const dot = g.querySelector<SVGCircleElement>('.enf-ci__point')!;
    return { g, line, dot, x1: Number(line.getAttribute('x1')), x2: Number(line.getAttribute('x2')), px: Number(dot.getAttribute('cx')) };
  });
  fig.classList.add('is-live');
  return {
    el: fig,
    mode: 'enter',
    from: 0.88,
    to: 0.3,
    render(p) {
      fig.style.setProperty('--ci-target', ease(span(p, 0, 0.2)).toFixed(3));
      rows.forEach((row, i) => {
        const t = ease(span(p, 0.15 + i * 0.35, 0.5 + i * 0.35));
        row.line.setAttribute('x1', (row.px + (row.x1 - row.px) * t).toFixed(1));
        row.line.setAttribute('x2', (row.px + (row.x2 - row.px) * t).toFixed(1));
        row.dot.setAttribute('r', (5 * ease(span(p, 0.08 + i * 0.35, 0.2 + i * 0.35))).toFixed(2));
        row.g.style.setProperty('--row', t.toFixed(3));
      });
    },
  };
}

function runScene(page: HTMLElement): Scene | null {
  const fig = page.querySelector<HTMLElement>('[data-enf-run]');
  if (!fig) return null;
  const cells = Array.from(fig.querySelectorAll<HTMLElement>('.enf-run__grid .enf-run__cell'));
  const nOut = fig.querySelector<HTMLElement>('[data-run-n]');
  const lbOut = fig.querySelector<HTMLElement>('[data-run-lb]');
  const total = cells.length;
  let shown = -1;
  fig.classList.add('is-live');
  return {
    el: fig,
    mode: 'enter',
    from: 0.85,
    to: 0.15,
    render(p) {
      const k = Math.round(total * span(p, 0.05, 0.95));
      if (k === shown) return;
      cells.forEach((c, i) => c.classList.toggle('is-on', i < k));
      shown = k;
      if (nOut) nOut.textContent = String(k);
      if (lbOut) lbOut.textContent = k > 0 ? `${(wilson(k, k)[0] * 100).toFixed(1)}%` : '0.0%';
      fig.classList.toggle('is-certified', k >= total);
    },
  };
}

function qaScene(page: HTMLElement): Scene | null {
  const fig = page.querySelector<HTMLElement>('.enf-qa');
  if (!fig) return null;
  const cells = Array.from(fig.querySelectorAll<HTMLElement>('.enf-qa__grid .enf-qa__cell'));
  let shown = -1;
  fig.classList.add('is-live');
  return {
    el: fig,
    mode: 'enter',
    from: 0.85,
    to: 0.3,
    render(p) {
      const k = Math.round(cells.length * span(p, 0, 0.9));
      if (k === shown) return;
      cells.forEach((c, i) => c.classList.toggle('is-on', i < k));
      shown = k;
    },
  };
}

function flowScene(page: HTMLElement): Scene | null {
  const list = page.querySelector<HTMLElement>('.enf-flow');
  if (!list) return null;
  const items = Array.from(list.querySelectorAll<HTMLElement>('li'));
  const vals = items.map((li) => {
    const v = li.querySelector<HTMLElement>('.enf-flow__v')!;
    const text = v.textContent ?? '';
    const num = parseFloat(text);
    const decimals = (text.split('.')[1] ?? '').replace(/\D/g, '').length;
    return { li, v, text, num, decimals, suffix: text.endsWith('%') ? '%' : '' };
  });
  list.classList.add('is-live');
  return {
    el: list,
    mode: 'enter',
    from: 0.85,
    to: 0.35,
    render(p) {
      vals.forEach((it, i) => {
        const t = ease(span(p, i * 0.22, i * 0.22 + 0.34));
        it.li.style.setProperty('--fp', t.toFixed(3));
        const shownText = t >= 1 ? it.text : `${(it.num * t).toFixed(it.decimals)}${it.suffix}`;
        if (it.v.textContent !== shownText) it.v.textContent = shownText;
      });
    },
  };
}

function reqScene(page: HTMLElement): Scene | null {
  const list = page.querySelector<HTMLElement>('.enf-req-list');
  if (!list) return null;
  const items = Array.from(list.querySelectorAll<HTMLElement>('li'));
  list.classList.add('is-live');
  return {
    el: list,
    mode: 'enter',
    from: 0.92,
    to: 0.35,
    render(p) {
      items.forEach((li, i) => li.style.setProperty('--rp', ease(span(p, i * 0.15, i * 0.15 + 0.4)).toFixed(3)));
    },
  };
}

function heroScene(): Scene | null {
  const hero = document.querySelector<HTMLElement>('.enf-hero');
  if (!hero) return null;
  hero.classList.add('is-live');
  return {
    el: hero,
    mode: 'exit',
    render(p) {
      hero.style.setProperty('--hx', p.toFixed(3));
    },
  };
}

export function initEnforcementStory(): void {
  teardown();
  const page = document.querySelector<HTMLElement>('[data-enf-page]');
  const root = document.querySelector<HTMLElement>('[data-enf-figure]');
  if (!page || !root) return;
  abort = new AbortController();
  const { signal } = abort;
  const scenes = [
    heroScene(),
    initStory(root, signal),
    ciScene(page),
    runScene(page),
    qaScene(page),
    flowScene(page),
    reqScene(page),
  ].filter((s): s is Scene => Boolean(s));
  runScenes(scenes, signal);
  document.addEventListener('astro:before-swap', teardown, { once: true, signal });
}

initEnforcementStory();
document.addEventListener('astro:after-swap', initEnforcementStory);
