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

  test('Contact mailto is reachable', async ({ page }) => {
    await page.goto('/');
    const mailto = page.locator('a[href="mailto:jndwcreative@gmail.com"]:visible');
    await expect(mailto.first()).toBeVisible();
    await expect(page.locator('header')).toContainText('Contact');
    await expect(page.locator('footer')).toContainText('Contact');
    await expect(page.getByRole('link', { name: 'Contact' }).first()).toBeVisible();
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

  test('links the agent governance case study', async ({ page, browserName }) => {
    await page.goto('/work/');
    const link = page.locator('a[href="/work/agent-governance/"]');
    await expect(link).toBeVisible();
    if (browserName === 'webkit') {
      // 2026-11-17 (PR #112): CI WebKit stops producing animation frames
      // once /work is scrolled mid-page. Measured in CI: 125 frames in 2s
      // at the top, 0 to 2 mid-page, on PRODUCTION as well as the branch.
      // Click stability and the view transition both wait on frames, so a
      // click there never completes. macOS Safari runs the same page at
      // 60fps. Chromium below still proves the click; here, prove the
      // link and its destination.
      await expect(link).toHaveAttribute('href', '/work/agent-governance/');
      await page.goto('/work/agent-governance/');
    } else {
      await link.click();
    }
    await expect(page).toHaveURL(/\/work\/agent-governance\/?$/);
    await expect(page.locator('h1')).toContainText('Human Oversight for a Multi-Agent System');
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

test.describe('Links (bio)', () => {
  test('/links/ is a real document, not a 404', async ({ page }) => {
    const res = await page.goto('/links/');
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('John D. Williams');
    await expect(page.locator('#content a[href="/photography/"]')).toBeVisible();
    await expect(page.locator('#content').getByRole('link', { name: 'Contact' })).toBeVisible();
    await expect(page.locator('a[href*="linkedin.com"]').first()).toBeVisible();
  });
});
