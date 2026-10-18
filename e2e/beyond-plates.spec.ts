// /beyond holograms used to measure while content-visibility had skipped
// their layout, lock every canvas at 1x1, and stay blank until a window
// resize. This waits on canvas size and painted pixels, never a sleep.
import { test, expect, type Locator } from '@playwright/test';
import { PNG } from 'pngjs';

const VIEWPORTS = [
  { width: 1366, height: 900 },
  { width: 820, height: 1180 },
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
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let ink = 0;
        // Step two pixels. Dot cells are about four pixels across, so a
        // coarser stride can miss a painted plate and look blank.
        for (let i = 3; i < data.length; i += 8) {
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

  const png = PNG.sync.read(await fig.locator('canvas').screenshot());
  const spread = luminanceStdDev(png);
  expect(spread, `${label}: point cloud screenshot is flat (${spread.toFixed(2)})`).toBeGreaterThan(4);
}

for (const viewport of VIEWPORTS) {
  test(`plates paint at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/beyond/');

    const figures = page.locator('figure.kinetic-plate, figure.kplate3d');
    await expect.poll(async () => figures.count(), { timeout: 15000 }).toBeGreaterThan(4);

    const total = await figures.count();
    let painted = 0;
    for (let i = 0; i < total; i++) {
      const fig = figures.nth(i);
      const shown = await fig.evaluate((el) => getComputedStyle(el).display !== 'none');
      if (!shown) continue;
      await assertPlatePainted(fig);
      painted++;
    }

    // Four holograms plus the relief plate. Point clouds add more when
    // WebGL is available; a hidden fallback must not count.
    expect(painted).toBeGreaterThanOrEqual(5);
  });
}
