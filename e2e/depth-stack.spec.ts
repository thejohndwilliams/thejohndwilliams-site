import { mkdirSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

const CSP = [
  "default-src 'self'",
  "script-src 'self' https://static.cloudflareinsights.com",
  "style-src 'self'",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://cloudflareinsights.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

async function arm(page: Page): Promise<string[]> {
  const problems: string[] = [];
  await page.addInitScript(() => {
    window.addEventListener('securitypolicyviolation', (event) => {
      const hit = event as SecurityPolicyViolationEvent;
      const note = JSON.stringify({
        d: hit.violatedDirective,
        b: hit.blockedURI,
        s: (hit.sample || '').slice(0, 160),
        src: hit.sourceFile,
        line: hit.lineNumber,
      });
      (window as Window & { __csp?: string[] }).__csp = [
        ...((window as Window & { __csp?: string[] }).__csp || []),
        note,
      ];
    });
  });
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(msg.text());
  });
  await page.route('**/*', async (route) => {
    let response;
    try {
      response = await route.fetch();
    } catch {
      response = await route.fetch();
    }
    const headers = { ...response.headers(), 'content-security-policy': CSP };
    await route.fulfill({ response, headers });
  });
  return problems;
}

// WebKit reports style-src-elem "inline" at line 5 with an empty sample once
// per screenshot. Chromium does not. The blocked sheet is not in the DOM
// afterwards and setProperty calls in the keyboard test do not trip it.
function ownViolations(notes: string[], browserName: string): string[] {
  if (browserName !== 'webkit') return notes;
  return notes.filter((note) => {
    try {
      const hit = JSON.parse(note) as { d?: string; b?: string; s?: string; line?: number };
      return !(hit.d === 'style-src-elem' && hit.b === 'inline' && !hit.s && hit.line === 5);
    } catch {
      return true;
    }
  });
}

function ownProblems(problems: string[], browserName: string): string[] {
  if (browserName !== 'webkit') return problems;
  return problems.filter((item) => !item.startsWith('Refused to apply a stylesheet because its hash'));
}

async function sepOf(page: Page): Promise<number> {
  return page.locator('#depth-stack').evaluate((el) => {
    const raw = getComputedStyle(el).getPropertyValue('--sep');
    return Number.parseFloat(raw) || 0;
  });
}

