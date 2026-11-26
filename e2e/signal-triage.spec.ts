import { test, expect } from '@playwright/test';

// Keyboard-driven e2e for /work/signal-triage/ (matches verification-gate.spec.ts).
test.describe('Signal triage case study', () => {
  test('toggling shingle deduplication blocks the release gate and re-enabling restores the clear verdict', async ({ page }) => {
    await page.goto('/work/signal-triage/');
    const consoleEl = page.locator('[data-sig-console]');
    const decision = consoleEl.locator('[data-sig-decision]');
    await expect(decision).toHaveText('Clears the gate');

    const dedup = consoleEl.locator('[data-clause="dedup"]');
    await dedup.focus();
    await page.keyboard.press('Enter');
    await expect(dedup).toHaveAttribute('aria-pressed', 'false');
    await expect(decision).toHaveText('Blocked at gate');
    await expect(consoleEl.locator('[data-sig-reasons]')).toContainText('below the 90% release gate');

    await page.keyboard.press('Enter');
    await expect(dedup).toHaveAttribute('aria-pressed', 'true');
    await expect(decision).toHaveText('Clears the gate');
  });

  test('cumulative stage table renders without script', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/work/signal-triage/');
    await expect(page.locator('.sig-stages tbody tr')).toHaveCount(5);
    await expect(page.locator('[data-sig-live]')).toBeHidden();
    await ctx.close();
  });
});
