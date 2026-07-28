// Mobile overflow lock (doctrine audit, 2026-07-28). The relief sweep grid's
// implicit auto track sized to max-content and dragged the document wider
// than 390px phones: display headline, body lines, and the panel all clipped
// at the right edge. A quiet-luxury page that clips its own headline mid-word
// is broken, whatever else it does. This suite pins document width to the
// viewport on every core page, at every engine and viewport CI runs.
import { test, expect } from '@playwright/test';

const PAGES = ['/', '/photography/', '/work/', '/about/', '/relief/'];

for (const path of PAGES) {
  test(`no horizontal overflow on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => {
      const d = document.documentElement;
      return Math.max(d.scrollWidth - d.clientWidth, document.body.scrollWidth - d.clientWidth);
    });
    expect(overflow, `document is ${overflow}px wider than the viewport on ${path}`).toBeLessThanOrEqual(0);
  });
}