async function settle(page: Page, value: number): Promise<void> {
  const range = page.locator('#depth-separation');
  await range.evaluate((el, next) => {
    const input = el as HTMLInputElement;
    input.value = String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await expect.poll(() => sepOf(page), { timeout: 2500 }).toBeCloseTo(value, 1);
}

test.describe('exploded depth stack', () => {
  test('keyboard range scrubs separation and replay runs again', async ({ page, browserName }) => {
    const problems = await arm(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/depth/?still=flat');
    const source = await page.request.get('/depth/?still=flat');
    const html = await source.text();
    expect(html).toContain('noindex');
    expect(html).not.toContain('\u2014');
    expect(html).not.toMatch(/\sstyle="/);
    expect(html).not.toMatch(/<style[\s>]/);
    const lower = html.toLowerCase();
    for (const word of ['purchase', 'sale', 'price', 'edition', 'inquire', 'licence', 'license']) {
      expect(lower, word).not.toMatch(new RegExp(`\\b${word}\\b`));
    }

    const range = page.locator('#depth-separation');
    await expect(range).toBeEnabled();
    await range.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    expect(Number(await range.inputValue())).toBeGreaterThan(0);
    await expect.poll(() => sepOf(page), { timeout: 2500 }).toBeGreaterThan(0.01);

    await page.keyboard.press('End');
    await expect.poll(() => sepOf(page), { timeout: 2500 }).toBeCloseTo(1, 1);
    await expect(page.locator('.depth-stack__tag').first()).toBeVisible();

    await page.keyboard.press('Home');
    await expect.poll(() => sepOf(page), { timeout: 2500 }).toBeCloseTo(0, 1);

    const csp = await page.evaluate(() => (window as Window & { __csp?: string[] }).__csp || []);
    expect(ownViolations(csp, browserName), ownProblems(problems, browserName).join('\n')).toEqual([]);
    expect(ownProblems(problems, browserName)).toEqual([]);
  });

  test('drag, hover, and mobile labels', async ({ page, browserName }, testInfo) => {
    const problems = await arm(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/depth/?still=flat');
    await settle(page, 0);
    await page.screenshot({
      path: `/opt/cursor/artifacts/screenshots/depth-stack/${testInfo.project.name}-1280-assembled.png`,
    });

    const view = page.locator('.depth-stack__view');
    const box = await view.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;
    await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.55);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.28, { steps: 8 });
    await page.screenshot({
      path: `/opt/cursor/artifacts/screenshots/depth-stack/${testInfo.project.name}-1280-mid.png`,
    });
    await page.mouse.up();
    await expect.poll(() => sepOf(page), { timeout: 2500 }).toBeGreaterThan(0.2);

    await settle(page, 1);
    await expect(page.getByText('LAYER 1 FAR')).toBeVisible();
    await expect(page.getByText('LAYER 5 NEAR')).toBeVisible();
    const desktopLabels = await page.locator('.depth-stack__tag').evaluateAll((els) =>
      els.filter((el) => getComputedStyle(el).display !== 'none').length,
    );
    expect(desktopLabels).toBe(5);
    const plate = page.locator('.depth-stack__plate[data-i="4"]');
    await plate.focus();
    const dimmed = await page.locator('.depth-stack__plate[data-i="1"]').evaluate((el) => {
      return Number.parseFloat(getComputedStyle(el).opacity);
    });
    expect(dimmed).toBeLessThan(0.7);
    await page.screenshot({
      path: `/opt/cursor/artifacts/screenshots/depth-stack/${testInfo.project.name}-1280-exploded.png`,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/depth/?still=open');
    await expect.poll(() => sepOf(page), { timeout: 2500 }).toBeCloseTo(1, 1);
    const mobileLabels = await page.locator('.depth-stack__tag').evaluateAll((els) =>
      els.filter((el) => getComputedStyle(el).display !== 'none').map((el) => el.textContent),
    );
    expect(mobileLabels).toEqual(['LAYER 1 FAR', 'LAYER 2', 'LAYER 3', 'LAYER 4', 'LAYER 5 NEAR']);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `/opt/cursor/artifacts/screenshots/depth-stack/${testInfo.project.name}-390-exploded.png`,
    });
    await settle(page, 0.45);
    await page.screenshot({
      path: `/opt/cursor/artifacts/screenshots/depth-stack/${testInfo.project.name}-390-mid.png`,
    });
    await settle(page, 0);
    await page.screenshot({
      path: `/opt/cursor/artifacts/screenshots/depth-stack/${testInfo.project.name}-390-assembled.png`,
    });

    const csp = await page.evaluate(() => (window as Window & { __csp?: string[] }).__csp || []);
    expect(ownViolations(csp, browserName), ownProblems(problems, browserName).join('\n')).toEqual([]);
    expect(ownProblems(problems, browserName)).toEqual([]);
  });

  test('touch drag is horizontal only', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'touch input is driven through CDP');
    await arm(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/depth/?still=flat');
    const view = page.locator('.depth-stack__view');
    const box = await view.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;
    const client = await page.context().newCDPSession(page);
    const startX = box.x + 40;
    const startY = box.y + box.height * 0.5;
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: startY }],
    });
    for (let i = 1; i <= 6; i += 1) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: startX, y: startY + i * 28 }],
      });
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect(await sepOf(page)).toBeLessThan(0.08);

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y: startY }],
    });
    for (let i = 1; i <= 8; i += 1) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: startX + i * 22, y: startY }],
      });
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => sepOf(page), { timeout: 2500 }).toBeGreaterThan(0.15);
  });

  test('autoplay runs once', async ({ page }) => {
    await arm(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/depth/');
    await expect.poll(() => sepOf(page), { timeout: 4000 }).toBeGreaterThan(0.4);
    await expect.poll(() => sepOf(page), { timeout: 12000 }).toBeLessThan(0.05);
    await page.locator('.depth-stack__replay').click();
    await expect.poll(() => sepOf(page), { timeout: 4000 }).toBeGreaterThan(0.4);
  });
});

