import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('homepage loads correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/John D. Williams/);
  });

  test('can navigate to About page', async ({ page }) => {
    await page.goto('/');
    await page.click('header a[href="/about"]');
    await expect(page).toHaveURL('/about');
    await expect(page.locator('h1')).toContainText('About');
  });

  test('can navigate to Work page', async ({ page }) => {
    await page.goto('/');
    await page.click('header a[href="/work"]');
    await expect(page).toHaveURL('/work');
  });

  test('header logo links to homepage', async ({ page }) => {
    await page.goto('/about');
    await page.click('a:has-text("JW")');
    await expect(page).toHaveURL('/');
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
