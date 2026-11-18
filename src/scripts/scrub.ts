/**
 * scrub.ts - scroll position drives the picture, not time.
 *
 * Each scene maps an element's place in the viewport to a progress value
 * between 0 and 1 and renders that state. Scrolling back plays the scene
 * backwards. One passive scroll listener and one requestAnimationFrame per
 * change: Lenis moves the window scroll, so its smooth glide arrives here as
 * ordinary scroll events. Nothing runs while the page is still.
 *
 * Reduced motion: scenes are rendered once at progress 1 and never again.
 */

export type Scene = {
  el: Element;
  /** 'pin': progress across a tall container whose child sticks.
   *  'enter': progress as the element's top travels from `from` to `to`
   *  (fractions of the viewport height, measured from the top). */
  mode: 'pin' | 'enter' | 'exit';
  from?: number;
  to?: number;
  pinned?: () => number;
  render: (p: number) => void;
  last?: number;
};

const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Map p inside [a, b] to 0..1. */
export const span = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

export function motionAllowed(): boolean {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function headerH(): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--header-h');
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : 88;
}

function progressOf(s: Scene, vh: number): number {
  const r = s.el.getBoundingClientRect();
  if (s.mode === 'pin') {
    const top = headerH();
    const travel = r.height - (s.pinned ? s.pinned() : vh - top);
    return travel > 0 ? clamp((top - r.top) / travel) : 1;
  }
  if (s.mode === 'exit') return clamp(-r.top / Math.max(1, r.height));
  const from = (s.from ?? 0.9) * vh;
  const to = (s.to ?? 0.3) * vh;
  return clamp((from - r.top) / (from - to));
}

export function runScenes(scenes: Scene[], signal: AbortSignal): void {
  if (!scenes.length) return;
  if (!motionAllowed()) {
    for (const s of scenes) s.render(1);
    return;
  }
  let raf = 0;
  const frame = () => {
    raf = 0;
    const vh = window.innerHeight;
    for (const s of scenes) {
      const p = progressOf(s, vh);
      if (p !== s.last) {
        s.last = p;
        s.render(p);
      }
    }
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };
  window.addEventListener('scroll', kick, { passive: true, signal });
  window.addEventListener('resize', () => {
    for (const s of scenes) s.last = undefined;
    kick();
  }, { passive: true, signal });
  signal.addEventListener('abort', () => {
    if (raf) cancelAnimationFrame(raf);
  });
  frame();
}
