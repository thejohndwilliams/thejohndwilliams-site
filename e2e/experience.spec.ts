import { expect, test } from '@playwright/test';

// The record on /work (src/components/ExperienceRecord.astro).
// Keyboard only: CI WebKit stalls animation frames mid-page on /work, and a
// mouse click waits on frames for its stability check; key presses do not.

test.describe('Work: the record', () => {
  test('an entry opens from the keyboard and lights its span', async ({ page }) => {
    await page.goto('/work/');
    const item = page.locator('[data-xp-item="spacex"]');
    const summary = item.locator('summary');
    await summary.focus();
    await expect(page.locator('[data-xp-span="spacex"]')).toHaveClass(/is-lit/);
    await page.keyboard.press('Enter');
    await expect(item.locator('details')).toHaveAttribute('open', '');
    await expect(item.locator('.xp-entry__line')).toContainText('Operations, risk and controls');
    await expect(item.locator('.xp-chip')).toHaveCount(4);
    await page.keyboard.press('Enter');
    await expect(item.locator('details')).not.toHaveAttribute('open', '');
  });

  test('six entries, newest first, and no sideways scroll on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/work/');
    const roles = await page.locator('.xp-entry__role').allTextContents();
    expect(roles).toEqual([
      'Process Specialist',
      'MBA, Cybersecurity',
      'SMB Account Manager',
      'Co-Founder, Technology Operations',
      'Technical Support Expert',
      'BA, Film and Digital Media',
    ]);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
  });
});
