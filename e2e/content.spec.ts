import { test, expect } from '@playwright/test';

test.describe('Homepage Content', () => {
  test('displays profile section', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1:has-text("John D. Williams")')).toBeVisible();
  });

  test('displays tagline', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=DATA')).toBeVisible();
  });

  test('displays social links', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a[href*="linkedin.com"]').first()).toBeVisible();
    await expect(page.locator('a[href*="github.com"]').first()).toBeVisible();
  });

  test('contact link is present', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a[href*="mailto:"]')).toBeVisible();
  });
});

test.describe('Work Page Content', () => {
  test('displays projects', async ({ page }) => {
    await page.goto('/work');
    await expect(page.locator('text=Enterprise Analytics Platform')).toBeVisible();
  });

  test('displays expertise section', async ({ page }) => {
    await page.goto('/work');
    const pythonElements = page.locator('text=Python');
    await expect(pythonElements.first()).toBeVisible();
  });
});

test.describe('Writing Page Content', () => {
  test('displays blog post listing', async ({ page }) => {
    await page.goto('/writing');
    await expect(page.locator('a[href="/writing/dashboard-nobody-uses"]')).toBeVisible();
  });

  test('displays coming soon posts', async ({ page }) => {
    await page.goto('/writing');
    const comingElements = page.locator('text=Coming');
    await expect(comingElements.first()).toBeVisible();
  });
});

test.describe('Blog Post Content', () => {
  test('displays post title', async ({ page }) => {
    await page.goto('/writing/dashboard-nobody-uses');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('displays formatted date', async ({ page }) => {
    await page.goto('/writing/dashboard-nobody-uses');
    await expect(page.locator('time')).toBeVisible();
  });

  test('displays read time', async ({ page }) => {
    await page.goto('/writing/dashboard-nobody-uses');
    const readElements = page.locator('text=read');
    await expect(readElements.first()).toBeVisible();
  });
});

test.describe('Footer', () => {
  test('displays copyright with current year', async ({ page }) => {
    await page.goto('/');
    const currentYear = new Date().getFullYear().toString();
    await expect(page.locator(`text=${currentYear}`).first()).toBeVisible();
  });

  test('displays social links in footer', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer.locator('a[href*="linkedin.com"]')).toBeVisible();
    await expect(footer.locator('a[href*="github.com"]')).toBeVisible();
  });

  test('external links have correct attributes', async ({ page }) => {
    await page.goto('/');
    const externalLinks = page.locator('footer a[target="_blank"]');
    const count = await externalLinks.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const link = externalLinks.nth(i);
      await expect(link).toHaveAttribute('rel', /noopener/);
    }
  });
});
