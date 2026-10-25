// One exploded depth figure. Autoplays once when it enters the view,
// then the range and a horizontal drag (vertical drag on touch still
// scrolls) scrub separation. The loop runs only while values are moving.

type Pose = { sep: number; tilt: number; lab: number };

type Drag = {
  id: number;
  x: number;
  y: number;
  sep: number;
  axis: 'x' | 'y' | null;
  touch: boolean;
};

const EASE = unitBezier(0.16, 1, 0.3, 1);

let abort: AbortController | null = null;
let mountedFig: HTMLElement | null = null;

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function poseFor(sep: number): Pose {
  const s = clamp01(sep);
  return { sep: s, tilt: s > 0.01 ? 1 : 0, lab: s > 0.82 ? 1 : 0 };
}

function poseAt(ms: number): Pose | null {
  const pause = 700;
  const tiltD = 900;
  const exD = 1100;
  const labD = 240;
  const hold = 2200;
  const gap = 60;
  let t = ms;
  if (t < pause) return { sep: 0, tilt: 0, lab: 0 };
  t -= pause;
  if (t < tiltD) return { sep: 0, tilt: EASE(t / tiltD), lab: 0 };
  t -= tiltD;
  if (t < exD) return { sep: EASE(t / exD), tilt: 1, lab: 0 };
  t -= exD;
  if (t < gap) return { sep: 1, tilt: 1, lab: 0 };
  t -= gap;
  if (t < labD) return { sep: 1, tilt: 1, lab: EASE(t / labD) };
  t -= labD;
  if (t < hold) return { sep: 1, tilt: 1, lab: 1 };
  t -= hold;
  if (t < labD) return { sep: 1, tilt: 1, lab: 1 - EASE(t / labD) };
  t -= labD;
  if (t < exD) return { sep: 1 - EASE(t / exD), tilt: 1, lab: 0 };
  t -= exD;
  if (t < tiltD) return { sep: 0, tilt: 1 - EASE(t / tiltD), lab: 0 };
  return null;
}

function unitBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const dx = sampleX(t) - x;
      const deriv = sampleDX(t);
      if (Math.abs(dx) < 1e-4 || Math.abs(deriv) < 1e-5) break;
      t = Math.min(1, Math.max(0, t - dx / deriv));
    }
    return sampleY(t);
  };
}

function initDepthStack(): void {
  const fig = document.getElementById('depth-stack');
  // A plate swap on /beyond dispatches astro:after-swap for the study.
  // The same figure is still on the page, so leave its still state alone.
  if (fig instanceof HTMLElement && fig === mountedFig && fig.isConnected) return;
  abort?.abort();
  abort = null;
  mountedFig = null;
  if (!(fig instanceof HTMLElement)) return;
  abort = new AbortController();
  mountedFig = fig;
  const signal = abort.signal;
  signal.addEventListener('abort', () => {
    if (mountedFig === fig) mountedFig = null;
  });
  try {
    mount(fig, signal);
  } catch {
    fig.classList.add('is-failed');
  }
}

