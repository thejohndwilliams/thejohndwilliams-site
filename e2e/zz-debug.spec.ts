// TEMPORARY CI diagnostic for PR #112. Delete before merge.
import { test } from '@playwright/test';

test('debug: work link stability', async ({ page }) => {
  await page.goto('/work/');
  const link = page.locator('a[href="/work/agent-governance/"]');
  await link.scrollIntoViewIfNeeded();
  const samples = await page.evaluate(async () => {
    const a = document.querySelector('a[href="/work/agent-governance/"]') as HTMLElement;
    const out: string[] = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 3000) {
      await new Promise((r) => requestAnimationFrame(r));
      const r = a.getBoundingClientRect();
      const l = (window as any).__lenis;
      out.push([
        Math.round(performance.now() - t0),
        r.top.toFixed(2), r.left.toFixed(2), r.width.toFixed(2), r.height.toFixed(2),
        window.scrollY.toFixed(2),
        document.documentElement.scrollHeight,
        l ? `${l.isScrolling}|${l.targetScroll?.toFixed?.(2)}|${l.animatedScroll?.toFixed?.(2)}|${l.limit?.toFixed?.(2)}` : 'nolenis',
        document.documentElement.className,
      ].join(' '));
    }
    return out;
  });
  const pick = samples.filter((_, i) => i % 10 === 0 || i > samples.length - 5);
  console.log('SAMPLES\n' + pick.join('\n'));
  // Card ancestry transforms/animations
  const info = await page.evaluate(() => {
    const a = document.querySelector('a[href="/work/agent-governance/"]') as HTMLElement;
    const rows: string[] = [];
    let el: HTMLElement | null = a;
    while (el && el !== document.body) {
      const cs = getComputedStyle(el);
      rows.push(`${el.tagName}.${el.className.toString().slice(0, 60)} t=${cs.transform} o=${cs.opacity} anim=${el.getAnimations().map((x) => (x as any).animationName || (x as any).transitionProperty || 'a').join(',')}`);
      el = el.parentElement;
    }
    const all = document.getAnimations().map((x: any) => `${x.animationName || x.transitionProperty} ${x.playState} ${(x.effect?.target as HTMLElement)?.className?.toString().slice(0, 40)}`);
    return rows.join('\n') + '\nALL ANIMS:\n' + all.join('\n');
  });
  console.log(info);
});
