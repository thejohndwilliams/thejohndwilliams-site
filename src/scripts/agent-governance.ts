// Progressive enhancement for the agent-governance figures.
// No-JS and reduced motion keep the static SVG. Listeners ride one
// AbortController so astro:after-swap cannot stack them.

let abort: AbortController | null = null;

function restoreFallback(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-gov-live]').forEach((el) => {
    el.setAttribute('hidden', '');
  });
  root.querySelectorAll<HTMLElement>('[data-gov-fallback]').forEach((el) => {
    el.removeAttribute('hidden');
  });
}

function revealLive(figure: HTMLElement): void {
  figure.querySelector('[data-gov-fallback]')?.setAttribute('hidden', '');
  figure.querySelector('[data-gov-live]')?.removeAttribute('hidden');
}

function mountStepper(figure: HTMLElement, signal: AbortSignal): void {
  const tablist = figure.querySelector<HTMLElement>('[role="tablist"]');
  if (!tablist) return;
  const tabs = Array.from(tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const panels = tabs.map((tab) => {
    const id = tab.getAttribute('aria-controls');
    return id ? document.getElementById(id) : null;
  });
  const escalate = figure.querySelector<HTMLElement>('[data-gov-escalate]');
  if (tabs.length === 0) return;

  const select = (index: number, focus: boolean): void => {
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      panels[i]?.toggleAttribute('hidden', !on);
      if (on && focus) tab.focus();
    });
    const step = tabs[index]?.dataset.govStep ?? '';
    escalate?.classList.toggle('is-lit', step === 'risk' || step === 'approval');
  };

  tablist.addEventListener('keydown', (event) => {
    const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    let next = current;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % tabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    select(next, true);
  }, { signal });

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(index, false), { signal });
  });

  revealLive(figure);
  const initial = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
  select(initial >= 0 ? initial : 0, false);
}

function mountFilters(figure: HTMLElement, signal: AbortSignal): void {
  const group = figure.querySelector<HTMLElement>('[role="radiogroup"]');
  if (!group) return;
  const radios = Array.from(group.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
  const rows = Array.from(figure.querySelectorAll<HTMLTableRowElement>('tbody tr'));
  const status = figure.querySelector<HTMLElement>('[data-gov-status]');
  if (radios.length === 0) return;

  const apply = (index: number, focus: boolean, announce: boolean): void => {
    const name = radios[index]?.dataset.govFilter ?? 'All';
    radios.forEach((radio, i) => {
      const on = i === index;
      radio.setAttribute('aria-checked', on ? 'true' : 'false');
      radio.tabIndex = on ? 0 : -1;
      if (on && focus) radio.focus();
    });
    rows.forEach((row) => {
      const functions = (row.dataset.functions ?? '').split(/\s+/);
      const show = name === 'All' || functions.includes(name);
      row.toggleAttribute('hidden', !show);
    });
    if (announce && status) {
      status.textContent = name === 'All'
        ? 'Showing all controls.'
        : `Showing controls mapped to ${name}.`;
    }
  };

  group.addEventListener('keydown', (event) => {
    const current = radios.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    let next = current;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % radios.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + radios.length) % radios.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = radios.length - 1;
    else return;
    event.preventDefault();
    apply(next, true, true);
  }, { signal });

  radios.forEach((radio, index) => {
    radio.addEventListener('click', () => apply(index, false, true), { signal });
  });

  revealLive(figure);
  const initial = radios.findIndex((radio) => radio.getAttribute('aria-checked') === 'true');
  apply(initial >= 0 ? initial : 0, false, false);
}

function initAgentGovernance(): void {
  abort?.abort();
  const root = document.querySelector<HTMLElement>('[data-agent-governance]');
  if (!root) return;
  abort = new AbortController();
  const { signal } = abort;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  motion.addEventListener('change', initAgentGovernance, { signal });
  if (motion.matches) {
    restoreFallback(root);
    return;
  }
  root.querySelectorAll<HTMLElement>('[data-gov="gate"], [data-gov="audit"]').forEach((figure) => {
    mountStepper(figure, signal);
  });
  const map = root.querySelector<HTMLElement>('[data-gov="map"]');
  if (map) mountFilters(map, signal);
}

initAgentGovernance();
document.addEventListener('astro:after-swap', initAgentGovernance);
