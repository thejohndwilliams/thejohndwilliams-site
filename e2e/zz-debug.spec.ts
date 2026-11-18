// TEMPORARY CI diagnostic for PR #112. Delete before merge.
import { test } from '@playwright/test';

const CONDITIONS: Record<string, string> = {
  baseline: '',
  noCanvas: 'canvas{display:none!important}',
  noBackdrop: '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
  noFilter: '*,*::before,*::after{filter:none!important}',
  noImages: 'img,picture{visibility:hidden!important}',
  noEnfCard: '.glass-luminous:has(a[href="/work/enforcement-gates/"]){display:none!important}',
  noAgentImg: '.glass-luminous:has(a[href="/work/agent-governance/"]) img{display:none!important}',
  noShadow: '*,*::before,*::after{box-shadow:none!important}',
};

test('debug: frame cost by condition', async ({ page }) => {
  test.setTimeout(240000);
  const out: string[] = [];
  for (const [name, css] of Object.entries(CONDITIONS)) {
    await page.goto('/work/');
    if (css) await page.addStyleTag({ content: css });
    await page.locator('a[href="/work/agent-governance/"]').evaluate((a) => a.scrollIntoView({ block: 'center' }));
    const r = await page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          const gaps: number[] = [];
          let last = performance.now();
          const t0 = last;
          const step = (t: number) => {
            gaps.push(t - last);
            last = t;
            if (t - t0 < 3000 && gaps.length < 400) requestAnimationFrame(step);
            else resolve(`frames=${gaps.length} maxGap=${Math.max(...gaps).toFixed(0)} medGap=${gaps.sort((a, b) => a - b)[gaps.length >> 1].toFixed(1)}`);
          };
          requestAnimationFrame(step);
          setTimeout(() => resolve(`TIMEOUT frames=${gaps.length} lastGap=${(performance.now() - last).toFixed(0)}`), 20000);
        }),
    );
    out.push(`${name}: ${r}`);
  }
  // Top of page (no scroll) for reference.
  await page.goto('/work/');
  const top = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        let n = 0;
        const t0 = performance.now();
        const step = (t: number) => { n++; if (t - t0 < 2000) requestAnimationFrame(step); else resolve(`frames=${n}`); };
        requestAnimationFrame(step);
        setTimeout(() => resolve(`TIMEOUT frames=${n}`), 20000);
      }),
  );
  out.push(`topOfPage: ${top}`);
  throw new Error('DEBUG REPORT\n' + out.join('\n'));
});
