// Visual-regression harness — catches the layout/structural regressions that
// historically only surfaced post-deploy (overflow, a dropped section, a broken
// nav, a footer collapse).
//
//   npm run visual:baseline        # capture/refresh baselines
//   npm run visual:check           # compare current render to baselines
//   ... -- --base https://<branch>.thejohndwilliams-site.pages.dev
//
// The trick that makes pixel-diffing viable on an animated site: every context
// runs with reducedMotion:'reduce'. Because the whole site honors reduced
// motion (plates render a single static frame, CSS animations freeze), the
// render is deterministic — so "everything animates" does NOT make this flaky.
// Complements scripts/audit-pages.mjs (which checks overflow/console/alt at
// widths); this catches *visual* drift the audit can't see.

import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = flag('base', process.env.VR_BASE || 'http://localhost:4321');
const update = args.includes('--update');
const threshold = Number(flag('threshold', '0.004')); // fraction of pixels allowed to differ
const settle = Number(flag('settle', '900'));
const BASELINE = path.join(ROOT, 'visual-baseline');
const DIFF = path.join(ROOT, 'visual-diff');

const TARGETS = [
  { name: 'home-desktop', url: '/', w: 1440, h: 900 },
  { name: 'home-mobile', url: '/', w: 390, h: 844 },
  { name: 'work-desktop', url: '/work/', w: 1440, h: 900 },
  { name: 'work-mobile', url: '/work/', w: 390, h: 844 },
  { name: 'photography-desktop', url: '/photography/', w: 1440, h: 900 },
  { name: 'about-desktop', url: '/about/', w: 1440, h: 900 },
  { name: 'about-mobile', url: '/about/', w: 390, h: 844 },
];

function readPNG(p) { return PNG.sync.read(fs.readFileSync(p)); }

async function shoot(browser, t) {
  const ctx = await browser.newContext({
    viewport: { width: t.w, height: t.h },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',     // freeze all motion -> deterministic capture
  });
  const page = await ctx.newPage();
  await page.goto(BASE + t.url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(settle);
  const buf = await page.screenshot({ fullPage: true });
  await ctx.close();
  return buf;
}

const run = async () => {
  fs.mkdirSync(BASELINE, { recursive: true });
  if (!update) fs.mkdirSync(DIFF, { recursive: true });
  // One-time prereq: `npx playwright install chromium-headless-shell`.
  const browser = await chromium.launch();
  let fails = 0;
  console.log(`visual-regress ${update ? '(baseline)' : '(check)'}  base=${BASE}`);
  for (const t of TARGETS) {
    const buf = await shoot(browser, t);
    const basePath = path.join(BASELINE, `${t.name}.png`);
    if (update) { fs.writeFileSync(basePath, buf); console.log(`  · ${t.name}  baseline saved`); continue; }
    if (!fs.existsSync(basePath)) { console.log(`  ? ${t.name}  no baseline (run visual:baseline)`); continue; }
    const cur = PNG.sync.read(buf);
    const base = readPNG(basePath);
    if (cur.width !== base.width || cur.height !== base.height) {
      console.log(`  ✗ ${t.name}  SIZE drift ${base.width}x${base.height} -> ${cur.width}x${cur.height}`);
      fails++; continue;
    }
    const diff = new PNG({ width: cur.width, height: cur.height });
    const changed = pixelmatch(base.data, cur.data, diff.data, cur.width, cur.height, { threshold: 0.1 });
    const ratio = changed / (cur.width * cur.height);
    if (ratio > threshold) {
      fs.writeFileSync(path.join(DIFF, `${t.name}.png`), PNG.sync.write(diff));
      console.log(`  ✗ ${t.name}  ${(ratio * 100).toFixed(2)}% changed (> ${(threshold * 100).toFixed(2)}%) -> visual-diff/${t.name}.png`);
      fails++;
    } else {
      console.log(`  ✓ ${t.name}  ${(ratio * 100).toFixed(2)}% changed`);
    }
  }
  await browser.close();
  if (!update && fails) { console.log(`\n${fails} target(s) drifted. Review visual-diff/, then re-baseline if intended.`); process.exit(1); }
  console.log(update ? '\nbaselines captured.' : '\nno visual drift.');
};

run().catch((e) => { console.error(e); process.exit(1); });
