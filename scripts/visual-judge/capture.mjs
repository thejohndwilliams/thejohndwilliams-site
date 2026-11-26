// Visual judge, step 1: capture.
//
//   npm run visual:capture                         # production
//   npm run visual:capture -- --base http://localhost:4321
//   ... --routes /,/work/ --viewports wide,phone --frames 4 --out visual-judge-out
//   ... --channel chrome     (use an installed Chrome instead of Playwright's)
//
// Why this exists: every visual defect on this site was found by John's
// screenshots after deploy, never by a green build (verification doctrine).
// This walks each page the way a person does, with real wheel scrolls (Lenis
// ignores scrollIntoView; reveals need IntersectionObserver to fire), and
// saves one screenshot per screen. While it walks it records facts no model
// is needed for: sideways scroll, reveals still invisible after entering the
// viewport, broken images, retired colors in computed styles, em dashes in
// visible copy, CSP violations and page errors. scripts/visual-judge/judge.mjs
// then grades the screenshots against rubric.md.
//
// Motion is left ON on purpose: the point is what a visitor sees, including
// the reveal choreography. visual-regress.mjs is the deterministic
// reduced-motion pixel diff; this is the judgment layer above it.

import { chromium, webkit } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { VIEWPORTS, DEFAULT_VIEWPORTS, ROUTES, MAX_FRAMES, RETIRED_COLORS } from './config.mjs';

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};

const BASE = flag('base', process.env.VJ_BASE || 'https://thejohndwilliams.com').replace(/\/$/, '');
const OUT = path.resolve(flag('out', 'visual-judge-out'));
const ROUTE_LIST = (flag('routes', '') || ROUTES.join(',')).split(',').filter(Boolean);
const vpArg = flag('viewports', DEFAULT_VIEWPORTS.join(','));
const VP_LIST = vpArg === 'all' ? Object.keys(VIEWPORTS) : vpArg.split(',').filter(Boolean);
const FRAMES = Number(flag('frames', String(MAX_FRAMES)));
const CHANNEL = flag('channel', process.env.VJ_CHANNEL || '');
const ENGINE = flag('browser', 'chromium');

for (const v of VP_LIST) {
  if (!VIEWPORTS[v]) {
    console.error(`unknown viewport "${v}" (known: ${Object.keys(VIEWPORTS).join(', ')})`);
    process.exit(2);
  }
}

const slug = (route) => (route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Injected before any page script: collect CSP violations.
const INIT = () => {
  window.__vjCsp = [];
  document.addEventListener('securitypolicyviolation', (e) => {
    window.__vjCsp.push(`${e.violatedDirective} blocked ${e.blockedURI || 'inline'}`);
  });
};

// Runs in the page after each screen settles. Kept free of closures over
// Node values except the arguments passed in.
function frameFacts(retired) {
  const vh = innerHeight;
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className.trim()
      ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
      : '';
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };

  // A reveal counts as hidden only when a real share of it sits above the
  // bottom band (half of it, or 40% of the viewport) and it is still
  // transparent. The reveal observer uses rootMargin -48px at the bottom, so
  // anything in the last ~64px has not been asked to show yet: by design.
  const hidden = [];
  const floor = vh - 64;
  for (const el of document.querySelectorAll('.reveal, .stagger-children > *')) {
    const r = el.getBoundingClientRect();
    const shown = Math.min(r.bottom, floor) - Math.max(r.top, 0);
    if (r.width === 0 || shown < Math.min(r.height * 0.5, vh * 0.4)) continue;
    if (Number(getComputedStyle(el).opacity) < 0.05) hidden.push(describe(el));
  }

  const colorHits = {};
  const props = ['color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'borderBottomColor',
    'outlineColor', 'boxShadow', 'fill', 'stroke', 'textDecorationColor'];
  let scanned = 0;
  for (const el of document.querySelectorAll('body *')) {
    if (scanned > 6000) break;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh || r.width === 0 || r.height === 0) continue;
    scanned++;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    for (const p of props) {
      // outline and text-decoration colors default to currentColor; they
      // only paint when the outline or decoration exists.
      if (p === 'outlineColor' && cs.outlineStyle === 'none') continue;
      if (p === 'textDecorationColor' && cs.textDecorationLine === 'none') continue;
      const v = cs[p];
      if (!v || v === 'none') continue;
      for (const [name, rgb] of Object.entries(retired)) {
        if (v.includes(rgb)) {
          (colorHits[name] ||= new Set()).add(`${describe(el)} (${p})`);
        }
      }
    }
  }
  const retiredColors = Object.fromEntries(Object.entries(colorHits).map(([k, s]) => [k, [...s].slice(0, 8)]));

  return { scrollY: Math.round(scrollY), hiddenReveals: [...new Set(hidden)].slice(0, 10), retiredColors };
}

