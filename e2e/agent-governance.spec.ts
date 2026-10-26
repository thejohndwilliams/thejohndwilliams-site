import { test, expect, type Page } from '@playwright/test';

const PATH = '/work/agent-governance/';
const TITLE = 'Human Oversight for a Multi-Agent System: Approval Gates, Evidence and Separation of Duties';

async function overflowPx(page: Page): Promise<number> {
  return page.evaluate(() => {
    const d = document.documentElement;
    return Math.max(d.scrollWidth - d.clientWidth, document.body.scrollWidth - d.clientWidth);
  });
}

test.describe('Agent governance case study', () => {
  test('steps the gates from the keyboard and keeps focus visible', async ({ page }) => {
    await page.goto(PATH);
    const gate = page.locator('[data-gov="gate"]');
    await expect(page.locator('h1')).toHaveText(TITLE);
    await expect(page.getByText('Personal project.')).toBeVisible();
    await expect(page.getByText('An independent challenger')).toBeVisible();
    const intake = gate.getByRole('tab', { name: /1 Intake/ });
    await expect(intake).toBeVisible();
    await expect(gate.locator('img')).toBeHidden();
    await intake.focus();
    await page.keyboard.press('ArrowRight');
    const risk = gate.getByRole('tab', { name: /2 Risk check/ });
    await expect(risk).toHaveAttribute('aria-selected', 'true');
    await expect(risk).toBeFocused();
    expect(await risk.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
    expect(await risk.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
    await expect(gate.getByRole('tabpanel')).toContainText('Gated act? Fixed rule?');
    await page.keyboard.press('ArrowRight');
    const approval = gate.getByRole('tab', { name: /3 Approval authority/ });
    await expect(approval).toHaveAttribute('aria-selected', 'true');
    await expect(gate.getByRole('tabpanel')).toContainText('HUMAN CHECKPOINT');
    await expect(gate.locator('[data-gov-escalate]')).toContainText('ties, rule conflicts and blocked actions go to the Operator');
  });

  test('steps the illustrative audit trail and keeps the invented dates visible', async ({ page }) => {
    await page.goto(PATH);
    const audit = page.locator('[data-gov="audit"]');
    const live = audit.locator('[data-gov-live]');
    await expect(live.getByText('ILLUSTRATIVE · SYNTHETIC DATA')).toBeVisible();
    await expect(live.getByText('Entries are invented to show the record format, not taken from any real log.')).toBeVisible();
    await audit.getByRole('tab', { name: /2026-03-02 09:14/ }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(audit.getByRole('tab', { name: /2026-03-02 10:05/ })).toHaveAttribute('aria-selected', 'true');
    await expect(audit.getByRole('tabpanel')).toContainText('No merge: gate requires dated approval');
    await expect(audit.getByRole('tabpanel')).toContainText('2026-03-02 10:05');
  });

  test('filters the control map by NIST function and keeps the theme note', async ({ page }) => {
    await page.goto(PATH);
    const map = page.locator('[data-gov="map"]');
    await expect(map.locator('[data-gov-live]').getByText('Mapped by theme, not certified')).toBeVisible();
    await expect(page.locator('.gov-colophon')).toHaveText('Not endorsed by or affiliated with NIST or ISO.');
    await map.getByRole('radio', { name: 'Measure' }).click();
    await expect(map.getByRole('radio', { name: 'Measure' })).toHaveAttribute('aria-checked', 'true');
    await expect(map.getByRole('row', { name: /Evidence before closing/ })).toBeVisible();
    await expect(map.getByRole('row', { name: /Approval gates and non-waivable rules/ })).toBeHidden();
    await map.getByRole('radio', { name: 'Measure' }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(map.getByRole('radio', { name: 'Map' })).toHaveAttribute('aria-checked', 'true');
    await expect(map.getByRole('row', { name: /Untrusted content treated as data/ })).toBeVisible();
  });

  for (const width of [390, 820, 1280]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(PATH);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('h1')).toBeVisible();
      expect(await overflowPx(page), `${width}px`).toBeLessThanOrEqual(0);
      await page.locator('[data-gov="gate"]').getByRole('tab', { name: /5 Monitoring/ }).click();
      expect(await overflowPx(page), `${width}px after step`).toBeLessThanOrEqual(0);
      await page.locator('[data-gov="map"]').getByRole('radio', { name: 'Govern' }).click();
      expect(await overflowPx(page), `${width}px after filter`).toBeLessThanOrEqual(0);
    });
  }

  test('reduced motion keeps the static SVG', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(PATH);
      await expect(page.locator('[data-gov="gate"] img')).toBeVisible();
      await expect(page.locator('[data-gov="audit"] img')).toBeVisible();
      await expect(page.locator('[data-gov="map"] img')).toBeVisible();
      await expect(page.getByRole('tab')).toHaveCount(0);
      await expect(page.locator('[data-gov="audit"] [data-gov-fallback]').getByText('ILLUSTRATIVE · SYNTHETIC DATA')).toBeVisible();
      await expect(page.locator('[data-gov="map"] [data-gov-fallback]').getByText('Mapped by theme, not certified')).toBeVisible();
      expect(await overflowPx(page)).toBeLessThanOrEqual(0);
    } finally {
      await context.close();
    }
  });

  test('no-js keeps the static SVG', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    try {
      await page.setViewportSize({ width: 820, height: 900 });
      await page.goto(PATH);
      await expect(page.locator('h1')).toHaveText(TITLE);
      await expect(page.locator('[data-gov="gate"] img')).toBeVisible();
      await expect(page.locator('[data-gov="gate"] [data-gov-live]')).toBeHidden();
      await expect(page.getByText('Personal project.')).toBeVisible();
      expect(await overflowPx(page)).toBeLessThanOrEqual(0);
    } finally {
      await context.close();
    }
  });
});
