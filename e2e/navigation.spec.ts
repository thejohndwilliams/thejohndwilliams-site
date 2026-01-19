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

  test('can navigate to Writing page', async ({ page }) => {
    await page.goto('/');
    await page.click('header a[href="/writing"]');
    await expect(page).toHaveURL('/writing');
  });

  test('can navigate to Links page', async ({ page }) => {
    await page.goto('/');
    await page.click('header a[href="/links"]');
    await expect(page).toHaveURL('/links');
  });

  test('header logo links to homepage', async ({ page }) => {
    await page.goto('/about');
    await page.click('a:has-text("JW")');
    await expect(page).toHaveURL('/');
  });

  test('can navigate to blog post from Writing page', async ({ page }) => {
    await page.goto('/writing');
    await page.click('a[href="/writing/dashboard-nobody-uses"]');
    await expect(page).toHaveURL('/writing/dashboard-nobody-uses');
  });

  test('blog post back link works', async ({ page }) => {
    await page.goto('/writing/dashboard-nobody-uses');
    await page.click('a:has-text("Back to Writing")');
    await expect(page).toHaveURL('/writing');
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
