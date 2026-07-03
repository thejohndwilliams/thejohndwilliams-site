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

  test('footer carries the scripture citation; socials live on the page', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toContainText('15:13');
    // Socials moved out of the footer into the Connect section during the
    // 2026-06 redesigns; this suite had never run green on main, so the
    // stale footer assertion survived. The stable structure worth locking
    // is their presence on the homepage. (CI-red repair, 2026-07-03)
    await expect(page.locator('a[href*="linkedin.com"]').first()).toBeVisible();
    await expect(page.locator('a[href*="github.com"]').first()).toBeVisible();
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
    const tile = page.locator('[data-src^="/images/photography/hero/"]').first();
    await tile.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800); // gallery init binds post-load; scroll settles
    await tile.click();
    // WebKit on CI hardware needs patience for the open/close morphs.
    await expect(page.locator('#lightbox')).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).not.toBeVisible({ timeout: 10000 });
  });
});
