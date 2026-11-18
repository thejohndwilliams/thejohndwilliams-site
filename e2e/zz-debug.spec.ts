// TEMPORARY CI diagnostic for PR #112. Delete before merge.
import { test } from '@playwright/test';

const URLS = [
  '/work/',
  'https://thejohndwilliams.com/work/',
  '/',
  '/about/',
  '/links/',
  '/work/agent-governance/',
  '/work/enforcement-gates/',
];

test('debug: rAF liveness by page', async ({ page }) => {
  test.setTimeout(240000);
  const out: string[] = [];
  for (const url of URLS) {
    try {
      await page.goto(url, { timeout: 30000 });
    } catch (e: any) {
      out.push(`${url}: goto failed ${e.message.slice(0, 80)}`);
      continue;
    }
    const r = await page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          let n = 0;
          const t0 = performance.now();
          const step = (t: number) => { n++; if (t - t0 < 2000) requestAnimationFrame(step); else resolve(`frames=${n}`); };
          requestAnimationFrame(step);
          setTimeout(() => resolve(`TIMEOUT frames=${n}`), 12000);
        }),
    );
    const vis = await page.evaluate(() => `${document.visibilityState} hidden=${document.hidden} sh=${document.documentElement.scrollHeight}`);
    out.push(`${url}: ${r} ${vis}`);
  }
  throw new Error('DEBUG REPORT\n' + out.join('\n'));
});
