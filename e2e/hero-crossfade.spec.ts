// Home hero: the midday photograph stays the first paint. A wide viewport
// dissolves once to the local hour. Phones and reduced motion do not.
import { test, expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MIDDAY = '/images/photography/hero/7r52326.webp';
const DAWN = '/images/photography/hero/img-3058.webp';
const GOLDEN = '/images/photography/hero/img-6552.webp';
const NIGHT = '/images/photography/hero/7r52268.webp';

// Baseline hard cut on this machine: mean channel delta 52.7 across 96ms
// (about 55 per 100ms). A full midday-to-night crop differs by about 119.
// A 1400ms dissolve steps at about 8.5 per 100ms. 22 rejects the cut.
const RATE_PER_100MS = 22;

type Frame = { t: number; buf: Buffer };

function meanDelta(a: Buffer, b: Buffer): number {
  const A = PNG.sync.read(a);
  const B = PNG.sync.read(b);
  if (A.width !== B.width || A.height !== B.height) return 255;
  let sum = 0;
  const n = A.width * A.height;
  for (let i = 0; i < A.data.length; i += 4) {
    sum += Math.abs(A.data[i] - B.data[i]);
    sum += Math.abs(A.data[i + 1] - B.data[i + 1]);
    sum += Math.abs(A.data[i + 2] - B.data[i + 2]);
  }
  return sum / (n * 3);
}

async function pinHour(page: Page, hour: number) {
  await page.addInitScript((h) => {
    Date.prototype.getHours = function () { return h as number; };
    const w = window as Window & { __xfade?: number; __lcp?: { url: string; t: number }[] };
    w.__xfade = 0;
    w.__lcp = [];
    try {
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const paint = entry as PerformanceEntry & { url?: string };
          w.__lcp!.push({ url: paint.url || '', t: Math.round(entry.startTime) });
        }
      });
      po.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // LCP observer is not required for the swap assertions.
    }
    const mo = new MutationObserver((recs) => {
      for (const rec of recs) {
        rec.addedNodes.forEach((node) => {
          if (node instanceof HTMLImageElement && node.classList.contains('hero-xfade')) {
            w.__xfade = (w.__xfade || 0) + 1;
          }
        });
      }
    });
    const start = () => mo.observe(document.documentElement, { childList: true, subtree: true });
    if (document.documentElement) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
  }, hour);
}

async function heroClip(page: Page) {
  const box = await page.locator('#hero-img').boundingBox();
  if (!box) throw new Error('hero box missing');
  return {
    x: Math.round(box.x + box.width * 0.72),
    y: Math.round(box.y + 16),
    width: Math.max(80, Math.round(box.width * 0.22)),
    height: Math.max(80, Math.round(box.height * 0.38)),
  };
}

async function sampleUntilNight(page: Page, maxMs: number): Promise<Frame[]> {
  const clip = await heroClip(page);
  const frames: Frame[] = [];
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const started = Date.now();
    const buf = await page.screenshot({ type: 'png', clip });
    frames.push({ t: started - t0, buf });
    const src = await page.locator('#hero-img').getAttribute('src');
    const clones = await page.locator('.hero-xfade').count();
    if (src === NIGHT && clones === 0 && started - t0 > 1200) break;
    const wait = 50 - (Date.now() - started);
    if (wait > 0) await page.waitForTimeout(wait);
  }
  return frames;
}

function assertGradual(frames: Frame[]) {
  expect(frames.length).toBeGreaterThan(6);
  let worst = 0;
  for (let i = 1; i < frames.length; i++) {
    const dt = Math.max(1, frames[i].t - frames[i - 1].t);
    const mean = meanDelta(frames[i - 1].buf, frames[i].buf);
    const rate = dt < 30 ? mean : mean * (100 / dt);
    if (rate > worst) worst = rate;
    expect(rate, `frame ${i} mean ${mean.toFixed(1)} over ${dt}ms`).toBeLessThan(RATE_PER_100MS);
  }
  const span = meanDelta(frames[0].buf, frames[frames.length - 1].buf);
  expect(span).toBeGreaterThan(40);
  return { worst, span, frames: frames.length };
}

