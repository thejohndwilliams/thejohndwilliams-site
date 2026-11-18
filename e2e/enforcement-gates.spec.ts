import { expect, test, type Page } from '@playwright/test';

const WIDTHS = [390, 820, 1440] as const;

async function overflowPx(page: Page): Promise<number> {
  return page.evaluate(() => {
    const d = document.documentElement;
    return Math.max(d.scrollWidth - d.clientWidth, document.body.scrollWidth - d.clientWidth);
  });
}

test.describe('Enforcement gates figure', () => {
  for (const width of WIDTHS) {
    test(`hydrates and End/Home stay inside ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto('/work/enforcement-gates/');
      const fig = page.locator('[data-enf-figure]');
      await fig.scrollIntoViewIfNeeded();
      const svg = fig.locator('[data-enf-svg]');
      await expect(svg).toHaveAttribute('viewBox', /.+/);
      await expect(fig).toHaveAttribute('data-ready', '');
      await expect(svg.locator('circle').first()).toBeAttached();
      await expect(fig.locator('.enf-bands')).toBeVisible();
      await expect(fig.locator('.enf-key')).toBeVisible();
      expect(await overflowPx(page), `${width} at rest`).toBeLessThanOrEqual(0);

      if (width === 390) {
        const boxes = await fig.locator('.enf-stepper__btn').evaluateAll((nodes) => nodes.map((node) => {
          const r = node.getBoundingClientRect();
          return { w: r.width, h: r.height };
        }));
        expect(boxes.length).toBe(4);
        for (const box of boxes) {
          expect(box.w).toBeGreaterThanOrEqual(44);
          expect(box.h).toBeGreaterThanOrEqual(44);
        }
      }

      for (const name of ['Review floor', 'Auto-action gate']) {
        const handle = fig.getByRole('slider', { name });
        await handle.focus();
        const before = await handle.getAttribute('aria-valuenow');
        const x0 = (await handle.boundingBox())?.x ?? 0;
        await page.keyboard.press('End');
        const atEnd = await handle.getAttribute('aria-valuenow');
        const x1 = (await handle.boundingBox())?.x ?? 0;
        expect(atEnd, `${name} End value`).not.toBe(before);
        expect(Math.abs(x1 - x0), `${name} End moved`).toBeGreaterThan(1);
        expect(await overflowPx(page), `${name} End ${width}`).toBeLessThanOrEqual(0);
        await page.keyboard.press('Home');
        const atHome = await handle.getAttribute('aria-valuenow');
        const x2 = (await handle.boundingBox())?.x ?? 0;
        expect(atHome, `${name} Home value`).not.toBe(atEnd);
        expect(Math.abs(x2 - x1), `${name} Home moved`).toBeGreaterThan(1);
        expect(await overflowPx(page), `${name} Home ${width}`).toBeLessThanOrEqual(0);
      }
    });
  }

  test('step buttons move a gate and Reset returns focus', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 900 });
    await page.goto('/work/enforcement-gates/');
    const fig = page.locator('[data-enf-figure]');
    await fig.scrollIntoViewIfNeeded();
    await expect(fig).toHaveAttribute('data-ready', '');
    const review = fig.getByRole('slider', { name: 'Review floor' });
    const auto = fig.getByRole('slider', { name: 'Auto-action gate' });
    const reviewStart = await review.getAttribute('aria-valuenow');
    const autoStart = await auto.getAttribute('aria-valuenow');

    await fig.getByRole('button', { name: 'Raise review gate' }).click();
    await expect(review).toHaveAttribute('aria-valuenow', String(Number(reviewStart) + 1));
    await fig.getByRole('button', { name: 'Lower review gate' }).click();
    await expect(review).toHaveAttribute('aria-valuenow', reviewStart);

    await fig.getByRole('button', { name: 'Raise auto-action gate' }).click();
    await expect(auto).toHaveAttribute('aria-valuenow', String(Number(autoStart) + 1));
    await fig.getByRole('button', { name: 'Lower auto-action gate' }).click();
    await expect(auto).toHaveAttribute('aria-valuenow', autoStart);

    await fig.getByRole('button', { name: 'Raise review gate' }).click();
    const reset = fig.locator('[data-enf-reset]');
    await expect(reset).toBeVisible();
    await reset.click();
    await expect(review).toHaveAttribute('aria-valuenow', reviewStart);
    await expect(review).toBeFocused();
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 500)));
    await expect(fig.locator('[data-enf-live]')).toHaveText('');
  });

  test('published slider values are in the document without script', async ({ browser }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 820, height: 900 },
    });
    const page = await context.newPage();
    await page.goto('/work/enforcement-gates/');
    const review = page.getByRole('slider', { name: 'Review floor' });
    const auto = page.getByRole('slider', { name: 'Auto-action gate' });
    expect(Number(await review.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
    expect(Number(await auto.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
    await expect(review).toHaveAttribute('aria-valuetext', /Review floor at score \d/);
    await expect(auto).toHaveAttribute('aria-valuetext', /Precision \d/);
    const box = await page.locator('.enf-plot').boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThan(120);
    expect(box!.height).toBeLessThan(box!.width);
    await context.close();
  });
});
