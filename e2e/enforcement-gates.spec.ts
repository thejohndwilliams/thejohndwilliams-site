import { expect, test, type Page } from '@playwright/test';

async function overflowPx(page: Page): Promise<number> {
  return page.evaluate(() => {
    const d = document.documentElement;
    return Math.max(d.scrollWidth - d.clientWidth, document.body.scrollWidth - d.clientWidth);
  });
}

test.describe('Enforcement gates figure', () => {
  test('hydrates, and End and Home stay inside a 390px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/work/enforcement-gates/');
    const fig = page.locator('[data-enf-figure]');
    await fig.scrollIntoViewIfNeeded();
    const svg = fig.locator('[data-enf-svg]');
    await expect(svg).toHaveAttribute('viewBox', /.+/);
    await expect(fig).toHaveAttribute('data-ready', '');
    await expect(svg.locator('circle').first()).toBeAttached();
    await expect(fig.locator('.enf-bands')).toBeVisible();
    await expect(fig.locator('.enf-key')).toBeVisible();
    expect(await overflowPx(page)).toBeLessThanOrEqual(0);

    for (const name of ['Review floor', 'Auto-action gate']) {
      const handle = fig.getByRole('slider', { name });
      await handle.focus();
      await page.keyboard.press('End');
      expect(await overflowPx(page), `${name} End`).toBeLessThanOrEqual(0);
      await page.keyboard.press('Home');
      expect(await overflowPx(page), `${name} Home`).toBeLessThanOrEqual(0);
    }
  });

  test('step buttons are at least 44px on iPhone', async ({ page }, info) => {
    test.skip(info.project.name !== 'iphone', 'touch size is measured on the iPhone project');
    await page.goto('/work/enforcement-gates/');
    const buttons = page.locator('.enf-stepper__btn');
    await expect(buttons).toHaveCount(4);
    const boxes = await buttons.evaluateAll((nodes) => nodes.map((node) => {
      const r = node.getBoundingClientRect();
      return { w: r.width, h: r.height };
    }));
    for (const box of boxes) {
      expect(box.w).toBeGreaterThanOrEqual(44);
      expect(box.h).toBeGreaterThanOrEqual(44);
    }
  });
});
