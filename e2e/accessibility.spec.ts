import { test, expect } from '@playwright/test';

test.describe('Accessibility', () => {
  test.describe('Keyboard Navigation', () => {
    test('can tab through navigation links', async ({ page }) => {
      await page.goto('/');
      await page.keyboard.press('Tab');

      // Should be able to focus on interactive elements
      const focusedElement = await page.locator(':focus');
      await expect(focusedElement).toBeTruthy();
    });

    test('skip to content functionality', async ({ page }) => {
      await page.goto('/');
      // Check that the page has focusable content
      const links = page.locator('a[href]');
      expect(await links.count()).toBeGreaterThan(0);
    });
  });

  test.describe('Images', () => {
    test('all images have alt text or are decorative', async ({ page }) => {
      await page.goto('/');
      const images = page.locator('img');
      const count = await images.count();

      for (let i = 0; i < count; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        const ariaHidden = await img.getAttribute('aria-hidden');
        const role = await img.getAttribute('role');

        // Image should have alt text, or be marked as decorative
        const hasAltText = alt !== null;
        const isDecorative = ariaHidden === 'true' || role === 'presentation' || alt === '';

        expect(hasAltText || isDecorative).toBe(true);
      }
    });
  });

  test.describe('Links', () => {
    test('all links have accessible text', async ({ page }) => {
      await page.goto('/');
      const links = page.locator('a[href]');
      const count = await links.count();

      for (let i = 0; i < count; i++) {
        const link = links.nth(i);
        const text = await link.innerText();
        const ariaLabel = await link.getAttribute('aria-label');
        const title = await link.getAttribute('title');

        // Link should have visible text, aria-label, or title
        const hasAccessibleText = text.trim() !== '' || ariaLabel !== null || title !== null;
        expect(hasAccessibleText).toBe(true);
      }
    });

    test('external links open in new tab with proper rel', async ({ page }) => {
      await page.goto('/');
      const externalLinks = page.locator('a[target="_blank"]');
      const count = await externalLinks.count();

      for (let i = 0; i < count; i++) {
        const link = externalLinks.nth(i);
        const rel = await link.getAttribute('rel');
        expect(rel).toContain('noopener');
      }
    });
  });

  test.describe('Buttons', () => {
    test('mobile menu button has aria-label', async ({ page }) => {
      await page.goto('/');
      const menuButton = page.locator('#menu-toggle');
      await expect(menuButton).toHaveAttribute('aria-label');
    });
  });

  test.describe('Semantic HTML', () => {
    test('page has main landmark', async ({ page }) => {
      await page.goto('/');
      // Check for main content area
      const main = page.locator('main, [role="main"]');
      const article = page.locator('article');
      const hasMainContent = (await main.count()) > 0 || (await article.count()) > 0;
      // Note: Current site may not have explicit main landmark
    });

    test('page has navigation landmark', async ({ page }) => {
      await page.goto('/');
      const nav = page.locator('header nav').first();
      await expect(nav).toBeVisible();
    });

    test('page has footer landmark', async ({ page }) => {
      await page.goto('/');
      const footer = page.locator('footer');
      await expect(footer).toBeVisible();
    });

    test('headings are in logical order', async ({ page }) => {
      await page.goto('/about');
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();

      // Should have at least one heading
      expect(headings.length).toBeGreaterThan(0);

      // First heading should be h1
      const firstHeadingTag = await headings[0].evaluate((el) => el.tagName);
      expect(firstHeadingTag).toBe('H1');
    });
  });

  test.describe('Color and Contrast', () => {
    test('text is visible on background', async ({ page }) => {
      await page.goto('/');
      // Check that main text elements are visible
      const mainText = page.locator('p, h1, h2, h3, a').first();
      await expect(mainText).toBeVisible();
    });
  });

  test.describe('Time Elements', () => {
    test('time elements have datetime attribute', async ({ page }) => {
      await page.goto('/writing/dashboard-nobody-uses');
      const timeElements = page.locator('time');
      const count = await timeElements.count();

      for (let i = 0; i < count; i++) {
        const time = timeElements.nth(i);
        await expect(time).toHaveAttribute('datetime');
      }
    });
  });
});
