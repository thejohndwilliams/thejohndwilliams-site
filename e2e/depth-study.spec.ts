// /beyond used to mount four identical hologram and point-cloud rows.
// One pair stays live. The selector swaps a template into that slot.
import { test, expect } from '@playwright/test';

test.describe('depth study selector', () => {
  test('one pair is mounted and the keyboard control swaps it', async ({ page }) => {
    await page.goto('/beyond/');
    const group = page.getByRole('group', { name: 'Depth study' });
    const buttons = group.getByRole('button');
    await expect(buttons).toHaveCount(4);
    await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'true');

    const outline = await buttons.nth(0).evaluate((el) => {
      el.focus();
      return getComputedStyle(el).outlineStyle;
    });
    expect(outline).not.toBe('none');

    const live = page.locator('[data-depth-slot]');
    await expect(live.locator('.kplate3d')).toHaveCount(1);
    await expect(live.locator('.kinetic-plate')).toHaveCount(1);
    await expect(live.getByText('Hologram · stacked planes')).toHaveCount(1);
    await expect(live.getByText('Point cloud · true depth')).toHaveCount(1);
    await expect(page.locator('.kplate3d')).toHaveCount(1);

    const sky = buttons.nth(2);
    await sky.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    await sky.click();
    await expect(sky).toHaveAttribute('aria-pressed', 'true');
    await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'false');
    await expect(live.locator('.kplate3d')).toHaveCount(1);
    await expect(live.locator('.kinetic-plate')).toHaveCount(1);
    await expect(page.locator('.kplate3d')).toHaveCount(1);
    await expect(page.locator('.kinetic-plate')).toHaveCount(1);
    await expect(page.locator('[data-study-note="sky"]')).toBeVisible();
    await expect(page.locator('[data-study-note="earth"]')).toBeHidden();
    const after = await page.evaluate(() => window.scrollY);
    expect(Math.abs(after - before)).toBeLessThan(80);

    const canvases = await live.locator('canvas').count();
    expect(canvases).toBe(9);
  });
});

test('no-js lists every depth subject and shows the first pair', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto('/beyond/');
    await expect(page.locator('[data-depth-slot] .kplate3d')).toHaveCount(1);
    await expect(page.locator('[data-depth-slot] .kinetic-plate')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Earth' })).toHaveCount(0);
    const notes = page.locator('#depth [data-study-note]');
    await expect(notes).toHaveCount(4);
    for (const id of ['earth', 'structure', 'sky', 'water']) {
      await expect(page.locator(`#depth [data-study-note="${id}"]`)).toBeVisible();
    }
  } finally {
    await context.close();
  }
});
