import { test, expect } from '@playwright/test';

// Configure viewport for mobile testing (use viewport size instead of device preset)
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
});

test.describe('Mobile Navigation', () => {
  test('mobile menu toggle is visible on mobile', async ({ page }) => {
    await page.goto('/');
    const menuButton = page.locator('#menu-toggle');
    await expect(menuButton).toBeVisible();
  });

  test('mobile menu is hidden by default', async ({ page }) => {
    await page.goto('/');
    const mobileMenu = page.locator('#mobile-menu');
    // Check for exact 'hidden' class (not md:hidden which is a responsive breakpoint)
    await expect(mobileMenu).toHaveClass(/\bhidden\b/);
  });

  test('clicking menu toggle shows mobile menu', async ({ page }) => {
    await page.goto('/');
    await page.click('#menu-toggle');
    const mobileMenu = page.locator('#mobile-menu');
    // After clicking toggle, the 'hidden' class should be removed (md:hidden will remain)
    await expect(mobileMenu).toBeVisible();
  });

  test('mobile menu contains navigation links', async ({ page }) => {
    await page.goto('/');
    await page.click('#menu-toggle');
    await expect(page.locator('#mobile-menu a[href="/about"]')).toBeVisible();
    await expect(page.locator('#mobile-menu a[href="/work"]')).toBeVisible();
    await expect(page.locator('#mobile-menu a[href="/writing"]')).toBeVisible();
    await expect(page.locator('#mobile-menu a[href="/links"]')).toBeVisible();
  });

  test('can navigate via mobile menu', async ({ page }) => {
    await page.goto('/');
    await page.click('#menu-toggle');
    await page.click('#mobile-menu a[href="/about"]');
    await expect(page).toHaveURL('/about');
  });
});
