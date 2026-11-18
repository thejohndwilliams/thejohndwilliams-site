// TEMPORARY CI diagnostic for PR #112. Delete before merge.
import { test } from '@playwright/test';

// Each variant removes nodes as the parser inserts them, before first paint.
const VARIANTS: Record<string, string> = {
  asis: '',
  noEnfCard: 'a[href="/work/enforcement-gates/"]|card',
  noEnfPicture: 'a[href="/work/enforcement-gates/"]|picture',
  noSrOnly: '.glass-luminous .sr-only|self',
  noAgentPicture: 'a[href="/work/agent-governance/"]|picture',
  noAllCardPictures: '.glass-luminous picture|self',
  noHeroPicture: 'section[data-hero-under] picture|self',
};

async function frames(page: any) {
  return page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        let n = 0;
        const t0 = performance.now();
        const step = (t: number) => { n++; if (t - t0 < 2000) requestAnimationFrame(step); else resolve(`f=${n}`); };
        requestAnimationFrame(step);
        setTimeout(() => resolve(`TIMEOUT f=${n}`), 8000);
      }),
  );
}

test('debug: which node stalls /work frames', async ({ browser }) => {
  test.setTimeout(400000);
  const out: string[] = [];
  for (let rep = 0; rep < 2; rep++) {
    for (const [name, spec] of Object.entries(VARIANTS)) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const page = await ctx.newPage();
      if (spec) {
        await page.addInitScript((s: string) => {
          const [sel, mode] = s.split('|');
          const zap = () => {
            document.querySelectorAll(mode === 'self' ? sel : sel).forEach((el) => {
              let target: Element | null = el;
              if (mode === 'card') target = el.closest('.glass-luminous');
              if (mode === 'picture') target = el.closest('.glass-luminous')?.querySelector('picture') ?? null;
              target?.remove();
            });
          };
          new MutationObserver(zap).observe(document, { childList: true, subtree: true });
        }, spec);
      }
      await page.goto('/work/');
      await page.waitForTimeout(1500);
      const top = await frames(page);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.45));
      await page.waitForTimeout(1500);
      const mid = await frames(page);
      out.push(`${rep} ${name}: top ${top} mid ${mid}`);
      await ctx.close();
    }
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    await page.goto('https://thejohndwilliams.com/work/');
    await page.waitForTimeout(1500);
    const top = await frames(page);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.45));
    await page.waitForTimeout(1500);
    out.push(`${rep} production: top ${top} mid ${await frames(page)}`);
    await ctx.close();
  }
  throw new Error('DEBUG REPORT\n' + out.join('\n'));
});
