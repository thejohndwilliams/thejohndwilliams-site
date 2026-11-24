import { test, expect } from '@playwright/test';

// iPhone Duo (owner order 2026-11-24). Closed it is 466 x 678 points,
// 678 x 466 held sideways; open it is 951 x 669, 669 x 951 upright.
// Every hero title must clear the header, and no page may scroll sideways.
const POSES: Array<[string, number, number]> = [
  ['closed', 466, 678],
  ['closed, sideways', 678, 466],
  ['open', 951, 669],
  ['open, upright', 669, 951],
];
const PAGES = ['/', '/work/', '/work/enforcement-gates/', '/work/verification-gate/', '/work/agent-governance/', '/about/', '/photography/', '/beyond/'];

for (const [pose, width, height] of POSES) {
  test.describe(`iPhone Duo ${pose} (${width}x${height})`, () => {
    test.use({ viewport: { width, height } });
    for (const path of PAGES) {
      test(`${path}: title clears the header, no sideways scroll`, async ({ page }) => {
        await page.goto(path);
        const h1 = page.locator('h1').first();
        await expect(h1).toBeVisible();
        const headerBottom = await page.locator('#site-header').evaluate((el) => el.getBoundingClientRect().bottom);
        const h1Top = await h1.evaluate((el) => el.getBoundingClientRect().top);
        expect(h1Top, `${path} h1 top vs header bottom`).toBeGreaterThanOrEqual(headerBottom);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(over, `${path} overflow`).toBeLessThanOrEqual(0);
      });
    }
  });
}
