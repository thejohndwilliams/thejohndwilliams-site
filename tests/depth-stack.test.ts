// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('depth stack draft route', () => {
  const page = read('src/pages/depth.astro');
  const figure = read('src/components/DepthStack.astro');
  const css = read('src/styles/depth-stack.css');
  const script = read('src/scripts/depth-stack.ts');
  const robots = read('public/robots.txt');
  const config = read('astro.config.mjs');
  const nav = read('src/utils/date.ts');
  const header = read('src/components/Header.astro');
  const footer = read('src/components/Footer.astro');
  const beyond = read('src/pages/beyond.astro');
  const photos = read('src/data/photography.ts');

  it('stays off the three public planes until John publishes it', () => {
    expect(page).toContain('noindex={true}');
    expect(page).toContain("CF_PAGES === '1'");
    expect(page).toContain("(process.env.CF_PAGES_BRANCH || 'main') === 'main'");
    expect(page).toContain("Astro.redirect('/', 308)");
    expect(config).toContain("!page.includes('/depth')");
    expect(robots).toContain('Disallow: /depth');
  });

  it('is not linked from nav, footer, or /beyond, and is not a gallery photograph', () => {
    expect(nav).not.toContain('/depth');
    expect(header).not.toContain('/depth/');
    expect(footer).not.toContain('/depth/');
    expect(beyond).not.toContain('/depth/');
    expect(beyond).toContain('DepthStack');
    expect(beyond).toContain('autoplay={false}');
    expect(photos).not.toContain('/images/depth/');
    expect(photos).not.toContain('layer1-plate');
  });

  it('exposes one keyboard range whose label is Layer separation', () => {
    expect(figure).toContain('id="depth-stack"');
    expect(figure.match(/id="depth-stack"/g)).toHaveLength(1);
    expect(figure).toContain('<label class="depth-stack__range" hidden>');
    expect(figure).toContain('<span class="sr-only">Layer separation</span>');
    expect(figure).toContain('id="depth-separation"');
    expect(figure).toContain('type="range"');
    expect(figure).toContain('min="0"');
    expect(figure).toContain('max="1"');
    expect(figure).toContain('step="0.01"');
    expect(figure).toContain('disabled');
    expect(script).toContain("range.disabled = false");
    expect(script).toContain("rangeLabel.removeAttribute('hidden')");
    expect(script).not.toContain('cssText');
    expect(script).not.toContain("setAttribute('style'");
    expect(script).not.toContain('setAttribute("style"');
    expect(script).toContain('setProperty');
  });

  it('keeps public copy free of em dashes and inline style attributes', () => {
    for (const body of [page, figure, css, script]) {
      expect(body).not.toContain('\u2014');
      expect(body).not.toMatch(/\sstyle="/);
      expect(body).not.toContain('style.cssText');
    }
  });

  it('does not mount a second WebGL plate and lazy-loads the upper layers', () => {
    expect(figure).not.toContain('KineticPlate');
    expect(figure).not.toContain('canvas');
    expect(figure).toContain("priority ? 'high' : undefined");
    expect(figure).toContain("file: 'layer2.webp'");
    expect(figure).toContain("file: 'layer5.webp'");
    expect(figure).toContain('data-src={`/images/depth/${layer.file}`}');
    expect(figure).not.toMatch(/(?:^|[^-\w])src="\/images\/depth\/layer2\.webp"/);
    expect(script).toContain('IntersectionObserver');
    expect(script).toContain('is-run');
    expect(css).toContain('will-change: transform');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('touch-action: pan-y');
  });

  it('ships 800, 1200, and 1600 candidates and does not invent a 2400', () => {
    expect(figure).toContain('/images/depth/w800/${file} 800w');
    expect(figure).toContain('/images/depth/w1200/${file} 1200w');
    expect(figure).toContain('/images/depth/${file} 1600w');
    expect(figure).toContain("layerset('layer1.webp')");
    expect(figure).not.toContain('2400w');
    expect(css).toContain('--native: 1600px');
    expect(css).toContain('80svh');
  });

  it('keeps the page to labels and one caption, with no sales wording', () => {
    // "inquire" stays on the sales list. Contact is the neutral nav label
    // and is not rendered here (the page sets inquire={false}).
    const banned = ['purchase', 'sale', 'price', 'edition', 'inquire', 'licence', 'license'];
    for (const body of [figure, css]) {
      const lower = body.toLowerCase();
      for (const word of banned) {
        expect(lower, word).not.toMatch(new RegExp(`\\b${word}\\b`));
      }
      expect(lower).not.toContain('>contact<');
      expect(body).not.toContain('aria-label="Contact"');
    }
    expect(figure).toContain('LAYER 1 FAR');
    expect(figure).toContain('LAYER 5 NEAR');
    expect(figure).toContain('The photograph separated into five depth layers, far to near.');
  });
});