function mount(fig: HTMLElement, signal: AbortSignal): void {
  const view = fig.querySelector<HTMLElement>('.depth-stack__view');
  const rangeLabel = fig.querySelector<HTMLElement>('.depth-stack__range');
  const range = fig.querySelector<HTMLInputElement>('#depth-separation');
  const replay = fig.querySelector<HTMLButtonElement>('.depth-stack__replay');
  const plates = [...fig.querySelectorAll<HTMLElement>('.depth-stack__plate')].sort(
    (a, b) => Number(a.dataset.i) - Number(b.dataset.i),
  );
  const tags = [...fig.querySelectorAll<HTMLElement>('.depth-stack__tag')];
  const lazy = [...fig.querySelectorAll<HTMLImageElement>('[data-src]')];
  if (!view || !range || !rangeLabel || !replay || plates.length !== 5 || tags.length !== 5) return;

  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => mq.matches;
  const still = new URLSearchParams(window.location.search).get('still');

  let shown: Pose = { sep: 0, tilt: 0, lab: 0 };
  let target: Pose = { sep: 0, tilt: 0, lab: 0 };
  let raf = 0;
  let playing = false;
  let rangeHold = false;
  let imagesArmed = false;
  let drag: Drag | null = null;
  let lastTick = 0;

  const stopRaf = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    fig.classList.remove('is-run');
  };

  const place = () => {
    const vr = view.getBoundingClientRect();
    if (vr.width < 2 || vr.height < 2) return;
    const items: { el: HTMLElement; y: number; anchor: number }[] = [];
    for (const tag of tags) {
      if (getComputedStyle(tag).display === 'none') continue;
      const plate = plates[Number(tag.dataset.i)];
      if (!plate) continue;
      const r = plate.getBoundingClientRect();
      items.push({
        el: tag,
        y: r.top + r.height * 0.5 - vr.top,
        anchor: r.right - vr.left,
      });
    }
    if (items.length === 0) return;
    const sample = items[0].el.offsetHeight || 14;
    const minGap = Math.max(sample + 6, 18);
    const pad = Math.max(8, sample * 0.65);
    for (let pass = 0; pass < 8; pass += 1) {
      for (let i = 1; i < items.length; i += 1) {
        const gap = items[i].y - items[i - 1].y;
        if (gap < minGap) {
          const push = (minGap - gap) / 2;
          items[i - 1].y -= push;
          items[i].y += push;
        }
      }
    }
    const span = items[items.length - 1].y - items[0].y;
    const maxSpan = Math.max(minGap, vr.height - pad * 2);
    if (span > maxSpan && span > 0) {
      const scale = maxSpan / span;
      const origin = items[0].y;
      for (const item of items) item.y = pad + (item.y - origin) * scale;
    } else if (items[0].y < pad) {
      const shift = pad - items[0].y;
      for (const item of items) item.y += shift;
    } else if (items[items.length - 1].y > vr.height - pad) {
      const shift = items[items.length - 1].y - (vr.height - pad);
      for (const item of items) item.y -= shift;
    }
    for (const item of items) {
      const width = item.el.offsetWidth || 0;
      const labelLeft = vr.width - width;
      const room = Math.max(8, labelLeft - 4);
      const leader = Math.max(8, Math.min(room, labelLeft - item.anchor));
      item.el.style.setProperty('--ly', `${item.y}px`);
      item.el.style.setProperty('--ll', `${leader}px`);
    }
  };

  const apply = () => {
    fig.style.setProperty('--sep', shown.sep.toFixed(4));
    fig.style.setProperty('--tilt', shown.tilt.toFixed(4));
    fig.style.setProperty('--lab', shown.lab.toFixed(4));
    fig.classList.toggle('is-open', shown.sep > 0.45);
    if (!rangeHold && document.activeElement !== range) {
      range.value = shown.sep.toFixed(2);
    }
    if (shown.sep > 0.4 || shown.lab > 0.15) place();
  };

  const kick = () => {
    if (reduced()) {
      shown = { sep: target.sep, tilt: target.tilt, lab: target.lab };
      apply();
      fig.classList.remove('is-run');
      return;
    }
    if (raf) return;
    fig.classList.add('is-run');
    lastTick = performance.now();
    const step = (now: number) => {
      if (signal.aborted) return;
      const dt = Math.min(40, now - lastTick);
      lastTick = now;
      const k = 1 - Math.exp(-dt / 90);
      let settled = true;
      const next: Pose = { sep: shown.sep, tilt: shown.tilt, lab: shown.lab };
      const keys = ['sep', 'tilt', 'lab'] as const;
      for (const key of keys) {
        const delta = target[key] - shown[key];
        if (Math.abs(delta) < 0.0015) next[key] = target[key];
        else {
          next[key] = shown[key] + delta * k;
          settled = false;
        }
      }
      shown = next;
      apply();
      if (settled) {
        stopRaf();
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  const play = () => {
    if (reduced()) {
      shown = { sep: 1, tilt: 1, lab: 1 };
      target = { sep: 1, tilt: 1, lab: 1 };
      apply();
      fig.classList.remove('is-run');
      return;
    }
    playing = true;
    stopRaf();
    fig.classList.add('is-run');
    const t0 = performance.now();
    const frame = (now: number) => {
      if (signal.aborted || !playing) {
        stopRaf();
        return;
      }
      const pose = poseAt(now - t0);
      if (!pose) {
        playing = false;
        shown = { sep: 0, tilt: 0, lab: 0 };
        target = { sep: 0, tilt: 0, lab: 0 };
        apply();
        stopRaf();
        return;
      }
      shown = pose;
      target = pose;
      apply();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  };

  const markFar = () => {
    const far = fig.querySelector<HTMLImageElement>('.depth-stack__far');
    if (far && far.naturalWidth > 0) fig.classList.add('has-far');
  };

  const ensureImages = () => {
    if (imagesArmed) return;
    imagesArmed = true;
    for (const img of lazy) {
      const src = img.dataset.src;
      if (!src || img.getAttribute('src')) continue;
      if (img.dataset.srcset) img.srcset = img.dataset.srcset;
      if (img.dataset.sizes) img.sizes = img.dataset.sizes;
      img.src = src;
      if (img.classList.contains('depth-stack__far')) {
        if (img.complete && img.naturalWidth > 0) markFar();
        else img.addEventListener('load', markFar, { signal });
      }
    }
    markFar();
  };

  const takeOver = (sep: number) => {
    fig.dataset.played = '1';
    playing = false;
    stopRaf();
    ensureImages();
    target = poseFor(sep);
    kick();
  };

  rangeLabel.removeAttribute('hidden');
  range.disabled = false;
  replay.hidden = false;
  replay.removeAttribute('aria-hidden');
  fig.classList.add('is-on');

  range.addEventListener('pointerdown', () => {
    rangeHold = true;
    fig.dataset.played = '1';
    playing = false;
    stopRaf();
  }, { signal });
  const releaseRange = () => {
    rangeHold = false;
  };
  range.addEventListener('pointerup', releaseRange, { signal });
  range.addEventListener('pointercancel', releaseRange, { signal });
  range.addEventListener('input', () => {
    takeOver(clamp01(Number(range.value)));
  }, { signal });
  range.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') {
      playing = false;
    }
  }, { signal });

  replay.addEventListener('click', () => {
    ensureImages();
    play();
  }, { signal });

  view.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      sep: shown.sep,
      axis: null,
      touch: event.pointerType === 'touch',
    };
    if (!drag.touch) event.preventDefault();
  }, { signal });

  view.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.axis) {
      if (Math.hypot(dx, dy) < 8) return;
      if (drag.touch && Math.abs(dy) >= Math.abs(dx)) {
        drag = null;
        return;
      }
      drag.axis = !drag.touch && Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
      try {
        view.setPointerCapture(event.pointerId);
      } catch {
        /* pointer already gone */
      }
      fig.classList.add('is-drag');
    }
    if (drag.touch) event.preventDefault();
    const width = view.getBoundingClientRect().width || 1;
    const delta = drag.axis === 'y' ? drag.y - event.clientY : event.clientX - drag.x;
    takeOver(drag.sep + delta / (width * 0.72));
  }, { signal, passive: false });

  const endDrag = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null;
    fig.classList.remove('is-drag');
  };
  view.addEventListener('pointerup', endDrag, { signal });
  view.addEventListener('pointercancel', endDrag, { signal });

  const relayout = () => {
    if (shown.sep > 0.4 || shown.lab > 0.15) place();
  };
  window.addEventListener('resize', relayout, { signal });
  const ro = new ResizeObserver(relayout);
  ro.observe(view);
  void document.fonts?.ready.then(() => {
    if (!signal.aborted) relayout();
  });

  mq.addEventListener('change', () => {
    if (!reduced()) return;
    playing = false;
    stopRaf();
    shown = { sep: target.sep, tilt: target.tilt, lab: target.lab };
    apply();
  }, { signal });

  const io = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    io.disconnect();
    ensureImages();
    if (fig.dataset.played === '1') return;
    fig.dataset.played = '1';
    if (reduced() || still === 'open') {
      shown = { sep: 1, tilt: 1, lab: 1 };
      target = { sep: 1, tilt: 1, lab: 1 };
      apply();
      requestAnimationFrame(place);
      return;
    }
    if (still === 'flat' || fig.dataset.autoplay === '0') {
      apply();
      return;
    }
    play();
  }, { threshold: 0.5 });
  io.observe(view);

  signal.addEventListener('abort', () => {
    io.disconnect();
    ro.disconnect();
    stopRaf();
  });
}

initDepthStack();
document.addEventListener('astro:after-swap', initDepthStack);
