// Flag-on layout lock. The production preview on :4321 is built with the
// flag off, so this file talks to the static preview in playwright.config.ts
// that sets PUBLIC_SHOW_CASE_STUDY=true.
import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:4391' });

const WIDTHS = [1440, 820, 390] as const;

for (const width of WIDTHS) {
  test(`case study placeholder does not overflow at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/work/');
    await page.waitForLoadState('networkidle');

    const block = page.locator('.case-study');
    await expect(block).toBeVisible();
    await expect(page.locator('main h1')).toContainText('Selected Work');

    const lines = (await block.innerText())
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    expect(lines).toEqual(['Case study title', 'Paragraph', 'Paragraph', 'Paragraph']);

    expect(await block.locator('img').count()).toBe(0);
    const frame = block.locator('.case-study-frame');
    await expect(frame).toBeVisible();

    const order = await page.evaluate(() => {
      const title = document.querySelector('.case-study-title');
      const h1 = document.querySelector('main h1');
      if (!title || !h1) return false;
      return (title.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    });
    expect(order).toBe(true);

    const type = await page.evaluate(() => {
      const title = getComputedStyle(document.querySelector('.case-study-title') as Element);
      const body = getComputedStyle(document.querySelector('.case-study-body p') as Element);
      const section = getComputedStyle(document.querySelector('.case-study') as Element);
      return {
        title: title.fontFamily,
        body: body.fontFamily,
        ground: section.backgroundColor,
        titleColor: title.color,
      };
    });
    expect(type.title.toLowerCase()).toContain('eb garamond');
    expect(type.body.toLowerCase()).toContain('ibm plex sans');
    expect(type.ground).toBe('rgb(10, 10, 10)');
    expect(type.titleColor).toBe('rgb(244, 234, 222)');

    const measure = await page.locator('.case-study-body').evaluate((el) => {
      const max = parseFloat(getComputedStyle(el).maxWidth);
      const probe = document.createElement('span');
      probe.textContent = '0';
      probe.style.font = getComputedStyle(el.querySelector('p') as Element).font;
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      document.body.appendChild(probe);
      const ch = probe.getBoundingClientRect().width;
      probe.remove();
      return { max, sixtyFive: 65 * ch };
    });
    expect(Math.abs(measure.max - measure.sixtyFive)).toBeLessThan(1.5);

    const overflow = await page.evaluate(() => {
      const d = document.documentElement;
      return Math.max(d.scrollWidth - d.clientWidth, document.body.scrollWidth - d.clientWidth);
    });
    expect(overflow, `document is ${overflow}px wider than the viewport at ${width}`).toBeLessThanOrEqual(0);

    const box = await frame.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    expect(box!.width).toBeGreaterThan(120);
  });
}
