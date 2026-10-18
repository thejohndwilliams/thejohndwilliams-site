import { test, expect } from '@playwright/test';

// No-JS floor: .reveal starts at opacity 0 and script adds .visible.
// @media (scripting: none) must show the content when script never runs.
const PATHS = ['/', '/about/', '/work/'] as const;

test.describe('reveal stays visible with JavaScript disabled', () => {
  for (const path of PATHS) {
    test(`${path} .reveal computed opacity is 1`, async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      try {
        await page.goto(path);
        const reveals = page.locator('.reveal');
        const count = await reveals.count();
        expect(count).toBeGreaterThan(0);
        const opacities = await reveals.evaluateAll((els) =>
          els.map((el) => getComputedStyle(el).opacity)
        );
        expect(opacities).toHaveLength(count);
        for (const opacity of opacities) expect(opacity).toBe('1');
      } finally {
        await context.close();
      }
    });
  }
});
