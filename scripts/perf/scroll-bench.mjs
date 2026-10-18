// Headless Chromium scroll bench. Not part of the site build.
// CPU throttle 4x, 1440x900, load, wait 4s, then synthesizeScrollGesture
// swipes of 560px at 1400px/s, 250ms apart, until the page bottom.
// Records requestAnimationFrame deltas and idle Lenis raf activity.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const BASE = process.env.BENCH_URL || 'http://127.0.0.1:4321';
const PAGES = (process.env.BENCH_PAGES || '/,/work,/beyond,/photography').split(',');
const RUNS = Number(process.env.BENCH_RUNS || 3);
const LABEL = process.env.BENCH_LABEL || 'run';
const OUT = process.env.BENCH_OUT || `/tmp/bench-${LABEL}.json`;

function summarize(deltas) {
  if (!deltas.length) return { mean: null, p95: null, over33: 0, frames: 0 };
  const sorted = [...deltas].sort((a, b) => a - b);
  const mean = deltas.reduce((s, n) => s + n, 0) / deltas.length;
  const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
  const over33 = deltas.filter((d) => d > 33).length;
  return {
    mean: Math.round(mean * 100) / 100,
    p95: Math.round(p95 * 100) / 100,
    over33,
    frames: deltas.length,
  };
}

async function measure(browser, path) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now();
  await page.goto(BASE + path, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(4000);

  const idle = await page.evaluate(async () => {
    const orig = window.requestAnimationFrame.bind(window);
    let calls = 0;
    window.requestAnimationFrame = (cb) => {
      calls += 1;
      return orig(cb);
    };
    const lenis = window.__lenis;
    let lenisRaf = 0;
    if (lenis && typeof lenis.raf === 'function') {
      const origRaf = lenis.raf.bind(lenis);
      lenis.raf = (time) => {
        lenisRaf += 1;
        return origRaf(time);
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      rafCalls: calls,
      lenisRaf,
      hasLenis: !!lenis,
      isScrolling: lenis ? lenis.isScrolling : null,
    };
  });

  await page.evaluate(() => {
    window.__deltas = [];
    let last = performance.now();
    const loop = (t) => {
      window.__deltas.push(t - last);
      last = t;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });

  let gestures = 0;
  let stagnant = 0;
  let lastY = -1;
  const scrollStart = Date.now();
  while (Date.now() - scrollStart < 90000) {
    const pos = await page.evaluate(() => ({
      y: window.scrollY,
      max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
    }));
    if (pos.max < 4 || pos.y >= pos.max - 4) break;
    if (Math.abs(pos.y - lastY) < 2) stagnant += 1;
    else stagnant = 0;
    lastY = pos.y;
    if (stagnant >= 6) break;
    await client.send('Input.synthesizeScrollGesture', {
      x: 720,
      y: 450,
      yDistance: -560,
      speed: 1400,
    });
    gestures += 1;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(1800);

  const deltas = await page.evaluate(() => window.__deltas || []);
  const end = await page.evaluate(() => ({
    y: window.scrollY,
    max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
    lenis: !!window.__lenis,
    isScrolling: window.__lenis ? window.__lenis.isScrolling : null,
  }));
  await page.close();
  return {
    path,
    elapsedMs: Date.now() - t0,
    gestures,
    end,
    idle,
    ...summarize(deltas),
  };
}

const browser = await chromium.launch({ headless: true });
const results = [];
for (const path of PAGES) {
  for (let run = 1; run <= RUNS; run += 1) {
    const row = await measure(browser, path);
    row.run = run;
    results.push(row);
    console.log(JSON.stringify({
      label: LABEL,
      path,
      run,
      mean: row.mean,
      p95: row.p95,
      over33: row.over33,
      frames: row.frames,
      gestures: row.gestures,
      endY: row.end.y,
      maxY: row.end.max,
      idleRaf: row.idle.rafCalls,
      idleLenisRaf: row.idle.lenisRaf,
    }));
  }
}
await browser.close();
const payload = {
  label: LABEL,
  base: BASE,
  viewport: '1440x900',
  cpuThrottle: 4,
  note: 'Headless Chromium, software rendering. Relative only.',
  results,
};
writeFileSync(OUT, JSON.stringify(payload, null, 2));
console.log('wrote', OUT);
