// The decision console on /work/verification-gate/. Runs the same decide()
// the page's static table uses. Without this script the console stays
// hidden and the worked-cases table carries the rule.
import { decide, type Returned, type ReviewerInput, type Severity } from '../utils/verification-gate';

let abort: AbortController | null = null;

function init(): void {
  abort?.abort();
  const root = document.querySelector<HTMLElement>('[data-vg-console]');
  if (!root) return;
  const live = root.querySelector<HTMLElement>('[data-vg-live]');
  const out = root.querySelector<HTMLElement>('[data-vg-decision]');
  const list = root.querySelector<HTMLElement>('[data-vg-reasons]');
  if (!live || !out || !list) return;
  abort = new AbortController();
  const { signal } = abort;
  live.hidden = false;

  let severity: Severity = 'strict';
  const reviewers = Array.from(root.querySelectorAll<HTMLFieldSetElement>('[data-reviewer]'));
  const state: ReviewerInput[] = reviewers.map(() => ({ returned: 'pass', cited: true, downgraded: false }));

  const render = (): void => {
    reviewers.forEach((fs, i) => {
      const cited = fs.querySelector<HTMLInputElement>('[data-cited]');
      if (cited) cited.disabled = state[i].returned !== 'pass';
    });
    const d = decide(state, severity);
    out.textContent = d.decision === 'PASS' ? 'Pass' : 'Blocked';
    root.dataset.decision = d.decision.toLowerCase();
    list.replaceChildren();
    const lines = d.blockers.length ? d.blockers : d.caveats.length ? d.caveats : ['Both reviewers cited raw evidence for the claim'];
    for (const line of lines) {
      const li = document.createElement('li');
      li.textContent = line + '.';
      if (d.blockers.length) li.className = 'is-blocker';
      list.append(li);
    }
  };

  const press = (group: Element, btn: HTMLButtonElement): void => {
    group.querySelectorAll<HTMLButtonElement>('.vg-opt').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  };

  root.querySelectorAll<HTMLButtonElement>('[data-sev]').forEach((btn) => {
    btn.addEventListener('click', () => {
      severity = btn.dataset.sev as Severity;
      press(btn.parentElement!, btn);
      render();
    }, { signal });
  });

  reviewers.forEach((fs, i) => {
    fs.querySelectorAll<HTMLButtonElement>('[data-ret]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state[i].returned = btn.dataset.ret as Returned;
        press(btn.parentElement!, btn);
        render();
      }, { signal });
    });
    fs.querySelector<HTMLInputElement>('[data-cited]')?.addEventListener('change', (e) => {
      state[i].cited = (e.target as HTMLInputElement).checked;
      render();
    }, { signal });
    fs.querySelector<HTMLInputElement>('[data-down]')?.addEventListener('change', (e) => {
      state[i].downgraded = (e.target as HTMLInputElement).checked;
      render();
    }, { signal });
  });

  render();
}

document.addEventListener('astro:page-load', init);
