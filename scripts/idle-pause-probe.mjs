// Headless count of live canvas contexts on /about/ and /beyond/.
// Also launches Chromium with WebGL disabled and checks the 2.5D fallback.
// Usage: PROBE_BASE=http://localhost:4321 node scripts/idle-pause-probe.mjs
import { chromium } from '@playwright/test';

const base = process.env.PROBE_BASE || 'http://localhost:4321';

function installCounter() {
  const orig = HTMLCanvasElement.prototype.getContext;
  const rows = [];
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    const ctx = orig.call(this, type, attrs);
    if (ctx) rows.push(String(type) + '|' + (this.className || ''));
    return ctx;
  };
  window.__ctxRows = rows;
}

async function readPage(browser, path) {
  const page = await browser.newPage();
  await page.addInitScript(installCounter);
  const fetched = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/data/kinetic/')) fetched.push(url.split('?')[0]);
  });
  await page.goto(base + path, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(1000);
  const dom = await page.evaluate(() => {
    const rows = window.__ctxRows || [];
    const tally = (prefix) => rows.filter((row) => row.startsWith(prefix)).length;
    const fallbacks = [...document.querySelectorAll('.plate-fallback')].map((el) => {
      const prev = el.previousElementSibling;
      return {
        display: getComputedStyle(el).display,
        siblingWebgl: prev ? prev.getAttribute('data-webgl') : null,
      };
    });
    return {
      ctx2d: tally('2d'),
      webgl: tally('webgl'),
      rows,
      fallbacks,
      unsupported: document.querySelectorAll('[data-webgl="unsupported"]').length,
      k3: document.querySelectorAll('.kplate3d').length,
      k2: document.querySelectorAll('.kinetic-plate').length,
    };
  });
  await page.close();
  const unique = [...new Set(fetched)];
  return { path, fetches: fetched.length, unique: unique.length, urls: unique, ...dom };
}

const run = async () => {
  const webgl = await chromium.launch();
  const withGl = {
    about: await readPage(webgl, '/about/'),
    beyond: await readPage(webgl, '/beyond/'),
  };
  await webgl.close();

  const noGl = await chromium.launch({
    args: ['--disable-3d-apis', '--disable-webgl', '--disable-webgl2'],
  });
  const blocked = {
    about: await readPage(noGl, '/about/'),
    beyond: await readPage(noGl, '/beyond/'),
  };
  await noGl.close();

  const report = { base, withGl, blocked };
  console.log(JSON.stringify(report, null, 2));

  const about2d = withGl.about.ctx2d;
  const fallbackShown = blocked.about.fallbacks.every((f) => f.display !== 'none');
  const marked = blocked.about.unsupported >= blocked.about.k3 && blocked.about.k3 > 0;
  const fallbackPaint = blocked.about.ctx2d >= blocked.about.k3 * 8;
  if (!fallbackShown || !marked || !fallbackPaint) {
    console.error('no-WebGL fallback check failed');
    process.exit(1);
  }
  console.log('about 2d contexts with WebGL: ' + about2d);
  console.log('no-WebGL fallback: shown, ' + blocked.about.ctx2d + ' 2d contexts');
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
