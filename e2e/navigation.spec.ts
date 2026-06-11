// Rewritten 2026-06-11 (foundation session). The previous suite tested the
// hamburger-era DOM (retired 2026-05-30) and had rotted into fiction because
// nothing ever ran it. These specs were verified against the built dist
// markup and run on chromium + webkit + iphone via playwright.config.ts.
import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('homepage loads correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/John D. Williams/);
  });

  test('can navigate to About', async ({ page }) => {
    await page.goto('/');
    await page.locator('header a[href="/about"]:visible').first().click();
    await expect(page).toHaveURL(/\/about\/?$/);
    await expect(page).toHaveTitle(/About/);
  });

  test('can navigate to Work', async ({ page }) => {
    await page.goto('/');
    await page.locator('header a[href="/work"]:visible').first().click();
    await expect(page).toHaveURL(/\/work\/?$/);
    await expect(page.locator('h1')).toContainText('Selected Work');
  });

  test('can navigate to Photography', async ({ page }) => {
    await page.goto('/');
    await page.locator('header a[href="/photography"]:visible').first().click();
    await expect(page).toHaveURL(/\/photography\/?$/);
    await expect(page).toHaveTitle(/Photography/);
  });

  test('header wordmark links to homepage', async ({ page }) => {
    await page.goto('/about');
    await page.locator('header a[href="/"]:visible').first().click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('404 Page', () => {
  test('displays 404 for non-existent pages', async ({ page }) => {
    const response = await page.goto('/non-existent-page');
    expect(response?.status()).toBe(404);
  });

  test('404 page contains home link', async ({ page }) => {
    await page.goto('/404');
    await expect(page.locator('a[href="/"]').first()).toBeVisible();
  });
});
