// TEMPORARY CI diagnostic for PR #112. Delete before merge.
import { test } from '@playwright/test';

test('debug: work link stability and navigation', async ({ page }) => {
  const log: string[] = [];
  page.on('console', (m) => log.push(`console.${m.type()}: ${m.text().slice(0, 200)}`));
  page.on('pageerror', (e) => log.push(`pageerror: ${e.message.slice(0, 300)}`));
  page.on('requestfailed', (r) => log.push(`reqfail: ${r.url()} ${r.failure()?.errorText}`));
  await page.goto('/work/');
  const link = page.locator('a[href="/work/agent-governance/"]');
  await link.scrollIntoViewIfNeeded();
  const samples = await page.evaluate(async () => {
    const a = document.querySelector('a[href="/work/agent-governance/"]') as HTMLElement;
    const out: string[] = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 2500) {
      await new Promise((r) => requestAnimationFrame(r));
      const r = a.getBoundingClientRect();
      const l = (window as any).__lenis;
      out.push([
        Math.round(performance.now() - t0),
        r.top.toFixed(2), r.left.toFixed(2), r.width.toFixed(2),
        window.scrollY.toFixed(2),
        document.documentElement.scrollHeight,
        l ? `${l.isScrolling}|${l.targetScroll?.toFixed?.(2)}|${l.animatedScroll?.toFixed?.(2)}|${l.limit?.toFixed?.(2)}` : 'nolenis',
        document.documentElement.className,
      ].join(' '));
    }
    return out;
  });
  log.push('SAMPLES', ...samples.filter((_, i) => i % 8 === 0 || i > samples.length - 4));
  const anims = await page.evaluate(() =>
    document.getAnimations().map((x: any) => `${x.animationName || x.transitionProperty} ${x.playState} ${(x.effect?.target as HTMLElement)?.className?.toString().slice(0, 50)}`).join('\n'));
  log.push('ANIMS', anims || '(none)');
  await page.evaluate(() => {
    const w = window as any;
    w.__ev = [];
    const t0 = performance.now();
    for (const n of ['astro:before-preparation', 'astro:after-preparation', 'astro:before-swap', 'astro:after-swap', 'astro:page-load']) {
      document.addEventListener(n, () => w.__ev.push(`${Math.round(performance.now() - t0)} ${n} ${location.pathname}`));
    }
    const vt = (document as any).startViewTransition;
    if (vt) {
      (document as any).startViewTransition = function (...args: any[]) {
        w.__ev.push(`${Math.round(performance.now() - t0)} startViewTransition called`);
        const t = vt.apply(document, args);
        t.ready?.then(() => w.__ev.push(`${Math.round(performance.now() - t0)} vt ready`), (e: any) => w.__ev.push(`vt ready rejected ${e}`));
        t.updateCallbackDone?.then(() => w.__ev.push(`${Math.round(performance.now() - t0)} vt updateDone`), (e: any) => w.__ev.push(`vt update rejected ${e}`));
        t.finished?.then(() => w.__ev.push(`${Math.round(performance.now() - t0)} vt finished`), (e: any) => w.__ev.push(`vt finished rejected ${e}`));
        return t;
      };
    } else {
      w.__ev.push('no startViewTransition');
    }
  });
  try {
    await link.click({ timeout: 5000, trial: true });
    log.push('trial click: actionable');
  } catch (e: any) {
    log.push('trial click failed: ' + e.message.split('\n').slice(0, 12).join(' | '));
  }
  await link.click({ force: true });
  await page.waitForTimeout(6000);
  log.push('URL after force click: ' + page.url());
  const ev = await page.evaluate(() => (window as any).__ev?.join('\n') ?? 'ev lost (full reload?)').catch((e) => 'eval failed ' + e);
  log.push('EVENTS', ev, 'HTMLCLASS ' + (await page.evaluate(() => document.documentElement.className + ' / ' + document.documentElement.getAttribute('data-astro-transition'))));
  throw new Error('DEBUG REPORT\n' + log.join('\n'));
});
