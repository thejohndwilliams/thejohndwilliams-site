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

  test('proximity figure recounts per query form and the pre-send gate holds on a map mismatch', async ({ page }) => {
    await page.goto('/work/signal-triage/');
    const prox = page.locator('[data-sig-prox]');
    const tally = prox.locator('[data-sig-prox-tally]');
    await expect(tally).toHaveText('Keeps 2 of 2 witness reports and 0 of 4 noise posts.');
    const near = prox.locator('[data-prox-mode="near"]');
    await near.focus();
    await page.keyboard.press('Enter');
    await expect(near).toHaveAttribute('aria-pressed', 'true');
    await expect(tally).toHaveText('Keeps 2 of 2 witness reports and 3 of 4 noise posts.');

    const gate = page.locator('[data-sig-gate]');
    const map = gate.locator('[data-scenario-id="map"]');
    await map.focus();
    await page.keyboard.press('Enter');
    await expect(gate.locator('[data-sig-gate-outcome]')).toHaveText('Held');
    await expect(gate.locator('[data-check="map"]')).toHaveAttribute('data-fail', 'true');
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