function pageFacts() {
  const over = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  // An empty or placeholder src resolves to the page URL; that is not a
  // broken asset.
  const broken = [...document.images]
    .filter((i) => {
      const src = i.currentSrc || i.src;
      return i.complete && i.naturalWidth === 0 && src && (i.getAttribute('src') || i.currentSrc) && src !== location.href;
    })
    .map((i) => (i.currentSrc || i.src).replace(location.origin, ''))
    .slice(0, 10);
  const text = document.body.innerText || '';
  const dashes = [];
  let at = text.indexOf('—');
  while (at >= 0 && dashes.length < 5) {
    dashes.push(text.slice(Math.max(0, at - 40), at + 40).replace(/\s+/g, ' '));
    at = text.indexOf('—', at + 1);
  }
  return { overflowX: Math.max(0, over), brokenImages: broken, emDash: dashes, csp: [...new Set(window.__vjCsp || [])].slice(0, 10) };
}

// Duo law, applied everywhere: the first h1 must clear the header.
function titleFacts() {
  const h1 = document.querySelector('h1');
  const header = document.querySelector('#site-header');
  if (!h1 || !header) return null;
  const hb = header.getBoundingClientRect().bottom;
  const ht = h1.getBoundingClientRect().top;
  return ht + 1 < hb ? `h1 top ${Math.round(ht)}px is under the header bottom ${Math.round(hb)}px` : null;
}

async function settle(page, maxMs = 3500) {
  // Lenis eases for ~1.4s; wait until scrollY holds still.
  let last = -1;
  let still = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const y = await page.evaluate(() => scrollY);
    still = y === last ? still + 1 : 0;
    if (still >= 3) break;
    last = y;
    await sleep(150);
  }
  await sleep(450); // reveal transitions (opacity 0 -> 1) run after the IO fires
}