test('reduced motion holds the labelled still and the slider still moves', async ({ browser, browserName }) => {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 1280, height: 800 },
    javaScriptEnabled: true,
  });
  const page = await context.newPage();
  const problems = await arm(page);
  try {
    await page.goto('/depth/');
    await expect.poll(() => sepOf(page), { timeout: 3000 }).toBeCloseTo(1, 1);
    await expect(page.getByText('LAYER 1 FAR')).toBeVisible();
    const duration = await page.locator('.depth-stack__stage').evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(duration.replace(/\s/g, '')).toMatch(/^(0s|0ms)(,(0s|0ms))*$/);
    const range = page.locator('#depth-separation');
    await range.focus();
    await page.keyboard.press('Home');
    await expect.poll(() => sepOf(page), { timeout: 1000 }).toBeCloseTo(0, 1);
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/depth-stack/reduced-1280.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.keyboard.press('End');
    await expect.poll(() => sepOf(page), { timeout: 1000 }).toBeCloseTo(1, 1);
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/depth-stack/reduced-390.png' });
    const csp = await page.evaluate(() => (window as Window & { __csp?: string[] }).__csp || []);
    expect(ownViolations(csp, browserName), ownProblems(problems, browserName).join('\n')).toEqual([]);
    expect(ownProblems(problems, browserName)).toEqual([]);
  } finally {
    await context.close();
  }
});

test('no-js shows the flat photograph only', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  try {
    await page.goto('/depth/');
    const photo = page.locator('.depth-stack__base');
    await expect(photo).toBeVisible();
    await expect(photo).toHaveAttribute('alt', /canyon walls/);
    await expect(page.locator('#depth-separation')).toBeHidden();
    await expect(page.locator('.depth-stack__replay')).toBeHidden();
    await expect(page.locator('.depth-stack__tag').first()).toBeHidden();
    await expect(page.locator('img[src*="layer2"]')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(/\b(inquire|purchase|edition|licen[cs]e|sale|price)\b/i);
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/depth-stack/nojs-1280.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/depth-stack/nojs-390.png' });
  } finally {
    await context.close();
  }
});

const MATRIX: [string, number, number][] = [
  ['laptop-1280x720', 1280, 720],
  ['laptop-1366x768', 1366, 768],
  ['laptop-1440x900', 1440, 900],
  ['ipad-768x1024', 768, 1024],
  ['ipad-820x1180', 820, 1180],
  ['ipad-1024x768', 1024, 768],
  ['ipad-1180x820', 1180, 820],
  ['desktop-1920x1080', 1920, 1080],
  ['desktop-2560x1440', 2560, 1440],
  ['iphone-375x667', 375, 667],
  ['iphone-390x844', 390, 844],
  ['iphone-430x932', 430, 932],
  ['duo-540x720', 540, 720],
  ['duo-720x540', 720, 540],
  ['duo-1114x720', 1114, 720],
];

