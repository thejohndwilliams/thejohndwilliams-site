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
  const shell = await page.locator('.beyond-banner').boundingBox();
  const band = await banner.boundingBox();
  const viewport = page.viewportSize();
  expect(shell?.width).toBeGreaterThan((viewport?.width ?? 0) - 2);
  expect(band?.width).toBeGreaterThan((viewport?.width ?? 0) - 2);
  expect(band?.height).toBeGreaterThan(200);
  const stack = page.locator('#depth-layers #depth-stack');
  await expect(stack).toBeVisible();
  await stack.scrollIntoViewIfNeeded();
  const col = await page.locator('#depth-layers .beyond-col').boundingBox();
  const fit = await page.locator('#depth-stack .depth-stack__fit').boundingBox();
  const cap = await page.locator('#depth-stack .depth-stack__cap').boundingBox();
  const dpr = await page.evaluate(() => window.devicePixelRatio || 1);
  const native = dpr >= 2.5 ? 533 : dpr >= 1.5 ? 800 : 1600;
  const expected = Math.min(col?.width ?? 0, native);
  expect(Math.abs((fit?.width ?? 0) - expected)).toBeLessThan(12);
  expect(fit?.width).toBeGreaterThan(500);
  expect(Math.abs((cap?.x ?? 0) - (fit?.x ?? 0))).toBeLessThan(4);
  const wrap = await page.locator('#depth-stack .depth-stack__cap').evaluate((el) => getComputedStyle(el).textWrap);
  expect(wrap === 'pretty' || wrap === 'balance').toBe(true);
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

test('a phone shows the intro on the first screen and a full-width figure', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/beyond/?still=flat');
  await expect(page.locator('.beyond-banner')).toBeVisible();
  const band = await page.locator('.beyond-banner').boundingBox();
  expect(band?.height).toBeGreaterThan(844 * 0.35);
  expect(band?.height).toBeLessThanOrEqual(844 * 0.5 + 1);
  const intro = await page.locator('.beyond-lede').boundingBox();
  expect((intro?.y ?? 9999) + (intro?.height ?? 9999)).toBeLessThan(844);
  const img = page.locator('.beyond-banner__img');
  await expect(img).toBeVisible();
  const pos = await img.evaluate((el) => getComputedStyle(el).objectPosition);
  expect(pos).toBe('92% 100%');
  const sharp = await img.evaluate((node) => {
    const el = node as HTMLImageElement;
    return { css: el.clientWidth, bitmap: el.naturalWidth };
  });
  expect(sharp.bitmap).toBeGreaterThanOrEqual(sharp.css * 2);
  const col = page.locator('#depth-layers .beyond-col');
  const fit = page.locator('#depth-stack .depth-stack__fit');
  await fit.scrollIntoViewIfNeeded();
  const colBox = await col.boundingBox();
  const fitBox = await fit.boundingBox();
  expect(fitBox?.width).toBeGreaterThan(340);
  expect(Math.abs((fitBox?.width ?? 0) - (colBox?.width ?? 0))).toBeLessThan(8);
});

test('the figure fills the column on an ipad width', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('/beyond/?still=flat');
  const fit = page.locator('#depth-stack .depth-stack__fit');
  await fit.scrollIntoViewIfNeeded();
  const colBox = await page.locator('#depth-layers .beyond-col').boundingBox();
  const fitBox = await fit.boundingBox();
  const dpr = await page.evaluate(() => window.devicePixelRatio || 1);
  const native = dpr >= 2.5 ? 533 : dpr >= 1.5 ? 800 : 1600;
  const expected = Math.min(colBox?.width ?? 0, native);
  expect(Math.abs((fitBox?.width ?? 0) - expected)).toBeLessThan(12);
  expect(fitBox?.width).toBeGreaterThan(500);
});

const STUDIES = [
  { name: 'Earth', orient: 'portrait' },
  { name: 'Structure', orient: 'portrait' },
  { name: 'Sky', orient: 'landscape' },
  { name: 'Water', orient: 'landscape' },
] as const;

