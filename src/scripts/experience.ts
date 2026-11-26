/**
 * experience.ts - the record on /work (src/components/ExperienceRecord.astro).
 *
 * Two jobs, both optional enhancements:
 * 1. A playhead sweeps the time axis as the section arrives, so each span
 *    draws from its start date to where time has reached (--play, 0 to 1).
 *    Scroll drives it; scrolling back rewinds it. Reduced motion: whole.
 * 2. Pointing at, focusing or opening an entry lights its span, so the
 *    list and the ribbon read as one object.
 * Rows are native <details>; they open without this file.
 */
import { ease, runScenes, span } from './scrub';

let abort: AbortController | null = null;

function teardown(): void {
  abort?.abort();
  abort = null;
}

export function initExperience(): void {
  teardown();
  const root = document.querySelector<HTMLElement>('[data-xp]');
  const ribbon = root?.querySelector<HTMLElement>('[data-xp-ribbon]');
  if (!root || !ribbon) return;
  abort = new AbortController();
  const { signal } = abort;

  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-xp-item]'));
  const spanFor = (id: string) => ribbon.querySelector<HTMLElement>(`[data-xp-span="${id}"]`);

  const light = (item: HTMLElement, on: boolean) => {
    const id = item.dataset.xpItem!;
    const open = item.querySelector('details')?.open ?? false;
    const lit = on || open;
    item.classList.toggle('is-lit', lit);
    spanFor(id)?.classList.toggle('is-lit', lit);
  };

  const nativeKeywordSize =
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('interpolate-size', 'allow-keywords');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  for (const item of items) {
    item.addEventListener('pointerenter', () => light(item, true), { signal });
    item.addEventListener('pointerleave', () => light(item, false), { signal });
    item.addEventListener('focusin', () => light(item, true), { signal });
    item.addEventListener('focusout', () => light(item, false), { signal });
    const details = item.querySelector<HTMLDetailsElement>('details');
    const summary = details?.querySelector<HTMLElement>('summary');
    const body = details?.querySelector<HTMLElement>('.xp-entry__body');
    details?.addEventListener('toggle', () => light(item, item.matches(':hover')), { signal });

    // Progressive WAAPI disclosure for engines without ::details-content
    // keyword interpolation (Safari / WebKit), matching the 360ms damped curve.
    if (details && summary && body && !nativeKeywordSize) {
      let anim: Animation | null = null;
      const clearInline = () => {
        body.style.height = '';
        body.style.opacity = '';
        body.style.overflow = '';
      };
      summary.addEventListener('click', (e) => {
        if (reduceMotion.matches) return;
        anim?.cancel();
        anim = null;
        if (details.open) {
          e.preventDefault();
          const startH = body.offsetHeight;
          body.style.overflow = 'hidden';
          anim = body.animate(
            [
              { height: `${startH}px`, opacity: 1 },
              { height: '0px', opacity: 0 },
            ],
            { duration: 260, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
          );
          anim.onfinish = () => {
            anim = null;
            details.open = false;
            clearInline();
            light(item, item.matches(':hover'));
          };
          anim.oncancel = () => {
            clearInline();
          };
        } else {
          e.preventDefault();
          details.open = true;
          light(item, true);
          const endH = body.offsetHeight;
          body.style.overflow = 'hidden';
          anim = body.animate(
            [
              { height: '0px', opacity: 0 },
              { height: `${endH}px`, opacity: 1 },
            ],
            { duration: 340, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
          );
          anim.onfinish = () => {
            anim = null;
            clearInline();
          };
          anim.oncancel = () => {
            clearInline();
          };
        }
      }, { signal });
    }

    // Pointing at a span on the ribbon lights its row too.
    const s = spanFor(item.dataset.xpItem!);
    s?.addEventListener('pointerenter', () => light(item, true), { signal });
    s?.addEventListener('pointerleave', () => light(item, false), { signal });
  }

  runScenes([
    {
      el: ribbon,
      mode: 'enter',
      from: 0.92,
      to: 0.4,
      render(p) {
        ribbon.style.setProperty('--play', ease(span(p, 0, 1)).toFixed(4));
      },
    },
  ], signal);

  // Print (2026-11-24): the printed Work page carries every role's line.
  window.addEventListener('beforeprint', () => {
    root.querySelectorAll<HTMLDetailsElement>('details.xp-entry').forEach((d) => { d.open = true; });
  }, { signal });
  document.addEventListener('astro:before-swap', teardown, { once: true, signal });
}

initExperience();
document.addEventListener('astro:after-swap', initExperience);
