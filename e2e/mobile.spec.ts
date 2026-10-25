// Rewritten 2026-06-11. The old suite tested #menu-toggle / #mobile-menu —
// the hamburger retired 2026-05-30 (and the bottom tab bar retired
// 2026-06-06; nav now lives in the top glass header as .m-nav-item icons).
import { test, expect } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test.describe('Mobile navigation (top glass header)', () => {
  test('icon nav links are present and tappable', async ({ page }) => {
    await page.goto('/');
    const items = page.locator('header .m-nav-item:visible');
    // Four section icons plus the Contact mailto. Same count as the Inquire key.
    expect(await items.count()).toBe(5);
    await expect(page.locator('header a.m-nav-item[aria-label="Contact"]')).toBeVisible();
    await page.locator('header .m-nav-item[href="/about/"]').click();
    await expect(page).toHaveURL(/\/about\/?$/);
  });

  test('theme toggle flips aria-pressed', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('button.theme-toggle:visible').first();
    const before = await toggle.getAttribute('aria-pressed');
    await toggle.click();
    await expect(toggle).toHaveAttribute(
      'aria-pressed',
      before === 'true' ? 'false' : 'true',
    );
  });
});

test.describe('Mobile layout integrity', () => {
  for (const route of ['/', '/photography', '/work', '/about']) {
    test(`no horizontal overflow on ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(() => {
        const docW = Math.max(
          document.documentElement.scrollWidth,
          document.body.scrollWidth,
        );
        return docW - window.innerWidth;
      });
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
