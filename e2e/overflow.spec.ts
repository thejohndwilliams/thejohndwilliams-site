// Mobile overflow lock (doctrine audit, 2026-07-28). The relief sweep grid's
// implicit auto track sized to max-content and dragged the document wider
// than 390px phones: display headline, body lines, and the panel all clipped
// at the right edge. A quiet-luxury page that clips its own headline mid-word
// is broken, whatever else it does. This suite pins document width to the
// viewport on every core page, at every engine and viewport CI runs.
import { test, expect, type Page } from '@playwright/test';

const PAGES = ['/', '/photography/', '/work/', '/about/', '/beyond/', '/links/'];

async function documentOverflow(page: Page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    return Math.max(d.scrollWidth - d.clientWidth, document.body.scrollWidth - d.clientWidth);
  });
}

for (const path of PAGES) {
  test(`no horizontal overflow on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await documentOverflow(page);
    expect(overflow, `document is ${overflow}px wider than the viewport on ${path}`).toBeLessThanOrEqual(0);
  });
}

// Tablet widths sit between the phone icon nav and a word nav that fits.
// 820x1180, 768x1024, and 1024x768 are the sizes where the header and the
// /work hero were measured past the viewport.
const TABLET = [
  { width: 820, height: 1180 },
  // 820 with a classic scrollbar lays out at about 805. That is the width
  // where Contact was measured past the right edge.
  { width: 805, height: 1180 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
] as const;
const TABLET_PAGES = ['/', '/beyond/', '/about/', '/work/'] as const;

for (const viewport of TABLET) {
  for (const path of TABLET_PAGES) {
    test(`no horizontal overflow on ${path} at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await documentOverflow(page);
      expect(overflow, `document is ${overflow}px wider than ${viewport.width}px on ${path}`).toBeLessThanOrEqual(0);

      const header = await page.evaluate(() => {
        const d = document.documentElement;
        const jw = document.querySelector('#site-header a[aria-label="John D. Williams, home"]');
        const photo = document.querySelector('#site-header nav ul a');
        const inquire = document.querySelector('#site-header a[href^="mailto:"]');
        const box = (el: Element | null) => (el ? el.getBoundingClientRect() : null);
        const jwBox = box(jw);
        const photoBox = box(photo);
        const inquireBox = box(inquire);
        return {
          clientWidth: d.clientWidth,
          gap: jwBox && photoBox ? photoBox.left - jwBox.right : null,
          inquireRight: inquireBox ? inquireBox.right : null,
        };
      });
      expect(header.gap, `wordmark meets the first link on ${path}`).not.toBeNull();
      expect(header.gap!, `wordmark meets Photography on ${path} at ${viewport.width}`).toBeGreaterThanOrEqual(16);
      expect(header.inquireRight, `Contact missing on ${path}`).not.toBeNull();
      expect(header.inquireRight!, `Contact crosses the viewport on ${path} at ${viewport.width}`).toBeLessThanOrEqual(header.clientWidth);

      if (path === '/work/') {
        const links = page.locator('a', { hasText: 'View on GitHub' });
        const count = await links.count();
        expect(count).toBeGreaterThan(0);
        for (let i = 0; i < count; i++) {
          const box = await links.nth(i).boundingBox();
          expect(box, `github link ${i} has no box`).not.toBeNull();
          expect(box!.width, `github link ${i} is squeezed on ${path} at ${viewport.width}`).toBeGreaterThanOrEqual(100);
          expect(box!.height, `github link ${i} wraps on ${path} at ${viewport.width}`).toBeLessThanOrEqual(56);
        }
      }
    });
  }
}

test('the /work Beyond sentence link is a 44px target at 390', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/work/');
  await page.waitForLoadState('networkidle');
  const box = await page.locator('main p a[href="/beyond/"]', { hasText: 'Beyond' }).boundingBox();
  expect(box, 'Beyond sentence link has no box').not.toBeNull();
  expect(box!.width, 'Beyond sentence link is narrower than 44px').toBeGreaterThanOrEqual(44);
  expect(box!.height, 'Beyond sentence link is shorter than 44px').toBeGreaterThanOrEqual(44);
});
