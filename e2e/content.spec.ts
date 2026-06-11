// Rewritten 2026-06-11. The old suite asserted the "DATA · SECURITY ·
// DECISIONS" tagline (removed 2026-04-22) and an Enterprise Analytics
// project card (gone in the 2026-06-06 /work redesign). Copy is locked by
// the vitest suites; e2e locks BEHAVIOR and presence of stable structures.
import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('displays the name', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1:has-text("John D. Williams")')).toBeVisible();
  });

  test('Inquire mailto is reachable', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a[href^="mailto:"]:visible').first()).toBeVisible();
  });

  test('footer carries the scripture citation and socials', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toContainText('15:13');
    await expect(footer.locator('a[href*="linkedin.com"]').first()).toBeVisible();
    await expect(footer.locator('a[href*="github.com"]').first()).toBeVisible();
  });

  test('footer copyright shows the current year', async ({ page }) => {
    await page.goto('/');
    const year = new Date().getFullYear().toString();
    await expect(page.locator('footer')).toContainText(year);
  });
});

test.describe('Work page', () => {
  test('renders Selected Work', async ({ page }) => {
    await page.goto('/work');
    await expect(page.locator('h1')).toContainText('Selected Work');
  });
});

test.describe('Photography gallery + lightbox', () => {
  test('gallery renders a substantial tile set', async ({ page }) => {
    await page.goto('/photography');
    const tiles = page.locator('[data-src^="/images/photography/hero/"]');
    expect(await tiles.count()).toBeGreaterThan(50);
  });

  test('lightbox opens from a tile and closes on Escape', async ({ page }) => {
    await page.goto('/photography');
    await page.waitForTimeout(600); // gallery init binds after page load
    await page.locator('[data-src^="/images/photography/hero/"]').first().click();
    await expect(page.locator('#lightbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).not.toBeVisible();
  });
});