test('viewport matrix keeps every exploded stack fully on screen', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'the matrix is captured once');
  test.setTimeout(240000);
  const problems = await arm(page);
  const dir = '/opt/cursor/artifacts/screenshots/depth-stack/matrix';
  mkdirSync(dir, { recursive: true });
  const issues: string[] = [];

  for (const [name, width, height] of MATRIX) {
    await page.setViewportSize({ width, height });

    await page.goto('/depth/?still=flat');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('#depth-stack')).toHaveClass(/is-on/, { timeout: 5000 });
    await expect(page.locator('#depth-stack')).not.toHaveClass(/is-run/);
    await page.screenshot({
      path: `${dir}/${name}-assembled.jpeg`,
      type: 'jpeg',
      quality: 82,
    });

    await page.goto('/depth/?still=open');
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => sepOf(page), { timeout: 5000 }).toBeCloseTo(1, 1);
    await page.waitForSelector('#depth-stack.has-far', { timeout: 5000 });
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    const shot = await page.evaluate(() => {
      const box = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, r: r.right, b: r.bottom, w: r.width, h: r.height };
      };
      const header = document.querySelector('#site-header');
      const cap = document.querySelector('.depth-stack__cap');
      const fit = document.querySelector('.depth-stack__fit');
      const replay = document.querySelector('.depth-stack__replay');
      const tags = [...document.querySelectorAll('.depth-stack__tag')].map((el) => ({
        t: (el.textContent || '').trim(),
        ...box(el),
      }));
      const plates = [...document.querySelectorAll('.depth-stack__plate')].map((el) => box(el));
      return {
        vw: window.innerWidth,
        vh: window.innerHeight,
        dpr: window.devicePixelRatio,
        scrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        scrollY: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        headerBottom: header ? header.getBoundingClientRect().bottom : 0,
        cap: cap ? box(cap) : null,
        fit: fit ? box(fit) : null,
        replay: replay ? box(replay) : null,
        tags,
        plates,
      };
    });
    await page.screenshot({
      path: `${dir}/${name}-exploded.jpeg`,
      type: 'jpeg',
      quality: 82,
    });

    const local: string[] = [];
    if (shot.scrollX > 1) local.push(`horizontal overflow ${shot.scrollX}`);
    if (shot.scrollY > 2) local.push(`vertical overflow ${shot.scrollY}`);
    if (!shot.fit) local.push('missing stage');
    else {
      if (shot.fit.w * shot.dpr > 1601) local.push(`device px ${Math.round(shot.fit.w * shot.dpr)}`);
      if (shot.fit.w > 1601) local.push(`css width ${Math.round(shot.fit.w)}`);
      const floor = Math.min(shot.vw * 0.28, 240);
      if (shot.fit.w < floor) local.push(`stage narrow ${Math.round(shot.fit.w)} < ${Math.round(floor)}`);
    }
    if (shot.tags.length !== 5) local.push(`labels ${shot.tags.length}`);
    shot.tags.forEach((tag, index) => {
      if (tag.w < 8 || tag.h < 8) local.push(`${tag.t} has no box`);
      if (tag.x < -1 || tag.y < -1 || tag.r > shot.vw + 1 || tag.b > shot.vh + 1) {
        local.push(`${tag.t} clipped ${Math.round(tag.x)},${Math.round(tag.y)},${Math.round(tag.r)},${Math.round(tag.b)}`);
      }
      if (tag.y < shot.headerBottom - 1) local.push(`${tag.t} under header`);
      const plate = shot.plates[index];
      if (plate && tag.x < plate.r - 2) {
        local.push(`${tag.t} overlaps plate by ${Math.round(plate.r - tag.x)}`);
      }
    });
    for (let i = 0; i < shot.tags.length; i += 1) {
      for (let j = i + 1; j < shot.tags.length; j += 1) {
        const a = shot.tags[i];
        const b = shot.tags[j];
        const hit = a.x < b.r - 1 && b.x < a.r - 1 && a.y < b.b - 1 && b.y < a.b - 1;
        if (hit) local.push(`${a.t} overlaps ${b.t}`);
      }
    }
    for (const plate of shot.plates) {
      if (plate.x < -1 || plate.y < -1 || plate.r > shot.vw + 1 || plate.b > shot.vh + 1) {
        local.push(`plate clipped ${Math.round(plate.x)},${Math.round(plate.y)},${Math.round(plate.r)},${Math.round(plate.b)}`);
      }
      if (shot.cap && plate.b > shot.cap.y + 2) local.push('plate hits caption');
    }
    if (shot.replay && (shot.replay.y < 0 || shot.replay.b > shot.vh + 1)) {
      local.push(`replay offscreen bottom ${Math.round(shot.replay.b)} vh ${shot.vh}`);
    }
    if (local.length) issues.push(`${name}: ${local.join('; ')}`);
  }

  expect(issues, `${issues.join('\n')}\n${problems.join('\n')}`).toEqual([]);
  expect(problems).toEqual([]);
});

test('a 2x display does not ask the 1600px master to stretch', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'device scale is checked once');
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  try {
    await page.goto('/depth/?still=open');
    await expect.poll(() => sepOf(page), { timeout: 5000 }).toBeCloseTo(1, 1);
    const width = await page.locator('.depth-stack__fit').evaluate((el) => el.getBoundingClientRect().width);
    const dpr = await page.evaluate(() => window.devicePixelRatio);
    expect(dpr).toBe(2);
    expect(width).toBeLessThanOrEqual(801);
    expect(width * dpr).toBeLessThanOrEqual(1601);
  } finally {
    await context.close();
  }
});
