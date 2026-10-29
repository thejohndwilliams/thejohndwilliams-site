/**
 * depth-scrub.ts - behaviour for the DepthScrub figure on /beyond.
 *
 * One figure, seven stops. Two stacked <picture> frames (a / b) alternate so
 * every stop change is a 120 ms crossfade. The figure plays once from 1 mm to
 * 14 mm when it first enters the viewport (about 3 s), holds the last stop
 * briefly, then rests at 4 mm. Any slider input cancels the play. Reduced
 * motion: no play, no crossfade, rest at 4 mm, Replay never shown.
 *
 * Lifecycle (view transitions): call initDepthScrub() on astro:page-load; it
 * tears the previous instance down first (observer disconnect, timers
 * cleared, listeners aborted) so a detached page tree never keeps running.
 */
const DEPTHS_MM = [1, 2, 3, 4, 6, 9, 14] as const;
const STEP_MS = 400;
const HOLD_LAST_MS = 650;
const FADE_MS = 120;
const PREFETCH_MARGIN = '600px 0px';

let scrubAbort: AbortController | null = null;
let scrubObserver: IntersectionObserver | null = null;
let timers: number[] = [];
let prefetched = false;
// Module-level so the depth study's synthetic astro:after-swap (fired when a
// plate mounts, see depth-study.ts) re-inits this figure without replaying
// it. A real navigation fires astro:before-swap first and resets it.
let playedOnce = false;

function clearTimers(): void {
  for (const t of timers) window.clearTimeout(t);
  timers = [];
}

function frameSrc(mm: number, ext: 'avif' | 'webp'): string {
  return `/images/relief/depth-${mm}mm.${ext}`;
}

function teardown(): void {
  scrubAbort?.abort();
  scrubAbort = null;
  scrubObserver?.disconnect();
  scrubObserver = null;
  clearTimers();
}

function onBeforeSwap(): void {
  teardown();
  playedOnce = false;
}

export function initDepthScrub(): void {
  teardown();
  const root = document.querySelector<HTMLElement>('[data-depth-scrub]');
  if (!root) return;

  const range = root.querySelector<HTMLInputElement>('[data-scrub-range]');
  const output = root.querySelector<HTMLOutputElement>('[data-scrub-output]');
  const replay = root.querySelector<HTMLButtonElement>('[data-scrub-replay]');
  const frames = Array.from(root.querySelectorAll<HTMLPictureElement>('.depth-scrub__frame'));
  if (!range || !output || frames.length !== 2) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rest = Number(root.dataset.rest ?? '3');
  // Read the resting state back from the DOM: a synthetic re-init must not
  // snap a scrubbed figure back to 4 mm.
  let active = Math.max(0, frames.findIndex((f) => f.classList.contains('is-active')));
  let current = Number(frames[active].dataset.index ?? String(rest));
  let playing = false;
  let played = playedOnce;

  scrubAbort = new AbortController();
  const { signal } = scrubAbort;

  function load(pic: HTMLPictureElement, mm: number): void {
    const source = pic.querySelector<HTMLSourceElement>('[data-src-avif]');
    const img = pic.querySelector<HTMLImageElement>('[data-src-webp]');
    if (source) source.srcset = frameSrc(mm, 'avif');
    if (img) img.src = frameSrc(mm, 'webp');
  }

  function show(index: number): void {
    const next = Math.max(0, Math.min(DEPTHS_MM.length - 1, index));
    const mm = DEPTHS_MM[next];
    const label = `${mm} mm`;
    range!.value = String(next);
    range!.setAttribute('aria-valuetext', label);
    output!.textContent = label;
    root!.querySelectorAll<HTMLElement>('.bfig__tick').forEach((t) => {
      t.classList.toggle('is-current', Number(t.dataset.i) === next);
    });
    if (next === current && frames[active].dataset.index === String(next)) return;
    current = next;
    if (reduced) {
      load(frames[active], mm);
      frames[active].dataset.index = String(next);
      return;
    }
    const incoming = frames[1 - active];
    const outgoing = frames[active];
    const img = incoming.querySelector<HTMLImageElement>('img');
    // A newer stop can arrive before this frame has decoded (a slow network
    // during the play). The handler is a property, not a listener, so the
    // newest request always owns the swap and a stale decode never flips
    // the frames twice.
    if (img) {
      img.onload = null;
      img.onerror = null;
    }
    load(incoming, mm);
    incoming.dataset.index = String(next);
    const swap = () => {
      if (img) {
        img.onload = null;
        img.onerror = null;
      }
      if (incoming.dataset.index !== String(next)) return;
      incoming.classList.add('is-active');
      incoming.removeAttribute('aria-hidden');
      outgoing.classList.remove('is-active');
      outgoing.setAttribute('aria-hidden', 'true');
      active = 1 - active;
    };
    if (img && !img.complete) {
      img.onload = swap;
      img.onerror = swap;
    } else {
      swap();
    }
  }

  function prefetchAll(): void {
    if (prefetched) return;
    prefetched = true;
    for (const mm of DEPTHS_MM) {
      const i = new Image();
      i.src = frameSrc(mm, 'webp');
    }
  }

  function stopPlay(): void {
    clearTimers();
    playing = false;
  }

  function play(): void {
    if (reduced) return;
    stopPlay();
    playing = true;
    played = true;
    playedOnce = true;
    prefetchAll();
    DEPTHS_MM.forEach((_, i) => {
      timers.push(window.setTimeout(() => show(i), i * STEP_MS));
    });
    const end = DEPTHS_MM.length * STEP_MS + HOLD_LAST_MS;
    timers.push(
      window.setTimeout(() => {
        show(rest);
        playing = false;
        if (replay) {
          replay.hidden = false;
          replay.removeAttribute('aria-hidden');
        }
      }, end),
    );
  }

  range.addEventListener(
    'input',
    () => {
      if (playing) stopPlay();
      prefetchAll();
      show(Number(range.value));
      if (replay && !reduced && played) {
        replay.hidden = false;
        replay.removeAttribute('aria-hidden');
      }
    },
    { signal },
  );

  replay?.addEventListener('click', () => play(), { signal });

  document.addEventListener('astro:before-swap', onBeforeSwap, { once: true, signal });

  if (reduced) {
    show(rest);
    return;
  }

  // Same control row as the layer figure above: the slider and Replay are
  // there from the start. Reduced motion never shows a control that would
  // do nothing.
  if (replay) {
    replay.hidden = false;
    replay.removeAttribute('aria-hidden');
  }

  // Already played on this page (synthetic re-init): keep the figure where
  // the visitor left it and do not arm the autoplay again.
  if (played) return;

  scrubObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.intersectionRatio > 0) prefetchAll();
        if (e.intersectionRatio >= 0.5 && !played) {
          play();
          scrubObserver?.disconnect();
        }
      }
    },
    { rootMargin: PREFETCH_MARGIN, threshold: [0, 0.5] },
  );
  scrubObserver.observe(root);
}

/** Exposed for the page bootstrap and tests. */
export const depthScrubFade = FADE_MS;
