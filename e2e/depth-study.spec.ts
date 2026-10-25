// /beyond keeps the photograph in the frame until a mode is chosen.
// One plate mounts at a time. The other subjects stay in <template>.
import { test, expect } from '@playwright/test';

test.describe('depth study selector', () => {
  test('the photograph rests, and one mode mounts at a time', async ({ page }) => {
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
    await expect(live.locator('[data-depth-photo] img')).toBeVisible();
    await expect(live.locator('.kplate3d')).toHaveCount(0);
    await expect(live.locator('.kinetic-plate')).toHaveCount(0);
    await expect(page.locator('.kplate3d')).toHaveCount(0);
    await expect(page.locator('.kinetic-plate')).toHaveCount(0);

    const planes = page.getByRole('button', { name: 'Planes', exact: true });
    await planes.scrollIntoViewIfNeeded();
    await planes.click();
    await expect(planes).toHaveAttribute('aria-pressed', 'true');
    await expect(live.locator('.kinetic-plate')).toHaveCount(1);
    await expect(live.locator('.kplate3d')).toHaveCount(0);
    await expect(live.getByText('Hologram · stacked planes')).toHaveCount(1);
    await expect(page.locator('.kinetic-plate')).toHaveCount(1);
    await expect(live.locator('canvas')).toHaveCount(8);

    const points = page.getByRole('button', { name: 'Points', exact: true });
    await points.click();
    await expect(points).toHaveAttribute('aria-pressed', 'true');
    await expect(planes).toHaveAttribute('aria-pressed', 'false');
    await expect(live.locator('.kplate3d')).toHaveCount(1);
    await expect(live.locator('.kinetic-plate')).toHaveCount(0);
    await expect(live.getByText('Point cloud · true depth')).toHaveCount(1);
    await expect(page.locator('.kplate3d')).toHaveCount(1);
    await expect(page.locator('.kinetic-plate')).toHaveCount(0);

    const sky = buttons.nth(2);
    await sky.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    await sky.click();
    await expect(sky).toHaveAttribute('aria-pressed', 'true');
    await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'false');
    await expect(live.locator('.kplate3d')).toHaveCount(1);
    await expect(live.locator('.kinetic-plate')).toHaveCount(0);
    await expect(page.locator('[data-study-note="sky"]')).toBeVisible();
    await expect(page.locator('[data-study-note="earth"]')).toBeHidden();
    const after = await page.evaluate(() => window.scrollY);
    expect(Math.abs(after - before)).toBeLessThan(80);

    await expect(live.locator('canvas')).toHaveCount(1);
  });
});

test('the banner and the depth figure stay put when a mode is chosen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/beyond/?still=flat');
  const banner = page.locator('.beyond-banner__img');
  await expect(banner).toBeVisible();
  const band = await banner.boundingBox();
  expect(band?.width).toBeGreaterThan(1000);
  expect(band?.height).toBeGreaterThan(200);
  const stack = page.locator('#depth-layers #depth-stack');
  await expect(stack).toBeVisible();
  await stack.scrollIntoViewIfNeeded();
  await expect(stack).toHaveClass(/is-on/);
  await expect(stack).not.toHaveClass(/is-run/);
  const sep = async () => stack.evaluate((el) => Number(getComputedStyle(el).getPropertyValue('--sep')));
  expect(await sep()).toBeLessThan(0.05);
  await page.getByRole('button', { name: 'Planes', exact: true }).click();
  await expect(page.locator('#depth-stack')).toHaveCount(1);
  await expect(page.locator('#depth .kinetic-plate')).toHaveCount(1);
  await expect(stack).not.toHaveClass(/is-run/);
  expect(await sep()).toBeLessThan(0.05);
});

test('no-js shows the photograph and every depth subject, with no plates', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto('/beyond/');
    await expect(page.locator('[data-depth-slot] [data-depth-photo] img')).toBeVisible();
    await expect(page.locator('[data-depth-slot] .kplate3d')).toHaveCount(0);
    await expect(page.locator('[data-depth-slot] .kinetic-plate')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Earth' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Planes' })).toHaveCount(0);
    const notes = page.locator('#depth [data-study-note]');
    await expect(notes).toHaveCount(4);
    for (const id of ['earth', 'structure', 'sky', 'water']) {
      await expect(page.locator(`#depth [data-study-note="${id}"]`)).toBeVisible();
    }
  } finally {
    await context.close();
  }
});