async function saveSheet(frames: Frame[], file: string) {
  if (!process.env.HERO_ARTIFACTS) return;
  const dir = process.env.HERO_ARTIFACTS;
  await mkdir(dir, { recursive: true });
  const step = Math.max(1, Math.floor(frames.length / 12));
  const picked = frames.filter((_, i) => i % step === 0).slice(0, 12);
  const thumbs = await Promise.all(picked.map((f) => sharp(f.buf).resize(180).png().toBuffer()));
  const meta = await sharp(thumbs[0]).metadata();
  const tw = meta.width || 180;
  const th = meta.height || 100;
  const cols = 6;
  const rows = Math.ceil(thumbs.length / cols);
  await sharp({
    create: { width: cols * tw, height: rows * th, channels: 3, background: '#0a0a0a' },
  })
    .composite(thumbs.map((input, i) => ({ input, left: (i % cols) * tw, top: Math.floor(i / cols) * th })))
    .png()
    .toFile(path.join(dir, file));
}

async function wide(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
}

test.describe('time-of-day hero crossfade', () => {
  test('dawn dissolves once to img-3058', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'iphone', 'phones keep the portrait midday frame');
    await wide(page);
    await pinHour(page, 8);
    await page.goto('/');
    await expect(page.locator('.hero-xfade')).toHaveCount(1, { timeout: 8000 });
    await expect(page.locator('#hero-img')).toHaveAttribute('src', DAWN, { timeout: 8000 });
    await expect(page.locator('.hero-xfade')).toHaveCount(0);
    expect(await page.evaluate(() => (window as Window & { __xfade?: number }).__xfade)).toBe(1);
    expect(await page.locator('#hero-img').getAttribute('style')).toBeNull();
  });

  test('midday never swaps', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'iphone', 'covered by the narrow viewport test');
    await wide(page);
    await pinHour(page, 13);
    await page.goto('/');
    await page.waitForTimeout(3500);
    await expect(page.locator('#hero-img')).toHaveAttribute('src', MIDDAY);
    await expect(page.locator('.hero-xfade')).toHaveCount(0);
    expect(await page.evaluate(() => (window as Window & { __xfade?: number }).__xfade || 0)).toBe(0);
  });

  test('golden dissolves once to img-6552', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'iphone', 'phones keep the portrait midday frame');
    await wide(page);
    await pinHour(page, 17);
    await page.goto('/');
    await expect(page.locator('.hero-xfade')).toHaveCount(1, { timeout: 8000 });
    expect(await page.locator('.hero-xfade').getAttribute('style')).toBeNull();
    expect(await page.locator('.hero-xfade').getAttribute('alt')).toBe('');
    await expect(page.locator('.hero-xfade')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#hero-img')).toHaveAttribute('src', GOLDEN, { timeout: 8000 });
    await expect(page.locator('.hero-xfade')).toHaveCount(0);
    expect(await page.evaluate(() => (window as Window & { __xfade?: number }).__xfade)).toBe(1);
    expect(await page.locator('#hero-img').getAttribute('style')).toBeNull();
  });

  test('night dissolves once and adjacent frames do not jump', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'iphone', 'phones keep the portrait midday frame');
    await wide(page);
    await pinHour(page, 22);
    await page.goto('/');
    const frames = testInfo.project.name === 'chromium' ? await sampleUntilNight(page, 8000) : null;
    if (!frames) {
      await expect(page.locator('.hero-xfade')).toHaveCount(1, { timeout: 8000 });
      expect(await page.locator('.hero-xfade').getAttribute('style')).toBeNull();
    }
    await expect(page.locator('#hero-img')).toHaveAttribute('src', NIGHT, { timeout: 8000 });
    await expect(page.locator('.hero-xfade')).toHaveCount(0);
    expect(await page.locator('#hero-img').getAttribute('style')).toBeNull();
    expect(await page.evaluate(() => (window as Window & { __xfade?: number }).__xfade)).toBe(1);

    const lcp = await page.evaluate(() => (window as Window & { __lcp?: { url: string }[] }).__lcp || []);
    expect(lcp.length).toBeGreaterThan(0);
    expect(lcp[0].url).toContain('7r52326');

    const live = await page.locator('[data-glass-bench] .gpill-live').count();
    if (live > 0) {
      const tex = Number(await page.locator('#hero-img').getAttribute('data-tex-refresh'));
      expect(tex).toBe(live);
    }

    if (frames) {
      const stats = assertGradual(frames);
      await saveSheet(frames, 'night-fast-filmstrip.png');
      if (process.env.HERO_ARTIFACTS) {
        await writeFile(
          path.join(process.env.HERO_ARTIFACTS, 'night-fast-stats.json'),
          JSON.stringify({ worst: stats.worst, span: stats.span, frames: stats.frames, lcp }, null, 2),
        );
      }
    }
  });

  test('slow 4G night fade does not hard-cut', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'CDP network emulation is chromium');
    test.setTimeout(90000);
    await wide(page);
    await pinHour(page, 22);
    const client = await page.context().newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/');
    const frames = await sampleUntilNight(page, 12000);
    await expect(page.locator('#hero-img')).toHaveAttribute('src', NIGHT, { timeout: 20000 });
    await expect(page.locator('.hero-xfade')).toHaveCount(0, { timeout: 20000 });
    const stats = assertGradual(frames);
    await saveSheet(frames, 'night-slow-filmstrip.png');
    if (process.env.HERO_ARTIFACTS) {
      await writeFile(
        path.join(process.env.HERO_ARTIFACTS, 'night-slow-stats.json'),
        JSON.stringify({ ...stats, lcp: await page.evaluate(() => (window as Window & { __lcp?: unknown }).__lcp) }, null, 2),
      );
    }
  });

  test('narrow viewports do not swap', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await pinHour(page, 22);
    await page.goto('/');
    await page.waitForTimeout(2500);
    await expect(page.locator('#hero-img')).toHaveAttribute('src', MIDDAY);
    await expect(page.locator('.hero-xfade')).toHaveCount(0);
    expect(await page.evaluate(() => (window as Window & { __xfade?: number }).__xfade || 0)).toBe(0);
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('does not create a fade layer', async ({ page }) => {
      await wide(page);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await pinHour(page, 22);
      await page.goto('/');
      expect(await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
      await page.waitForTimeout(2500);
      await expect(page.locator('#hero-img')).toHaveAttribute('src', MIDDAY);
      await expect(page.locator('.hero-xfade')).toHaveCount(0);
      expect(await page.evaluate(() => (window as Window & { __xfade?: number }).__xfade || 0)).toBe(0);
      expect(await page.locator('#hero-img').getAttribute('style')).toBeNull();
    });
  });

  test('return to Home does not paint the midday hero', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'iphone', 'phones do not swap, so return stays midday');
    await wide(page);
    await pinHour(page, 22);
    await page.goto('/');
    await expect(page.locator('#hero-img')).toHaveAttribute('src', NIGHT, { timeout: 8000 });
    await expect(page.locator('.hero-xfade')).toHaveCount(0);

    await page.evaluate(() => {
      const w = window as Window & { __incoming?: string; __srcs?: string[] };
      w.__srcs = [];
      document.addEventListener('astro:before-swap', ((ev: Event & { newDocument?: Document }) => {
        const img = ev.newDocument?.getElementById('hero-img');
        if (img) w.__incoming = img.getAttribute('src') || '';
      }) as EventListener);
      document.addEventListener('astro:after-swap', () => {
        const img = document.getElementById('hero-img');
        if (!img) return;
        w.__srcs!.push(img.getAttribute('src') || '');
        requestAnimationFrame(() => {
          const again = document.getElementById('hero-img');
          if (again) w.__srcs!.push(again.getAttribute('src') || '');
        });
      });
    });

    await page.locator('header a[href="/about/"]:visible').first().click();
    await expect(page).toHaveURL(/\/about\/?$/);
    await page.locator('header a[href="/"]:visible').first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('#hero-img')).toHaveAttribute('src', NIGHT);
    await expect(page.locator('.hero-xfade')).toHaveCount(0);

    const seen = await page.evaluate(() => {
      const w = window as Window & { __incoming?: string; __srcs?: string[] };
      return { incoming: w.__incoming || '', srcs: w.__srcs || [] };
    });
    expect(seen.incoming).toContain('7r52268');
    expect(seen.incoming).not.toContain('7r52326');
    for (const src of seen.srcs) {
      expect(src).not.toContain('7r52326');
      expect(src).toContain('7r52268');
    }
  });
});
