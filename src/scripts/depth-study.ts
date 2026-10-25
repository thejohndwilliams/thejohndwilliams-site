// One depth subject, one rendering. The photograph stays in the frame
// until Planes or Points is chosen, and only that plate is mounted.
// KineticPlate and KineticPlate3D mount whatever is in the document
// when they init, and again on astro:after-swap. Cloning a <template>
// and dispatching that event is the remount they already use. Scroll is
// restored in the same turn because the Lenis handler sends the page
// to the top. The other mode, and the other subjects, stay in templates
// so a resting visit does not open a WebGL context.

let depthAbort: AbortController | null = null;

type Mode = 'rest' | 'planes' | 'points';
type Orient = 'portrait' | 'landscape' | 'square';
type PlatePart = 'hologram' | 'cloud';

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

function asMode(value: string | null): Mode {
  if (value === 'planes' || value === 'points' || value === 'rest') return value;
  return 'rest';
}

function asOrient(value: string | null): Orient | null {
  if (value === 'portrait' || value === 'landscape' || value === 'square') return value;
  return null;
}

function platePart(mode: Mode): PlatePart | null {
  switch (mode) {
    case 'rest':
      return null;
    case 'planes':
      return 'hologram';
    case 'points':
      return 'cloud';
    default: {
      const neverMode: never = mode;
      return neverMode;
    }
  }
}

function takePart(tpl: HTMLTemplateElement, part: string): Node[] {
  const src = tpl.content.querySelector<HTMLElement>(`[data-part="${part}"]`);
  if (!src) return [];
  const copy = src.cloneNode(true) as HTMLElement;
  return [...copy.childNodes];
}

function show(root: HTMLElement, id: string, mode: Mode): void {
  const currentId = root.getAttribute('data-subject') || 'earth';
  const currentMode = asMode(root.getAttribute('data-mode'));
  if (currentId === id && currentMode === mode) return;

  const frame = root.querySelector<HTMLElement>('[data-depth-frame]');
  const photoHost = root.querySelector<HTMLElement>('[data-depth-photo]');
  const plateHost = root.querySelector<HTMLElement>('[data-depth-plate]');
  const tpl = root.querySelector<HTMLTemplateElement>(
    `template[data-study-tpl="${CSS.escape(id)}"]`,
  );
  if (!frame || !photoHost || !plateHost || !tpl) return;

  if (currentId !== id) photoHost.replaceChildren(...takePart(tpl, 'photo'));

  const nextPart = platePart(mode);
  const prevPart = platePart(currentMode);
  const plateChanged = nextPart !== prevPart || (nextPart !== null && currentId !== id);
  if (plateChanged) plateHost.replaceChildren(...(nextPart ? takePart(tpl, nextPart) : []));

  const orient = asOrient(
    root.querySelector<HTMLButtonElement>(`button[data-study="${CSS.escape(id)}"]`)?.getAttribute('data-orient') ?? null,
  );
  root.setAttribute('data-subject', id);
  if (orient) root.setAttribute('data-orient', orient);
  root.setAttribute('data-mode', mode);
  frame.setAttribute('data-mode', mode);

  root.querySelectorAll<HTMLButtonElement>('button[data-study]').forEach((btn) => {
    btn.setAttribute('aria-pressed', btn.getAttribute('data-study') === id ? 'true' : 'false');
  });
  root.querySelectorAll<HTMLButtonElement>('button[data-depth-mode]').forEach((btn) => {
    btn.setAttribute('aria-pressed', btn.getAttribute('data-depth-mode') === mode ? 'true' : 'false');
  });
  root.querySelectorAll<HTMLElement>('[data-study-note]').forEach((note) => {
    note.classList.toggle('is-shown', note.getAttribute('data-study-note') === id);
  });

  if (!plateChanged) return;
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
        if (!id) return;
        show(root, id, asMode(root.getAttribute('data-mode')));
      },
      { signal },
    );
  });

  root.querySelectorAll<HTMLButtonElement>('button[data-depth-mode]').forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        const next = asMode(btn.getAttribute('data-depth-mode'));
        if (next === 'rest') return;
        const id = root.getAttribute('data-subject') || 'earth';
        const current = asMode(root.getAttribute('data-mode'));
        show(root, id, current === next ? 'rest' : next);
      },
      { signal },
    );
  });
}