async function walk(browser, route, vpName) {
  const vp = VIEWPORTS[vpName];
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor,
    isMobile: ENGINE === 'chromium' ? !!vp.isMobile : undefined,
    hasTouch: !!vp.hasTouch,
  });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e).slice(0, 200)));

  const dir = path.join(OUT, 'frames', `${slug(route)}--${vpName}`);
  fs.mkdirSync(dir, { recursive: true });
  const entry = { route, viewport: vpName, size: `${vp.width}x${vp.height}`, frames: [], facts: {} };

  let status = 0;
  try {
    const res = await page.goto(BASE + route, { waitUntil: 'load', timeout: 45000 });
    status = res ? res.status() : 0;
  } catch (e) {
    entry.facts.loadError = String(e.message || e).slice(0, 200);
  }
  entry.status = status;
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await settle(page);
  entry.facts.titleUnderHeader = await page.evaluate(titleFacts).catch(() => null);

  const hidden = new Set();
  const colors = {};
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const screens = Math.max(1, Math.ceil(total / vp.height));
  const n = Math.min(FRAMES, screens);
  // Evenly spaced stops from the top to the last full screen.
  const maxY = Math.max(0, total - vp.height);
  const stops = n === 1 ? [0] : Array.from({ length: n }, (_, i) => Math.round((maxY * i) / (n - 1)));

  await page.mouse.move(vp.width / 2, vp.height / 2);
  for (let i = 0; i < stops.length; i++) {
    if (i > 0) {
      // Real wheel input, in modest steps, so Lenis and every
      // IntersectionObserver see an ordinary scroll.
      let y = await page.evaluate(() => scrollY);
      let guard = 0;
      while (y < stops[i] - 4 && guard++ < 60) {
        const step = Math.min(420, stops[i] - y);
        await page.mouse.wheel(0, step);
        await sleep(90);
        y = await page.evaluate(() => scrollY);
      }
      await settle(page);
    }
    let f = await page.evaluate(frameFacts, RETIRED_COLORS).catch(() => ({ scrollY: -1, hiddenReveals: [], retiredColors: {} }));
    if (i > 0 && f.scrollY === entry.frames[entry.frames.length - 1]?.scrollY) continue; // page ended early
    if (f.hiddenReveals.length) {
      // Give a slow transition one more chance; only persistent blanks count.
      await sleep(1500);
      f = await page.evaluate(frameFacts, RETIRED_COLORS).catch(() => f);
    }
    f.hiddenReveals.forEach((h) => hidden.add(h));
    for (const [k, v] of Object.entries(f.retiredColors)) colors[k] = [...new Set([...(colors[k] || []), ...v])].slice(0, 8);
    const file = path.join(dir, `${String(entry.frames.length + 1).padStart(2, '0')}.png`);
    await page.screenshot({ path: file, scale: 'css' });
    entry.frames.push({ file: path.relative(OUT, file), scrollY: f.scrollY, hiddenReveals: f.hiddenReveals });
  }

  Object.assign(entry.facts, await page.evaluate(pageFacts).catch(() => ({})));
  entry.facts.hiddenReveals = [...hidden];
  entry.facts.retiredColors = colors;
  entry.facts.consoleErrors = [...new Set(consoleErrors)].slice(0, 10);
  entry.facts.pageErrors = [...new Set(pageErrors)].slice(0, 10);
  entry.facts.pageHeight = total;
  await ctx.close();
  return entry;
}

const run = async () => {
  fs.rmSync(path.join(OUT, 'frames'), { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const engine = ENGINE === 'webkit' ? webkit : chromium;
  const browser = await engine.launch(CHANNEL ? { channel: CHANNEL } : {});
  console.log(`visual-judge capture  base=${BASE}  ${ROUTE_LIST.length} routes x ${VP_LIST.length} viewports`);
  const pages = [];
  for (const route of ROUTE_LIST) {
    for (const vp of VP_LIST) {
      const t0 = Date.now();
      const e = await walk(browser, route, vp);
      pages.push(e);
      const flags = [
        e.status !== 200 && `HTTP ${e.status}`,
        e.facts.overflowX > 0 && `overflow ${e.facts.overflowX}px`,
        e.facts.hiddenReveals.length && `${e.facts.hiddenReveals.length} hidden`,
        Object.keys(e.facts.retiredColors).length && 'retired color',
        e.facts.emDash?.length && 'em dash',
      ].filter(Boolean);
      console.log(`  ${flags.length ? '!' : '·'} ${route} @ ${vp}  ${e.frames.length} frames  ${((Date.now() - t0) / 1000).toFixed(1)}s${flags.length ? '  ' + flags.join(', ') : ''}`);
    }
  }
  await browser.close();
  const manifest = { base: BASE, capturedAt: new Date().toISOString(), engine: ENGINE, pages };
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nmanifest -> ${path.relative(process.cwd(), path.join(OUT, 'manifest.json'))}`);
};

run().catch((e) => { console.error(e); process.exit(1); });
