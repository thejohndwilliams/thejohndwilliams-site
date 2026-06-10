/**
 * Headless page audit: overflow, tap targets, console errors, missing alt.
 * Usage: start a server for dist (npx astro preview --port 4173), then
 *   node scripts/audit-pages.mjs <width> <height> <screenshot-dir> <yes|no> [A|B|all]
 * Example: node scripts/audit-pages.mjs 390 844 ./audit-out yes all
 * Emits one JSON line per page. Screenshots written as <width><route>-top/bottom.png.
 * Added by the 2026-06-09 audit session; see CLAUDE.md "Mobile".
 */
import { chromium } from 'playwright';
const [,, W, H, outdir, shots, half] = process.argv;
const width = +W, height = +H;
const base = 'http://localhost:4173';
let pages = ['/', '/photography', '/work', '/about', '/privacy', '/photography/img-0078', '/photography/7r52326', '/no-such-page'];
if (half === 'A') pages = pages.slice(0, 4);
if (half === 'B') pages = pages.slice(4);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: width < 800, hasTouch: width < 800 });
for (const p of pages) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0,160)); });
  page.on('pageerror', e => errors.push(('PAGEERROR: ' + e.message).slice(0,160)));
  const resp = await page.goto(base + p, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => null);
  await page.waitForTimeout(800);
  const data = await page.evaluate(() => {
    const vw = window.innerWidth;
    const docW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const offenders = [];
    if (docW > vw + 1) {
      document.querySelectorAll('body *').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1 && r.width > 8 && getComputedStyle(el).position !== 'fixed')
          offenders.push({ tag: el.tagName, cls: String(el.className).slice(0,70), w: Math.round(r.width), right: Math.round(r.right) });
      });
    }
    const small = [];
    document.querySelectorAll('a,button').forEach(el => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (el.closest('p,li,figcaption')) return;
      if (r.height < 43 && r.width < 43)
        small.push({ t: (el.textContent || el.getAttribute('aria-label') || '?').trim().slice(0,36), w: Math.round(r.width), h: Math.round(r.height) });
    });
    const noAlt = document.querySelectorAll('img:not([alt])').length;
    return { vw, docW, overflow: docW > vw + 1, offenders: offenders.slice(0,8), small: small.slice(0,12), noAlt, title: document.title.slice(0,60) };
  });
  if (shots === 'yes') {
    const safe = (p.replace(/\//g, '_') || '_home');
    await page.screenshot({ path: `${outdir}/${width}${safe}-top.png` });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${outdir}/${width}${safe}-bottom.png` });
  }
  console.log(JSON.stringify({ p, st: resp ? resp.status() : 'ERR', err: errors.slice(0,4), ...data }));
  await page.close();
}
await browser.close();
