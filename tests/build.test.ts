import { describe, it, expect, beforeAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);
const distDir = path.join(process.cwd(), 'dist');

describe('Astro Build', () => {
  beforeAll(async () => {
    await execAsync('npm run build');
  }, 60000);

  it('creates a dist directory', () => {
    expect(fs.existsSync(distDir)).toBe(true);
  });

  it('generates index.html', () => {
    const indexPath = path.join(distDir, 'index.html');
    expect(fs.existsSync(indexPath)).toBe(true);
  });

  it('generates all page HTML files', () => {
    const pages = ['about', 'work', 'photography'];
    pages.forEach((page) => {
      const pagePath = path.join(distDir, page, 'index.html');
      expect(fs.existsSync(pagePath)).toBe(true);
    });
  });

  it('generates the 404 page', () => {
    const notFoundPath = path.join(distDir, '404.html');
    expect(fs.existsSync(notFoundPath)).toBe(true);
  });

  it('generates a sitemap-index.xml from @astrojs/sitemap', () => {
    const sitemapPath = path.join(distDir, 'sitemap-index.xml');
    expect(fs.existsSync(sitemapPath)).toBe(true);
  });

  it('sitemap includes Google Images image:image entries for photography', () => {
    const sitemapPath = path.join(distDir, 'sitemap-0.xml');
    expect(fs.existsSync(sitemapPath)).toBe(true);
    const xml = fs.readFileSync(sitemapPath, 'utf-8');
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    // 56 canonical photographs × (gallery index + 56 detail pages) = 112 entries.
    const matches = xml.match(/<image:image>/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(112);
    // Spot-check: hero image URL present with caption.
    expect(xml).toContain('/images/photography/hero/');
    expect(xml).toContain('<image:caption>');
    expect(xml).toContain('<image:license>');
  });

  it('does NOT emit /writing — page was removed', () => {
    const writingPath = path.join(distDir, 'writing', 'index.html');
    expect(fs.existsSync(writingPath)).toBe(false);
  });

  it('generates per-photo OG images under /og/photography/', () => {
    // Tier 2 item 3: per-photo dynamic OG so link unfurls on Twitter, iMessage,
    // LinkedIn, Slack and Discord show the actual photograph rather than the
    // default portrait. Script: scripts/build-og-images.mjs, invoked by the
    // `build` npm script after `astro build`.
    const ogDir = path.join(distDir, 'og', 'photography');
    expect(fs.existsSync(ogDir)).toBe(true);

    const jpgs = fs.readdirSync(ogDir).filter((f) => f.endsWith('.jpg'));
    // 56 canonical slugs (first-seen-wins) — same count the sitemap asserts.
    expect(jpgs.length).toBeGreaterThanOrEqual(56);

    // Spot-check a canonical slug from each category.
    const spotChecks = [
      '7r52326.jpg',                      // sky featured
      '7r51025-enhanced-sr.jpg',          // earth featured
      '7r50674-enhanced-sr.jpg',          // water featured
      'img-7576-enhanced.jpg',            // structure featured
      'burningcold-enhanced.jpg',         // light-only canonical
    ];
    for (const f of spotChecks) {
      expect(fs.existsSync(path.join(ogDir, f))).toBe(true);
    }

    // File-size sanity: JPEGs should be 20 KB–400 KB each. Anything larger
    // than 500 KB means overlay compositing regressed; anything <5 KB
    // means sharp failed silently and produced a stub.
    for (const f of jpgs) {
      const size = fs.statSync(path.join(ogDir, f)).size;
      expect(size).toBeGreaterThan(5_000);
      expect(size).toBeLessThan(500_000);
    }
  });

  it('photo detail pages reference the generated OG JPEG, not the WebP hero', () => {
    // Verify the [slug].astro wiring survived — an accidental revert to
    // `/images/photography/hero/<slug>.webp` would silently degrade
    // LinkedIn/iMessage unfurls (those renderers won't display WebP).
    const detailPath = path.join(distDir, 'photography', '7r52326', 'index.html');
    expect(fs.existsSync(detailPath)).toBe(true);
    const html = fs.readFileSync(detailPath, 'utf-8');
    expect(html).toContain('/og/photography/7r52326.jpg');
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');
  });

  it('emits per-frame KineticPlate geometry and keeps /about lean (no inline grids)', () => {
    // v10: KineticPlate fetches geometry from /data/kinetic/<id>.json instead of
    // inlining a ~80-130 KB data-plate attribute per plate. /about renders three
    // plates; before extraction its HTML was ~336 KB.
    const earthGeom = path.join(distDir, 'data', 'kinetic', 'earth.json');
    expect(fs.existsSync(earthGeom)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(earthGeom, 'utf-8'));
    expect(parsed.grid.length).toBe(parsed.cols * parsed.rows);
    const aboutHtml = fs.readFileSync(path.join(distDir, 'about', 'index.html'), 'utf-8');
    expect(aboutHtml).not.toContain('data-plate=');
    expect(aboutHtml.length).toBeLessThan(80_000);
  });

});

describe('Generated HTML Content', () => {
  let indexHtml: string;
  let aboutHtml: string;
  let workHtml: string;
  let photographyHtml: string;

  beforeAll(async () => {
    await execAsync('npm run build');
    indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');
    aboutHtml = fs.readFileSync(path.join(distDir, 'about', 'index.html'), 'utf-8');
    workHtml = fs.readFileSync(path.join(distDir, 'work', 'index.html'), 'utf-8');
    photographyHtml = fs.readFileSync(path.join(distDir, 'photography', 'index.html'), 'utf-8');
  }, 60000);

  describe('Homepage', () => {
    it('contains the site title', () => {
      expect(indexHtml).toContain('John D. Williams');
    });

    it('contains navigation links', () => {
      expect(indexHtml).toContain('href="/about"');
      expect(indexHtml).toContain('href="/work"');
      expect(indexHtml).toContain('href="/photography"');
    });

    it('contains social links in the footer', () => {
      expect(indexHtml).toContain('linkedin.com');
      expect(indexHtml).toContain('github.com');
    });

    it('uses <picture> with AVIF source for the hero', () => {
      expect(indexHtml).toContain('image/avif');
      expect(indexHtml).toContain('7r52326.avif');
    });
  });

  describe('About Page', () => {
    it('contains the about page title', () => {
      expect(aboutHtml).toContain('About');
    });

    it('contains biographical content', () => {
      expect(aboutHtml).toContain('data');
    });

    it('uses the multi-stop dither-resistant hero gradient', () => {
      // Gradient starts with a semi-transparent scrim (not solid black) so
      // the portrait reads through on the left, then fades to fully
      // transparent on the right to let the photograph breathe.
      expect(aboutHtml).toContain('linear-gradient(to right, rgba(10,10,10,0.92) 0%');
      expect(aboutHtml).toContain('rgba(10,10,10,0)');
    });

    it('uses <picture> with AVIF for the portrait hero', () => {
      expect(aboutHtml).toContain('image/avif');
      expect(aboutHtml).toContain('john-portrait-bw.avif');
    });
  });

  describe('Work Page', () => {
    it('contains project information', () => {
      expect(workHtml).toContain('Queue Forecast Dashboard');
    });

    it('contains technology tags', () => {
      expect(workHtml).toContain('Python');
    });
  });

  describe('Photography Page', () => {
    it('contains the photography title', () => {
      expect(photographyHtml).toContain('Photography');
    });

    it('serves gallery images through <picture> with AVIF sources', () => {
      const pictureCount = (photographyHtml.match(/<picture/g) ?? []).length;
      const avifCount = (photographyHtml.match(/image\/avif/g) ?? []).length;
      expect(pictureCount).toBeGreaterThanOrEqual(50);
      expect(avifCount).toBeGreaterThanOrEqual(pictureCount);
    });
  });
});

describe('SEO and Meta Tags', () => {
  let indexHtml: string;

  beforeAll(async () => {
    await execAsync('npm run build');
    indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');
  }, 60000);

  it('contains viewport meta tag', () => {
    expect(indexHtml).toContain('viewport');
  });

  it('contains charset declaration', () => {
    expect(indexHtml).toContain('UTF-8');
  });

  it('contains Open Graph tags', () => {
    expect(indexHtml).toContain('og:');
  });

  it('contains a title tag', () => {
    expect(indexHtml).toMatch(/<title>.*<\/title>/);
  });

  it('contains the updated default meta description', () => {
    expect(indexHtml).toContain('Photography, cybersecurity, and data');
  });

  it('contains JSON-LD Person schema', () => {
    expect(indexHtml).toContain('"@type":"Person"');
  });

  it('inlines the Liquid Glass Tier 2 SVG displacement filter', () => {
    expect(indexHtml).toContain('id="glass-lens"');
    expect(indexHtml).toContain('feDisplacementMap');
  });

  it('ships the pointer-tracked specular listener (spotlight restored 2026-06-06)', () => {
    const assetsDir = path.join(distDir, '_assets');
    const jsFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
    const jsBundle = jsFiles
      .map((f) => fs.readFileSync(path.join(assetsDir, f), 'utf-8'))
      .join('\n');
    // Spotlight restored by design (2026-06-06): pointermove specular driver
    // writes --mx/--my for the radial highlight on glass-card and glass-panel.
    expect(jsBundle).toContain('--mx');
    expect(jsBundle).toContain('--my');
  });
});

describe('Liquid Glass CSS', () => {
  let cssBundle: string;

  beforeAll(async () => {
    await execAsync('npm run build');
    const assetsDir = path.join(distDir, '_assets');
    const cssFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.css'));
    cssBundle = cssFiles
      .map((f) => fs.readFileSync(path.join(assetsDir, f), 'utf-8'))
      .join('\n');
  }, 60000);

  it('has the pointer-tracked specular spotlight (restored 2026-06-06)', () => {
    expect(cssBundle).toContain('var(--mx');
  });

  it('does NOT apply backdrop-filter: url(#glass-lens) — iOS Safari breaks on it', () => {
    // Tier 2 displacement was removed due to iOS Safari @supports
    // false-positive. If this ever comes back, gate on runtime JS
    // feature-detection rather than @supports.
    expect(cssBundle).not.toContain('url(#glass-lens)');
  });

  it('defines .glass-tabbar for the mobile bottom nav', () => {
    expect(cssBundle).toContain('.glass-tabbar');
  });

  it('defines the backlit-crystal chip lens (2026-06-10)', () => {
    expect(cssBundle).toContain('.chip-lens');
    expect(cssBundle).toContain('.cl-ring');
    expect(cssBundle).toContain('.cl-core');
  });

  it('ships the chip lens markup on the photography rail', () => {
    const html = fs.readFileSync(
      path.join(distDir, 'photography', 'index.html'),
      'utf-8'
    );
    expect(html).toContain('id="chip-lens"');
    expect(html).toContain('cat-link');
  });

  it('respects prefers-reduced-motion for glass specular', () => {
    expect(cssBundle).toContain('prefers-reduced-motion');
  });
});