function bitmapCap(name: string, dpr: number): number {
  const hero = name === 'Earth' ? 1350 : name === 'Structure' ? 1800 : 2400;
  if (dpr >= 2.5) return hero / 3;
  if (dpr >= 1.5) return hero / 2;
  return hero;
}

test('each study fills its stage and the strip uses one frame', async ({ page }) => {
  const widths = [1440, 1024, 820, 390];
  for (const width of widths) {
    const height = width === 390 ? 844 : width === 820 ? 1180 : width === 1024 ? 800 : 900;
    await page.setViewportSize({ width, height });
    await page.goto('/beyond/?still=flat');
    for (const study of STUDIES) {
      await page.getByRole('button', { name: study.name, exact: true }).click();
      const img = page.locator('#depth [data-depth-photo] img');
      await img.scrollIntoViewIfNeeded();
      const dpr = await page.evaluate(() => window.devicePixelRatio || 1);
      const boxes = await page.evaluate(() => {
        const col = document.querySelector('#depth [data-depth-slot]')!.getBoundingClientRect();
        const photo = document.querySelector('#depth [data-depth-photo] img')!.getBoundingClientRect();
        const aside = document.querySelector('#depth .depth-aside')!.getBoundingClientRect();
        const strip = document.querySelector('#depth .depth-thumbs') as HTMLElement;
        const frames = [...strip.querySelectorAll('picture')].map((el) => el.getBoundingClientRect());
        const node = document.querySelector('#depth [data-depth-photo] img') as HTMLImageElement;
        const srcset = node.parentElement?.querySelector('source')?.getAttribute('srcset') || '';
        return {
          col: { x: col.x, w: col.width, right: col.right },
          photo: { x: photo.x, w: photo.width, h: photo.height },
          aside: { x: aside.x, right: aside.right, y: aside.y },
          frames: frames.map((r) => ({ w: r.width, h: r.height })),
          stripScroll: strip.scrollWidth > strip.clientWidth + 4,
          current: node.currentSrc,
          srcset,
          css: node.clientWidth,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      expect(boxes.overflow, `${width} ${study.name}`).toBeLessThan(2);
      const cap = Math.min(boxes.col.w, bitmapCap(study.name, dpr));
      if (width >= 1024 && study.orient === 'portrait') {
        expect(boxes.photo.w, study.name).toBeGreaterThan(250);
        expect(boxes.photo.w, study.name).toBeLessThan(boxes.col.w * 0.55);
        expect(boxes.aside.x).toBeGreaterThan(boxes.photo.x + boxes.photo.w - 8);
        expect(Math.abs(boxes.aside.right - boxes.col.right)).toBeLessThan(8);
        expect(boxes.photo.h).toBeGreaterThan(boxes.photo.w);
      } else {
        expect(Math.abs(boxes.photo.w - cap), `${width} ${study.name}`).toBeLessThan(12);
        expect(Math.abs(boxes.photo.x - boxes.col.x)).toBeLessThan(Math.max(12, (boxes.col.w - boxes.photo.w) / 2 + 8));
      }
      const first = boxes.frames[0];
      expect(boxes.frames).toHaveLength(4);
      for (const frame of boxes.frames) {
        expect(Math.abs(frame.w - first.w), `${width} ${study.name} thumb`).toBeLessThan(2);
        expect(Math.abs(frame.h - first.h), `${width} ${study.name} thumb`).toBeLessThan(2);
        expect(frame.h).toBeGreaterThan(44);
      }
      expect(Math.abs(first.w / first.h - 4 / 3)).toBeLessThan(0.05);
      if (width === 390) expect(boxes.stripScroll).toBe(true);
      const chosen = boxes.srcset.split(',').map((part) => part.trim().split(/\s+/)).find(([url]) => boxes.current.includes(url));
      const chosenW = Number(chosen?.[1]?.replace('w', '') || 0);
      const largest = Math.max(...boxes.srcset.split(',').map((part) => Number(part.trim().split(/\s+/)[1]?.replace('w', '') || 0)));
      expect(chosenW, `${width} ${study.name} src`).toBeGreaterThanOrEqual(Math.min(boxes.css * 2, largest) - 1);
      expect(boxes.current).not.toContain('/thumb/');
    }
  }
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
