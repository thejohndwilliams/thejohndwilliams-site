// /beyond holograms used to measure while content-visibility had skipped
// their layout, lock every canvas at 1x1, and stay blank until a window
// resize. This waits on canvas size and painted pixels, never a sleep.
import { test, expect, type Locator } from '@playwright/test';
import { PNG } from 'pngjs';

const VIEWPORTS = [
  { width: 1366, height: 900 },
  { width: 820, height: 1180 },
  { width: 390, height: 844 },
] as const;

// /about keeps the earth point cloud. Its 2.5D plate is the hidden fallback.
// /beyond mounts neither plate until Planes or Points is chosen, and then
// only one of them, so a resting visit does not open a depth WebGL context.
const PAGES = [
  { path: '/about/', figures: 2, painted: 1 },
] as const;

function luminanceStdDev(png: PNG): number {
  const n = png.width * png.height;
  if (n < 1) return 0;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const y = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
    sum += y;
    sumSq += y * y;
  }
  const mean = sum / n;
  return Math.sqrt(Math.max(0, sumSq / n - mean * mean));
}

async function assertPlatePainted(fig: Locator): Promise<void> {
  const label = (await fig.getAttribute('aria-label')) ?? 'plate';
  await fig.scrollIntoViewIfNeeded();

  await expect.poll(async () => {
    return fig.evaluate((el) => {
      const canvases = [...el.querySelectorAll('canvas')];
      if (canvases.length < 1) return false;
      return canvases.every((c) => c.width >= 100 && c.height >= 100);
    });
  }, {
    timeout: 15000,
    message: `${label}: canvas backing store stayed below 100px`,
  }).toBe(true);

  const mode = await fig.evaluate((el) => {
    const canvas = el.querySelector('canvas');
    if (!canvas) return 'missing';
    return canvas.getContext('2d') ? '2d' : 'webgl';
  });

  if (mode === '2d') {
    const inks = await fig.evaluate((el) => {
      return [...el.querySelectorAll('canvas')].map((node) => {
        const canvas = node as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');
        if (!ctx || canvas.width < 2 || canvas.height < 2) return 0;
        // A middle band is enough to tell a painted plate from an empty
        // one, and it stays cheap when device pixels are large.
        const band = Math.max(16, Math.floor(canvas.height / 5));
        const y0 = Math.floor((canvas.height - band) / 2);
        const data = ctx.getImageData(0, y0, canvas.width, band).data;
        let ink = 0;
        for (let i = 3; i < data.length; i += 16) {
          if (data[i] > 8) ink++;
        }
        return ink;
      });
    });
    expect(inks.length, label).toBeGreaterThan(0);
    for (const ink of inks) {
      expect(ink, `${label}: canvas has no painted pixels`).toBeGreaterThan(0);
    }
    return;
  }

  // Element screenshots of a WebGL canvas wait until the box stops moving.
  // A page clip does not. preserveDrawingBuffer is not set, so the pixels
  // come from the screenshot, not from the GL buffer.
  // About wraps its plate in .reveal, which starts at opacity 0. A clip
  // taken during that fade is a flat field even after the canvas has painted.
  await expect.poll(async () => {
    return fig.evaluate((el) => {
      const reveal = el.closest('.reveal');
      if (reveal && !reveal.classList.contains('visible')) return false;
      let node: Element | null = el;
      while (node) {
        if (Number(getComputedStyle(node).opacity) < 0.99) return false;
        node = node.parentElement;
      }
      return true;
    });
  }, {
    timeout: 15000,
    message: `${label}: plate was still covered by the reveal fade`,
  }).toBe(true);

  const clip = await fig.locator('canvas').evaluate((el) => {
    const r = el.getBoundingClientRect();
    const x = Math.max(0, r.left);
    const y = Math.max(0, r.top);
    const width = Math.min(r.width, window.innerWidth - x, 480);
    const height = Math.min(r.height, window.innerHeight - y, 480);
    return { x, y, width: Math.max(1, width), height: Math.max(1, height) };
  });
  const png = PNG.sync.read(await fig.page().screenshot({ clip, animations: 'disabled' }));
  const spread = luminanceStdDev(png);
  expect(spread, `${label}: point cloud screenshot is flat (${spread.toFixed(2)})`).toBeGreaterThan(4);
}

for (const viewport of VIEWPORTS) {
  test(`/beyond/ paints the chosen plate at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/beyond/');

    await expect(page.locator('figure.kinetic-plate, figure.kplate3d')).toHaveCount(0);
    await expect(page.locator('[data-depth-photo] img')).toBeVisible();

    await page.getByRole('button', { name: 'Planes', exact: true }).click();
    const hologram = page.locator('figure.kinetic-plate');
    await expect(hologram).toHaveCount(1);
    await assertPlatePainted(hologram);
    await expect(page.locator('figure.kplate3d')).toHaveCount(0);

    await page.getByRole('button', { name: 'Points', exact: true }).click();
    const cloud = page.locator('figure.kplate3d');
    await expect(cloud).toHaveCount(1);
    await assertPlatePainted(cloud);
    await expect(page.locator('figure.kinetic-plate')).toHaveCount(0);
  });

  for (const target of PAGES) {
    test(`${target.path} plates paint at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(target.path);

      const figures = page.locator('figure.kinetic-plate, figure.kplate3d');
      await expect.poll(async () => figures.count(), { timeout: 15000 }).toBe(target.figures);

      const total = await figures.count();
      let painted = 0;
      for (let i = 0; i < total; i++) {
        const fig = figures.nth(i);
        const shown = await fig.evaluate((el) => getComputedStyle(el).display !== 'none');
        if (!shown) continue;
        await assertPlatePainted(fig);
        painted++;
      }

      // A hidden fallback must not count. Every plate that is shown has to paint.
      expect(painted).toBe(target.painted);
    });
  }
}
