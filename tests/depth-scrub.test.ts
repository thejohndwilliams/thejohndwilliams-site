// @vitest-environment node
// /beyond rebuild locks (2026-10-28, owner order: one grammar for the page).
// The seven static relief thumbnails became one scrubbed figure that shares
// the layer figure's caption, slider and Replay grammar; the page runs as
// three acts under one header grammar; the hero is the Work hero verbatim.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('relief depth scrub (the seven depths as one figure)', () => {
  const figure = read('src/components/DepthScrub.astro');
  const script = read('src/scripts/depth-scrub.ts');
  const relief = read('src/components/ReliefStudies.astro');
  const css = read('src/styles/beyond.css');
  const beyond = read('src/pages/beyond.astro');

  it('replaces the thumbnail grid and is wired into the page bootstrap', () => {
    expect(relief).toContain('<DepthScrub />');
    expect(relief).not.toContain('depth-grid');
    expect(relief).not.toContain('depth__label');
    expect(beyond).toContain("import { initDepthScrub } from '../scripts/depth-scrub'");
    // Once on load and once per view-transition swap, like the depth study.
    expect(beyond.match(/initDepthScrub\(\)/g)).toHaveLength(2);
  });

  it('exposes one seven-stop keyboard range that announces millimetres', () => {
    expect(figure).toContain("export const DEPTHS_MM = [1, 2, 3, 4, 6, 9, 14] as const");
    expect(figure).toContain('<span class="sr-only">Relief depth</span>');
    expect(figure).toContain('type="range"');
    expect(figure).toContain('min="0"');
    expect(figure).toContain('max={String(DEPTHS_MM.length - 1)}');
    expect(figure).toContain('step="1"');
    expect(figure).toContain('aria-valuetext={`${DEPTHS_MM[REST]} mm`}');
    expect(figure).toContain('<output class="bfig__readout" aria-live="polite" data-scrub-output>');
    expect(figure).toContain('const REST = 3;');
    expect(script).toContain("range!.setAttribute('aria-valuetext', label)");
    expect(script).toContain('output!.textContent = label');
  });

  it('crossfades two stacked frames and never fetches all seven before it is near the viewport', () => {
    expect(figure.match(/class="depth-scrub__frame/g)).toHaveLength(2);
    expect(figure).toContain('loading="lazy"');
    expect(figure).not.toContain('fetchpriority');
    expect(script).toContain('prefetchAll()');
    expect(script).toContain('IntersectionObserver');
    expect(script).toContain("PREFETCH_MARGIN = '600px 0px'");
    expect(css).toContain('.depth-scrub__frame.is-active');
    expect(css).toMatch(/\.depth-scrub__frame \{[^}]*transition: opacity 120ms/);
  });

  it('plays once, rests at 4 mm, holds still under reduced motion, and tears down on navigation', () => {
    expect(script).toContain("window.matchMedia('(prefers-reduced-motion: reduce)').matches");
    expect(script).toMatch(/if \(reduced\) \{\s*show\(rest\);\s*return;/);
    expect(script).toContain('scrubObserver?.disconnect()');
    expect(script).toContain('scrubAbort?.abort()');
    expect(script).toContain("document.addEventListener('astro:before-swap', onBeforeSwap, { once: true, signal })");
    // The depth study fires a synthetic astro:after-swap when a plate mounts;
    // a re-init must not replay the figure or snap it back to 4 mm.
    expect(script).toContain('let playedOnce = false');
    expect(script).toContain('if (played) return;');
    expect(script).toMatch(/frames\.findIndex\(\(f\) => f\.classList\.contains\('is-active'\)\)/);
  });

  it('keeps public copy free of em dashes and inline styles, with no sales wording', () => {
    const banned = ['purchase', 'sale', 'price', 'edition', 'inquire', 'licence', 'license'];
    for (const body of [figure, script, relief]) {
      expect(body).not.toContain('—');
      expect(body).not.toMatch(/\sstyle="/);
      expect(body).not.toContain('style.cssText');
    }
    const lower = figure.toLowerCase();
    for (const word of banned) {
      expect(lower, word).not.toMatch(new RegExp(`\\b${word}\\b`));
    }
    expect(figure).toContain('Seven depths, one photograph.');
  });
});

describe('/beyond figure and header grammar', () => {
  const beyond = read('src/pages/beyond.astro');
  const relief = read('src/components/ReliefStudies.astro');
  const css = read('src/styles/beyond.css');
  const study = read('src/styles/depth-study.css');

  it('the hero is the Work hero verbatim: full-bleed, bleed-short exemption, the 8pt lockup padding', () => {
    expect(beyond).toContain('data-bleed-short');
    expect(beyond).toContain("const bannerSizes = '(max-width: 700px) 200vw, 100vw'");
    expect(css).not.toMatch(/\.beyond-banner__img \{[^}]*max-width: 2400px/);
    expect(css).toMatch(/\.beyond-banner > \.beyond-title \{[^}]*padding: 0 2\.667rem 5\.333rem/);
    expect(css).toContain('padding: 0 4.444rem 7.111rem');
    expect(css).toContain('padding-bottom: 10.667rem');
    expect(css).toContain('padding-left: 8.889rem');
    expect(css).toMatch(/\.beyond-banner \.beyond-title \.beyond-text \{[^}]*max-width: 42rem/);
    expect(css).not.toMatch(/\.beyond-title h1[^{]*\{[^}]*text-shadow/);
  });

  it('every act opens with eyebrow, serif h2, copy; the orphan layer figure has a heading now', () => {
    const main = beyond.slice(beyond.indexOf('<section id="depth-layers"'));
    expect(main).toMatch(/<p class="eyebrow">Depth<\/p>\s*<h2 class="t-sub font-serif">/);
    expect(main).toMatch(/<p class="eyebrow">Texture<\/p>\s*<h2 class="t-sub font-serif">/);
    expect(relief).toMatch(/<p class="eyebrow">Surface<\/p>\s*<h2 class="t-sub font-serif">/);
    expect(main).toMatch(/<p class="eyebrow">Open questions<\/p>\s*<h2 class="t-sub font-serif">The envelope<\/h2>/);
    // The depth study is the act's second figure, not a second heading.
    expect(beyond).not.toContain('The depth studies');
    expect(beyond).not.toContain('Texture and Gaussian studies');
    expect(relief).not.toContain('Object studies');
    expect(relief).not.toContain('<h2>The light does the work</h2>');
    expect(css).toMatch(/\.beyond-text h2 \{[^}]*margin: 0\.5rem 0 1\.5rem/);
  });

  it('one control material on the page: the layer figure Replay box, no glass chip rail', () => {
    expect(beyond).not.toContain('glass-chip-rail');
    expect(beyond).toContain('class="depth-mode__btn bfig__action" data-depth-mode="planes"');
    expect(beyond).toContain('class="depth-mode__btn bfig__action" data-depth-mode="points"');
    expect(css).toMatch(/\.bfig__action \{[^}]*border: 1px solid rgba\(244, 234, 222, 0\.72\)/);
    expect(css).toMatch(/\.bfig__action \{[^}]*min-height: 44px/);
    expect(study).not.toContain('glass-chip-rail');
  });

  it('figures share one block: tag, caption, controls, notes', () => {
    for (const body of [relief, read('src/components/DepthScrub.astro')]) {
      expect(body).toContain('<figcaption class="bfig__side">');
      expect(body).toContain('<p class="bfig__tag">');
      expect(body).toContain('<p class="bfig__cap">');
    }
    expect(beyond).toContain('<p class="bfig__tag">{row.title}</p>');
    expect(beyond).toContain('<p class="bfig__cap">{row.note}</p>');
    expect(css).toMatch(/\.bfig__cap \{[^}]*font-family: 'EB Garamond'/);
    expect(css).toMatch(/\.bfig__controls \{[^}]*margin-top: 1\.25rem/);
    expect(css).toMatch(/\.bfig__notes \{[^}]*margin-top: 1\.5rem/);
    // The rail keeps its literal relative scale and never takes the split.
    expect(relief).toContain('class="bfig bfig--rail"');
    expect(relief).not.toContain('bfig--portrait"><div class="bfig__media"><div class="edition-rail"');
  });
});
