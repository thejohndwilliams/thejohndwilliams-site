// Swaps the one live depth pair. KineticPlate and KineticPlate3D mount
// whatever is in the document when they init, and again on astro:after-swap.
// Their modules are shared with the plate-measurement fix, so this page
// does not edit them. Cloning a <template> and dispatching that event is
// the remount they already use for view transitions. Scroll is restored
// in the same turn because the Lenis handler sends the page to the top.

let depthAbort: AbortController | null = null;

type LenisLike = {
  scrollTo?: (target: number, opts: { immediate: boolean }) => void;
};

function restoreScroll(y: number): void {
  const lenis = (window as Window & { __lenis?: LenisLike }).__lenis;
  if (lenis && typeof lenis.scrollTo === 'function') {
    lenis.scrollTo(y, { immediate: true });
  }
  window.scrollTo(0, y);
}

function showStudy(root: HTMLElement, id: string): void {
  const pressed = root.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
  if (pressed && pressed.getAttribute('data-study') === id) return;

  const hologram = root.querySelector<HTMLElement>('[data-depth-hologram]');
  const cloud = root.querySelector<HTMLElement>('[data-depth-cloud]');
  const tpl = root.querySelector<HTMLTemplateElement>(
    `template[data-study-tpl="${CSS.escape(id)}"]`,
  );
  if (!hologram || !cloud || !tpl) return;

  const frag = tpl.content.cloneNode(true) as DocumentFragment;
  const nextHologram = frag.querySelector<HTMLElement>('[data-part="hologram"]');
  const nextCloud = frag.querySelector<HTMLElement>('[data-part="cloud"]');
  if (!nextHologram || !nextCloud) return;
  hologram.replaceChildren(...nextHologram.childNodes);
  cloud.replaceChildren(...nextCloud.childNodes);

  root.querySelectorAll<HTMLButtonElement>('button[data-study]').forEach((btn) => {
    btn.setAttribute('aria-pressed', btn.getAttribute('data-study') === id ? 'true' : 'false');
  });
  root.querySelectorAll<HTMLElement>('[data-study-note]').forEach((note) => {
    note.classList.toggle('is-shown', note.getAttribute('data-study-note') === id);
  });

  const y = window.scrollY;
  document.dispatchEvent(new Event('astro:after-swap'));
  restoreScroll(y);
  requestAnimationFrame(() => restoreScroll(y));
}

export function initDepthStudy(): void {
  depthAbort?.abort();
  const root = document.querySelector<HTMLElement>('[data-depth-study]');
  if (!root) return;

  depthAbort = new AbortController();
  const { signal } = depthAbort;
  root.setAttribute('data-depth-ready', '');

  root.querySelectorAll<HTMLButtonElement>('button[data-study]').forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        const id = btn.getAttribute('data-study');
        if (id) showStudy(root, id);
      },
      { signal },
    );
  });
}
