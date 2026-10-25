// WCAG 2.5.5 (AAA) pointer target is 44x44 CSS pixels. Inline links that sit
// in a sentence are the one exception (the line height is the constraint).
// Phone body paragraphs are at least 16px. Every other visible paragraph,
// including secondary captions, is at least 14px. Eyebrows keep their own scale.
import { test, expect } from '@playwright/test';

const PAGES = ['/', '/work/', '/photography/', '/about/', '/links/', '/depth/'] as const;

const VIEWPORTS = [
  { name: 'iphone390', width: 390, height: 844, dpr: 3 },
  { name: 'iphone430', width: 430, height: 932, dpr: 3 },
  { name: 'duo540', width: 540, height: 720, dpr: 2.5 },
  { name: 'ipadP', width: 820, height: 1180, dpr: 2 },
  { name: 'ipadL', width: 1180, height: 820, dpr: 2 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`touch targets ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr,
      hasTouch: true,
      isMobile: vp.width < 768,
    });

    for (const path of PAGES) {
      test(`${path} hit boxes and type`, async ({ page }) => {
        await page.goto(path);
        const phone = vp.width <= 540;
        const failures = await page.evaluate((isPhone) => {
          const taps: string[] = [];
          const body: string[] = [];
          const captions: string[] = [];

          const shown = (el: Element) => {
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') return false;
            if (Number(cs.opacity) < 0.01) return false;
            const r = el.getBoundingClientRect();
            if (r.width < 2 && r.height < 2) return false;
            return true;
          };

          const labelOf = (el: Element) =>
            (el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.textContent || '')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 70);

          // A link is exempt only when it is inline inside running text, and
          // it is not a header, footer, or nav control.
          const inlineTextLink = (el: Element) => {
            if (el.tagName !== 'A') return false;
            if (el.closest('header, footer, nav')) return false;
            if (getComputedStyle(el).display !== 'inline') return false;
            const parent = el.parentElement;
            if (!parent) return false;
            const holder = parent.cloneNode(true) as HTMLElement;
            holder.querySelectorAll('a, button').forEach((n) => n.remove());
            return (holder.textContent || '').replace(/\s+/g, ' ').trim().length > 0;
          };

          document.querySelectorAll('a, button, input, select, textarea').forEach((el) => {
            if (!shown(el)) return;
            if (inlineTextLink(el)) return;
            const r = el.getBoundingClientRect();
            const w = Math.round(r.width);
            const h = Math.round(r.height);
            if (w < 44 || h < 44) {
              taps.push(`${el.tagName.toLowerCase()} ${w}x${h} "${labelOf(el)}"`);
            }
          });

          document.querySelectorAll('main p').forEach((el) => {
            if (!shown(el)) return;
            if (el.closest('.eyebrow')) return;
            if (el.classList.contains('eyebrow')) return;
            const cs = getComputedStyle(el);
            const fs = parseFloat(cs.fontSize);
            const text = ((el as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim();
            if (!text) return;
            if (fs < 14) {
              captions.push(`${fs.toFixed(2)}px "${text.slice(0, 60)}"`);
            }
            if (
              isPhone &&
              cs.textTransform !== 'uppercase' &&
              !el.closest('[aria-hidden="true"]') &&
              text.length >= 40 &&
              fs < 16
            ) {
              body.push(`${fs.toFixed(2)}px "${text.slice(0, 60)}"`);
            }
          });

          return { taps, body, captions };
        }, phone);

        expect(failures.taps, `hit box under 44px\n${failures.taps.join('\n')}`).toEqual([]);
        expect(failures.captions, `caption under 14px\n${failures.captions.join('\n')}`).toEqual([]);
        if (phone) {
          expect(failures.body, `body paragraph under 16px\n${failures.body.join('\n')}`).toEqual([]);
        }
      });
    }
  });
}
