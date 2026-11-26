import { test, expect } from '@playwright/test';

// The decision console runs the same rule as the worked-cases table.
// Keyboard only: CI WebKit starves animation frames mid-page (see
// content.spec.ts), so clicks there never settle.
test.describe('Verification gate case study', () => {
  test('the console blocks a prose answer and passes two cited passes', async ({ page }) => {
    await page.goto('/work/verification-gate/');
    const consoleEl = page.locator('[data-vg-console]');
    const decision = consoleEl.locator('[data-vg-decision]');
    await expect(decision).toHaveText('Pass');
    const prose = consoleEl.locator('[data-reviewer="B"] [data-ret="prose"]');
    await prose.focus();
    await page.keyboard.press('Enter');
    await expect(prose).toHaveAttribute('aria-pressed', 'true');
    await expect(decision).toHaveText('Blocked');
    await expect(consoleEl.locator('[data-vg-reasons]')).toContainText('answered in prose');
    const back = consoleEl.locator('[data-reviewer="B"] [data-ret="pass"]');
    await back.focus();
    await page.keyboard.press('Enter');
    await expect(decision).toHaveText('Pass');
  });

  test('the worked cases render without script', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/work/verification-gate/');
    await expect(page.locator('.vg-cases tbody tr')).toHaveCount(6);
    await expect(page.locator('[data-vg-live]')).toBeHidden();
    await ctx.close();
  });
});
