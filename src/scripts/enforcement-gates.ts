/**
 * enforcement-gates.ts - the hero figure on /work/enforcement-gates/.
 *
 * One dot per test message (a mirrored beeswarm on a logit score axis):
 * spam piles up from the baseline as filled cream dots, legitimate messages
 * hang below it as grey rings. Two handles set the review floor and the
 * auto-action gate; each arrow key moves a line past exactly one message.
 * The accent colour marks only harms: legitimate messages above the gate
 * (wrongly removed) and spam below the floor (missed).
 *
 * Every number on the readout and in the lede is recomputed from prefix
 * sums on each move. No chart library; SVG presentation is all classes in
 * enforcement-gates.css (the CSP forbids inline <style>).
 */
import data from '../data/enforcement-sample.json';
import { wilson } from '../utils/wilson';

type Point = { s: number; y: number; x: number; py: number; el?: SVGCircleElement; state?: string };

const SVGNS = 'http://www.w3.org/2000/svg';
const EPS = 1e-4;
const TICKS = [0.001, 0.01, 0.1, 0.5, 0.9, 0.99, 0.999];

let abort: AbortController | null = null;
let resizeObs: ResizeObserver | null = null;
let liveTimer = 0;

const logit = (p: number) => {
  const q = Math.min(1 - EPS, Math.max(EPS, p));
  return Math.log(q / (1 - q));
};
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

  const pts: Point[] = (data.points as [number, number][]).map(([s, y]) => ({ s, y, x: 0, py: 0 }));
  const n = pts.length;
  const spamPrefix = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) spamPrefix[i + 1] = spamPrefix[i] + pts[i].y;
  const totalSpam = spamPrefix[n];
  const firstAtLeast = (t: number) => {
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].s < t) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const PUBLISHED = { auto: firstAtLeast(data.gates.auto), review: firstAtLeast(data.gates.review) };
  const st = { ...PUBLISHED };

  const lmin = logit(pts[0].s) - 0.4;
  const lmax = logit(pts[n - 1].s) + 0.4;
  let W = 0;
  let H = 0;
  let base = 0;
  let padL = 0;
  let padR = 0;
  const xOf = (l: number) => padL + ((l - lmin) / (lmax - lmin)) * (W - padL - padR);
  // A line sits between the last message it lets through and the first it takes.
  const lineX = (idx: number) => {
    if (idx <= 0) return padL - 6;
    if (idx >= n) return W - padR + 6;
    return (pts[idx - 1].x + pts[idx].x) / 2;
  };

  let bandAuto: SVGRectElement;
  let bandReview: SVGRectElement;

  function layout(): void {
    W = Math.round(plot!.clientWidth);
    if (W < 10) return;
    padL = 10;
    padR = 10;
    const r = Math.min(2.4, Math.max(1.45, W / 430));
    // Legitimate messages outnumber spam seven to one and crowd one region;
    // a slightly smaller ring keeps that pile from dwarfing the figure.
    const rh = r * 0.78;
    for (const p of pts) p.x = xOf(logit(p.s));

    // Greedy dodge per side: keep x exact, stack away from the baseline.
    const place = (side: Point[], step: number) => {
      const placed: Point[] = [];
      let maxH = 0;
      for (const p of side) {
        let k = 0;
        for (;;) {
          const yy = k * step;
          let hit = false;
          for (let j = placed.length - 1; j >= 0; j--) {
            const q = placed[j];
            const dx = p.x - q.x;
            if (dx > step) break;
            const dy = yy - q.py;
            if (dx * dx + dy * dy < step * step) {
              hit = true;
              break;
            }
          }
          if (!hit) {
            p.py = yy;
            break;
          }
          k += 1;
        }
        // Keep placed sorted by x (input is already x-ordered).
        placed.push(p);
        maxH = Math.max(maxH, p.py);
      }
      return maxH;
    };
    const spam = pts.filter((p) => p.y === 1);
    const ham = pts.filter((p) => p.y === 0);
    const upH = place(spam, r * 2 + 0.7);
    const downH = place(ham, rh * 2 + 0.55);
    const top = 14;
    const axis = 30;
    base = top + upH + r + 6;
    H = Math.ceil(base + 6 + downH + rh + axis);

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

  function update(announce = true): void {
    const a = st.auto;
    const rv = st.review;
    const autoN = n - a;
    const autoTp = totalSpam - spamPrefix[a];
    const autoFp = autoN - autoTp;
    const reviewN = a - rv;
    const reviewSpam = spamPrefix[a] - spamPrefix[rv];
    const missed = spamPrefix[rv];
    const precision = autoN ? autoTp / autoN : 1;
    const [lo, hi] = wilson(autoTp, autoN);

    setBind('auto', String(autoTp));
    setBind('review', String(reviewN));
    setBind('missed', String(missed));
    setBind('wrong', String(autoFp));
    setBind('precision', autoN ? pct(precision) : 'n/a');
    setBind('precisionCI', autoN ? `${pct(lo)} to ${pct(hi)}` : 'no actions');
    setBind('reviewMix', `${reviewSpam} spam, ${reviewN - reviewSpam} legitimate`);
    setBind('caught', `${pct((autoTp + reviewSpam) / totalSpam)} caught overall`);

    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const cls = p.y === 1 ? (i < rv ? 'd s is-missed' : 'd s') : i >= a ? 'd h is-wrong' : 'd h';
      if (p.state !== cls && p.el) {
        p.el.setAttribute('class', cls);
        p.state = cls;
      }
    }

    const xa = lineX(a);
    const xr = lineX(rv);
    if (bandAuto) {
      bandAuto.setAttribute('x', String(xa));
      bandAuto.setAttribute('width', String(Math.max(0, W - xa)));
      bandReview.setAttribute('x', String(xr));
      bandReview.setAttribute('width', String(Math.max(0, xa - xr)));
    }
    hAuto!.style.transform = `translateX(${xa}px)`;
    hReview!.style.transform = `translateX(${xr}px)`;
    const mid = (x0: number, x1: number) => (x0 + x1) / 2;
    if (labels.allow) labels.allow.style.transform = `translateX(${mid(padL, xr)}px)`;
    if (labels.review) labels.review.style.transform = `translateX(${mid(xr, xa)}px)`;
    if (labels.auto) labels.auto.style.transform = `translateX(${mid(xa, W - padR)}px)`;
    root!.classList.toggle('is-narrow-review', xa - xr < 64);

    const scoreAt = (idx: number) => (idx >= n ? 1 : pts[idx].s).toFixed(3);
    for (const [h, idx, name] of [[hAuto, a, 'Auto-action gate'], [hReview, rv, 'Review floor']] as const) {
      h!.setAttribute('aria-valuemin', '0');
      h!.setAttribute('aria-valuemax', String(n));
      h!.setAttribute('aria-valuenow', String(idx));
    }
    hAuto!.setAttribute('aria-valuetext', `Auto-action at score ${scoreAt(a)}. Precision ${pct(precision)}. ${autoFp} wrongly removed.`);
    hReview!.setAttribute('aria-valuetext', `Review floor at score ${scoreAt(rv)}. ${reviewN} in review. ${missed} missed.`);

    const moved = a !== PUBLISHED.auto || rv !== PUBLISHED.review;
    if (reset) reset.hidden = !moved;
    if (announce && live) {
      window.clearTimeout(liveTimer);
      liveTimer = window.setTimeout(() => {
        live.textContent = `Precision ${pct(precision)}. ${reviewN} in review. ${missed} missed. ${autoFp} wrongly removed.`;
      }, 500);
    }
  }

  function setIdx(which: 'auto' | 'review', idx: number): void {
    const v = Math.max(0, Math.min(n, idx));
    if (which === 'auto') st.auto = Math.max(v, st.review);
    else st.review = Math.min(v, st.auto);
    update();
  }

  function idxFromX(x: number): number {
    // The boundary index whose line position is nearest x.
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
      h.setPointerCapture(e.pointerId);
      root!.classList.add('is-dragging');
      e.preventDefault();
    }, { signal });
    h.addEventListener('pointermove', (e) => {
      if (!h.hasPointerCapture(e.pointerId)) return;
      const rect = plot!.getBoundingClientRect();
      setIdx(which, idxFromX(e.clientX - rect.left));
    }, { signal });
    const end = (e: PointerEvent) => {
      if (h.hasPointerCapture(e.pointerId)) h.releasePointerCapture(e.pointerId);
      root!.classList.remove('is-dragging');
    };
    h.addEventListener('pointerup', end, { signal });
    h.addEventListener('pointercancel', end, { signal });
    h.addEventListener('keydown', (e) => {
      const cur = which === 'auto' ? st.auto : st.review;
      const map: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
      if (e.key in map) {
        setIdx(which, cur + map[e.key]);
        e.preventDefault();
      } else if (e.key === 'Home') {
        setIdx(which, 0);
        e.preventDefault();
      } else if (e.key === 'End') {
        setIdx(which, n);
        e.preventDefault();
      }
    }, { signal });
  }

  reset?.addEventListener('click', () => {
    st.auto = PUBLISHED.auto;
    st.review = PUBLISHED.review;
    update();
  }, { signal });

  root.setAttribute('data-ready', '');
  layout();
  let lastW = W;
  resizeObs = new ResizeObserver(() => {
    const w = Math.round(plot.clientWidth);
    if (w !== lastW) {
      lastW = w;
      layout();
    }
  });
  resizeObs.observe(plot);
  document.addEventListener('astro:before-swap', teardown, { once: true, signal });
}

initEnforcementGates();
document.addEventListener('astro:after-swap', initEnforcementGates);
