// Added 2026-07-02 after the transparent-lightbox incident. The viewer's
// backdrop utility, control positioning, and control sizing were all broken
// in production and nothing interaction-level ever opened the dialog: the
// build/vitest gates verify markup and shipped CSS text, not the composed
// result. These specs open the viewer BOTH ways — direct load and after a
// view-transition client-side navigation (the path that dropped scoped
// styles when a transition aborted) — and assert the geometry a user sees.
import { test, expect, type Page } from '@playwright/test';

async function openViewer(page: Page) {
  // Click the tile IMAGE, not the anchor — the same target the long-green
  // content.spec lightbox test uses; the anchor stalls WebKit's
  // actionability checks on CI while the image clicks clean.
  const tile = page.locator('[data-src^="/images/photography/hero/"]').first();
  await tile.scrollIntoViewIfNeeded();
  // Let smooth-scroll momentum settle so the click lands as a click.
  await page.waitForTimeout(1000);
  await tile.click();
  const lb = page.locator('#lightbox');
  try {
    await expect(lb).toHaveClass(/active/, { timeout: 4000 });
  } catch {
    // If the controller had not bound yet, the tile's anchor NAVIGATED to
    // the photo detail page (WebKit binds late on CI hardware). Recover.
    if (!/\/photography\/?$/.test(new URL(page.url()).pathname)) {
      await page.goBack();
      await expect(page).toHaveURL(/\/photography\/?$/);
      await page.waitForTimeout(1200);
    }
    // force: skip actionability — post-recovery pages keep long-running
    // animations that stall the stability check; the controller's delegated
    // listener only needs the event.
    await page
      .locator('[data-src^="/images/photography/hero/"]')
      .first()
      .click({ force: true, timeout: 10000 });
    await expect(lb).toHaveClass(/active/, { timeout: 8000 });
  }
  // Poll composition instead of a fixed sleep — the open morph duration
  // varies wildly across engines on CI hardware.
  await expect
    .poll(
      () => page.evaluate(() => getComputedStyle(document.getElementById('lightbox')!).backgroundColor),
      { timeout: 8000 }
    )
    .toBe('rgba(10, 10, 10, 0.92)');
}

async function assertComposed(page: Page) {
  // Backdrop actually darkens (bg-[#0a0a0a]/[0.92] must generate + apply).
  const backdrop = await page.evaluate(
    () => getComputedStyle(document.getElementById('lightbox')!).backgroundColor
  );
  expect(backdrop).toBe('rgba(10, 10, 10, 0.92)');

  // Close control: a ~48px glass disc anchored to the top-right corner —
  // absolute must survive the cascade against the material class.
  const close = await page.evaluate(() => {
    const b = document.getElementById('lightbox-close')!;
    const r = b.getBoundingClientRect();
    return {
      pos: getComputedStyle(b).position,
      w: r.width,
      fromRight: innerWidth - r.right,
      fromTop: r.top,
    };
  });
  expect(close.pos).toBe('absolute');
  expect(close.w).toBeGreaterThan(36);
  expect(close.w).toBeLessThan(64);
  expect(close.fromRight).toBeLessThan(120);
  expect(close.fromTop).toBeLessThan(120);

  // Photograph centered and contained.
  const img = await page.evaluate(() => {
    const i = document.getElementById('lightbox-img')!.getBoundingClientRect();
    return {
      delta: Math.abs(i.x + i.width / 2 - innerWidth / 2),
      fits: i.width <= innerWidth + 1 && i.height <= innerHeight + 1,
    };
  });
  expect(img.delta).toBeLessThan(12);
  expect(img.fits).toBe(true);

  // Site chrome yields: the sticky header slides out of the viewport.
  // Poll — the slide animates on the header's own 500ms transition.
  await expect
    .poll(
      () => page.evaluate(() => document.getElementById('site-header')!.getBoundingClientRect().bottom),
      { timeout: 8000 }
    )
    .toBeLessThanOrEqual(0);
}

test.describe('Photography lightbox composition (2026-07-02 incident locks)', () => {
  test('composes correctly on direct load', async ({ page }) => {
    await page.goto('/photography/');
    await openViewer(page);
    await assertComposed(page);
  });

  test('composes correctly after a view-transition navigation', async ({ page }) => {
    await page.goto('/');
    await page.locator('header a[href="/photography"]:visible').first().click();
    await expect(page).toHaveURL(/\/photography\/?$/);
    // Let the head swap (and any aborted-transition fallout) settle.
    await page.waitForTimeout(800);
    await openViewer(page);
    await assertComposed(page);
  });

  test('arrow navigation swaps frames cleanly and bursts stay bounded', async ({ page }) => {
    // 2026-07-08 field report: the old swap slid the SAME <img> back in
    // before its new source decoded (the previous photo visibly rode across
    // the screen), and uncancelled swap timers stacked under rapid input
    // (stale frames; decode pile-ups that killed iOS). Lock the fixed
    // behavior: a settled navigation shows a NEW, fully decoded, untransformed
    // frame, and a rapid burst coalesces to a stable settled frame.
    await page.goto('/photography/');
    await openViewer(page);
    const settled = () =>
      page.evaluate(() => {
        const i = document.getElementById('lightbox-img') as HTMLImageElement;
        return i.complete && getComputedStyle(i).opacity === '1' && i.style.transform === '' ? i.currentSrc : '';
      });
    const before = await settled();
    expect(before).not.toBe('');
    await page.keyboard.press('ArrowRight');
    await expect.poll(settled, { timeout: 8000 }).not.toBe('');
    const after = await settled();
    expect(after).not.toBe(before);
    // Burst: five rapid presses must coalesce, not stack.
    for (let k = 0; k < 5; k++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(45);
    }
    await expect.poll(settled, { timeout: 8000 }).not.toBe('');
  });

  test('Escape closes the viewer and restores the chrome', async ({ page }) => {
    await page.goto('/photography/');
    await openViewer(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).not.toHaveClass(/active/, { timeout: 10000 });
    // Return slide runs on the elements' own transitions; poll, don't sleep.
    await expect
      .poll(
        () => page.evaluate(() => document.getElementById('site-header')!.getBoundingClientRect().bottom),
        { timeout: 8000 }
      )
      .toBeGreaterThan(0);
  });
});
