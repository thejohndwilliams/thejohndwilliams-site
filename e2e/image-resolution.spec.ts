// Chosen file must cover rendered CSS width x DPR when a wide enough
// candidate exists. Otherwise the layout must not paint the image wider
// than its bitmap. Density-corrected naturalWidth is not used: a fresh
// Image() without srcset reports the file's real pixel width.
import { test, expect, type Browser, type Page } from '@playwright/test';

const VIEWPORTS = [
  { w: 1280, h: 720, dpr: 1 },
  { w: 1440, h: 900, dpr: 2 },
  { w: 820, h: 1180, dpr: 2 },
  { w: 1180, h: 820, dpr: 2 },
  { w: 1920, h: 1080, dpr: 1 },
  { w: 2560, h: 1440, dpr: 1 },
  { w: 390, h: 844, dpr: 3 },
  { w: 430, h: 932, dpr: 3 },
  { w: 540, h: 720, dpr: 2.5 },
  { w: 1114, h: 720, dpr: 2.5 },
] as const;

const PAGES = ['/', '/work/', '/photography/', '/photography/7r50580-enhanced-sr/', '/about/'];

type Row = {
  src: string;
  css: number;
  dpr: number;
  chosen: number;
  max: number;
  pass: boolean;
};

async function settle(page: Page) {
  await page.evaluate(async () => {
    const lenis = (window as unknown as { __lenis?: { scrollTo?: (n: number, o?: { immediate?: boolean }) => void } }).__lenis;
    const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    const step = Math.max(400, Math.floor(window.innerHeight * 0.8));
    for (let y = 0; y < height; y += step) {
      if (lenis?.scrollTo) lenis.scrollTo(y, { immediate: true });
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 30));
    }
    if (lenis?.scrollTo) lenis.scrollTo(0, { immediate: true });
    window.scrollTo(0, 0);
  });
  await page.evaluate(async () => {
    const imgs = Array.from(document.querySelectorAll('img'));
    await Promise.all(imgs.map(async (img) => {
      if (!(`${img.currentSrc || img.src}`).includes('/images/photography/')) return;
      img.loading = 'eager';
      try {
        await img.decode();
      } catch {
        /* broken candidates are reported by the measurement pass */
      }
    }));
  });
}

async function measure(page: Page): Promise<Row[]> {
  return page.evaluate(async () => {
    const cache = new Map<string, number>();
    function bitmap(url: string): Promise<number> {
      const hit = cache.get(url);
      if (hit !== undefined) return Promise.resolve(hit);
      return new Promise((resolve) => {
        const probe = new Image();
        probe.onload = () => {
          cache.set(url, probe.naturalWidth);
          resolve(probe.naturalWidth);
        };
        probe.onerror = () => {
          cache.set(url, 0);
          resolve(0);
        };
        probe.src = url;
      });
    }
    function candidateUrls(img: HTMLImageElement): string[] {
      const picture = img.closest('picture');
      const nodes: Element[] = picture
        ? Array.from(picture.querySelectorAll('source')).filter((source) => {
          const media = source.getAttribute('media');
          return !media || window.matchMedia(media).matches;
        })
        : [];
      const current = img.currentSrc;
      const owner = nodes.find((node) => (node.getAttribute('srcset') || '').includes(current.split('/').pop() || '\0')) || img;
      const srcset = owner.getAttribute('srcset') || '';
      const urls = srcset.split(',').map((part) => part.trim().split(/\s+/)[0]).filter(Boolean);
      if (urls.length === 0 && current) urls.push(current);
      return urls.map((url) => new URL(url, window.location.href).href);
    }
    const rows: Row[] = [];
    const imgs = Array.from(document.querySelectorAll('img'));
    for (const img of imgs) {
      const current = img.currentSrc || '';
      if (!current.includes('/images/photography/')) continue;
      if (img.clientWidth < 8 || img.clientHeight < 8) continue;
      const urls = candidateUrls(img);
      const widths = await Promise.all(urls.map((url) => bitmap(url)));
      const chosen = await bitmap(current);
      const max = widths.reduce((m, n) => Math.max(m, n), 0);
      const css = img.clientWidth;
      const dpr = window.devicePixelRatio || 1;
      const need = css * dpr;
      const pass = max + 1 >= need ? chosen + 1 >= need : chosen + 1 >= css;
      rows.push({ src: current, css, dpr, chosen, max, pass });
    }
    return rows;
  });
}

async function audit(browser: Browser, vp: (typeof VIEWPORTS)[number]) {
  const context = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: vp.dpr,
  });
  const page = await context.newPage();
  const failures: string[] = [];
  for (const path of PAGES) {
    await page.goto(path, { waitUntil: 'networkidle' });
    await settle(page);
    const rows = await measure(page);
    expect(rows.length, `${path} had no photography images`).toBeGreaterThan(0);
    for (const row of rows) {
      if (row.pass) continue;
      const file = row.src.split('/').slice(-2).join('/');
      failures.push(
        `${path} ${vp.w}x${vp.h}@${vp.dpr} ${file} css ${row.css} chosen ${row.chosen} max ${row.max} dpr ${row.dpr}`,
      );
    }
  }
  await context.close();
  return failures;
}

test.describe('photography is not displayed wider than its bitmap', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'DPR matrix is chromium');

  for (const vp of VIEWPORTS) {
    test(`${vp.w}x${vp.h} @${vp.dpr}`, async ({ browser }) => {
      test.setTimeout(180_000);
      const failures = await audit(browser, vp);
      expect(failures, failures.slice(0, 12).join('\n')).toEqual([]);
    });
  }
});
