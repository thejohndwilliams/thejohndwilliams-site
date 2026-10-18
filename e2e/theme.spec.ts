// Theme chosen in the header must survive a client navigation.
// ClientRouter replaces every attribute on <html> from the incoming page
// (swapRootAttributes). theme.js does not re-run, so data-theme="black"
// is dropped unless a before-swap handler copies it onto the new document.
import { test, expect } from '@playwright/test';

test.describe('Theme across client navigation', () => {
  test('black theme stays set after navigating to about', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('button.theme-toggle:visible').first();
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'black');

    // A full reload would clear this. The header link must be a client swap.
    await page.evaluate(() => {
      (window as Window & { __clientNav?: string }).__clientNav = 'alive';
    });

    await page.locator('header a[href="/about"]:visible').first().click();
    await expect(page).toHaveURL(/\/about\/?$/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'black');
    await expect(page.locator('button.theme-toggle:visible').first()).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      await page.evaluate(() => (window as Window & { __clientNav?: string }).__clientNav),
    ).toBe('alive');
  });
});
