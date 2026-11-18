import { expect, test } from '@playwright/test';

// The scroll story on /work/enforcement-gates/ (src/scripts/enforcement-story.ts).
// Scroll position drives the steps; reduced motion gets the static page.

async function scrollStory(page: import('@playwright/test').Page, fraction: number) {
  await page.evaluate((f) => {
    const s = document.querySelector('[data-enf-scrolly]')!;
    const stage = document.querySelector<HTMLElement>('[data-enf-stage]')!;
    const hh = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 88;
    const top = s.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top - hh + (s.getBoundingClientRect().height - stage.offsetHeight) * f);
  }, fraction);
}

test.describe('Enforcement scroll story', () => {
  test('scrolling walks the figure through the steps', async ({ page, browserName }) => {
    // CI WebKit stops producing animation frames mid-page (measured on
    // /work, production included, 2026-11-17). The story renders on
    // requestAnimationFrame, so its scroll behaviour is proven on Chromium.
    test.skip(browserName === 'webkit', 'CI WebKit starves rAF mid-page');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/work/enforcement-gates/');
    const fig = page.locator('[data-enf-figure]');
    await expect(fig).toHaveAttribute('data-ready', '');
    await expect(fig).toHaveClass(/is-scrolly/);

    await scrollStory(page, 0.02);
    await expect(fig).toHaveAttribute('data-scene', '0');
    await expect(page.locator('[data-story-step]').nth(0)).toHaveClass(/is-active/);
    // Inbox: dots are displaced from their plotted positions.
    const moved = await page.locator('[data-enf-svg] g > circle[transform]').count();
    expect(moved).toBeGreaterThan(500);

    await scrollStory(page, 0.52);
    await expect(fig).toHaveAttribute('data-scene', '4');
    await expect(fig).toHaveAttribute('data-focus', 'wrong');
    await expect(page.locator('[data-story-step]').nth(4)).toHaveClass(/is-active/);
    // From the gate step on, every dot sits at its true position.
    await expect(page.locator('[data-enf-svg] g > circle[transform]')).toHaveCount(0);

    await scrollStory(page, 0.99);
    await expect(fig).toHaveAttribute('data-scene', '7');
    await expect(fig).toHaveAttribute('data-focus', '');
  });

  test('reduced motion keeps the static page', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.goto('/work/enforcement-gates/');
    const fig = page.locator('[data-enf-figure]');
    await expect(fig).toHaveAttribute('data-ready', '');
    await expect(fig).not.toHaveClass(/is-scrolly/);
    for (let i = 0; i < 8; i++) await expect(page.locator('[data-story-step]').nth(i)).toBeVisible();
    await expect(page.locator('[data-run-n]')).toHaveText('381');
    await expect(page.locator('[data-run-lb]')).toHaveText('99.0%');
    await expect(page.locator('[data-enf-svg] g > circle[transform]')).toHaveCount(0);
    await context.close();
  });
});
