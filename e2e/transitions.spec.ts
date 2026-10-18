// Directional page drift. The name lives in the bundled stylesheet, so
// chromium can sample ::view-transition-* (page) animations during a
// client navigation. WebKit and iPhone do not expose those pseudos the
// same way, so this file runs on chromium only.
import { test, expect, type Page } from '@playwright/test';

async function armDriftSampler(page: Page) {
  await page.evaluate(() => {
    const w = window as Window & { __driftNames?: string[] };
    w.__driftNames = [];
    const seen = new Set<string>();
    const grab = () => {
      for (const anim of document.getAnimations()) {
        const effect = anim.effect;
        if (!effect || !('pseudoElement' in effect)) continue;
        const pseudo = (effect as KeyframeEffect).pseudoElement || '';
        if (!pseudo.includes('page')) continue;
        const name = 'animationName' in anim ? String((anim as CSSAnimation).animationName) : '';
        if (!name || seen.has(pseudo + name)) continue;
        seen.add(pseudo + name);
        w.__driftNames!.push(name);
      }
    };
    const until = performance.now() + 2500;
    const loop = () => {
      grab();
      if (performance.now() < until) requestAnimationFrame(loop);
    };
    loop();
    document.addEventListener('astro:after-swap', () => {
      grab();
      requestAnimationFrame(grab);
      requestAnimationFrame(() => requestAnimationFrame(grab));
    }, { once: true });
  });
}

async function driftNames(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as Window & { __driftNames?: string[] }).__driftNames || []);
}

test.describe('directional page drift', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'view-transition pseudo sampling is chromium');
  });

  test('forward nav drifts out left, history back drifts out right', async ({ page }) => {
    await page.goto('/');
    await armDriftSampler(page);
    await page.locator('header a[href="/about"]:visible').first().click();
    await expect(page).toHaveURL(/\/about\/?$/);
    await expect.poll(async () => driftNames(page), { timeout: 3000 }).toContain('page-drift-out-left');

    await armDriftSampler(page);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(async () => driftNames(page), { timeout: 3000 }).toContain('page-drift-out-right');
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('reduced motion has no drift animation names', async ({ page }) => {
      await page.goto('/');
      await armDriftSampler(page);
      await page.locator('header a[href="/about"]:visible').first().click();
      await expect(page).toHaveURL(/\/about\/?$/);
      // Cover the 300ms drift window, then confirm no drift names landed.
      await page.waitForTimeout(600);
      const names = await driftNames(page);
      expect(names.filter((name) => name.includes('page-drift'))).toEqual([]);
    });
  });
});
