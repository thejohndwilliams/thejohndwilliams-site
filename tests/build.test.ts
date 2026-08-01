// @vitest-environment node
// This suite shells out + reads dist/ — it needs real node builtins. Under
// the global happy-dom environment, vite externalizes node: imports and the
// suite dies at import ("No such built-in module"). That failure was long
// misdiagnosed as a node-version problem. Pinned 2026-06-11.
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

  it('emits /beyond carrying the relief render set (the experiments wing)', () => {
    // The page is only worth shipping if the renders ship with it. These
    // assets are produced OUTSIDE the repo (relief_render.py needs a
    // panel-resolution depth pass and a ~900 KB luminance plate per frame),
    // so nothing in the build regenerates them: a careless `git clean` or a
    // partial copy would leave a page of broken frames with a green build.
    expect(fs.existsSync(path.join(distDir, 'beyond', 'index.html'))).toBe(true);

    const relief = path.join(distDir, 'images', 'relief');
    expect(fs.existsSync(relief)).toBe(true);
    for (const mm of [1, 2, 3, 4, 6, 9, 14]) {
      expect(fs.existsSync(path.join(relief, `depth-${mm}mm.avif`))).toBe(true);
      expect(fs.existsSync(path.join(relief, `depth-${mm}mm.webp`))).toBe(true);
    }
    for (const size of ['16x20', '20x24', '24x36']) {
      expect(fs.existsSync(path.join(relief, `edition-${size}.avif`))).toBe(true);
      expect(fs.existsSync(path.join(relief, `edition-${size}.webp`))).toBe(true);
    }
    // Poster still: the LCP candidate and the reduced-motion visitor's frame.
    expect(fs.existsSync(path.join(relief, 'sweep-still.avif'))).toBe(true);

    // The sweep itself. Budgeted at ~1.5 MB, roughly six gallery heroes, and
    // only fetched on intersection. If a re-encode blows past 3 MB the lazy
    // gate stops being enough and the budget decision needs revisiting.
    const mp4 = path.join(distDir, 'video', 'relief-sweep.mp4');
    expect(fs.existsSync(mp4)).toBe(true);
    expect(fs.statSync(mp4).size).toBeLessThan(3 * 1024 * 1024);
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

  it('generates page-level OG JPEGs and wires them into top-level pages', () => {
    // 2026-07-01 web review: /, /photography, /work, /about pointed og:image
    // at 2400×1600 WebP heroes — LinkedIn (the primary professional share
    // surface) does not reliably render WebP unfurls. Top-level pages now use
    // the same 1200×630 JPEG pipeline as photo detail pages.
    const pagesDir = path.join(distDir, 'og', 'pages');
    for (const f of ['home.jpg', 'photography.jpg', 'work.jpg', 'about.jpg']) {
      expect(fs.existsSync(path.join(pagesDir, f))).toBe(true);
    }
    const pairs: Array<[string, string]> = [
      ['index.html', '/og/pages/home.jpg'],
      [path.join('photography', 'index.html'), '/og/pages/photography.jpg'],
      [path.join('work', 'index.html'), '/og/pages/work.jpg'],
      [path.join('about', 'index.html'), '/og/pages/about.jpg'],
    ];
    for (const [rel, og] of pairs) {
      const html = fs.readFileSync(path.join(distDir, rel), 'utf-8');
      expect(html).toContain(og);
      expect(html).toContain('property="og:image:width" content="1200"');
      expect(html).toContain('property="og:image:height" content="630"');
    }
  });

  it('LCP preload is AVIF-only and the shared CSS bundle ships as an external <link>', () => {
    // (a) 2026-07-01: dual-format preloads made evergreen browsers download
    //     the LCP image twice (~108 KB desktop / ~36 KB mobile). AVIF-only is
    //     deliberate — non-AVIF engines fall back to <picture> discovery.
    // (b) 2026-07-02 incident lock: inlineStylesheets 'always' split the
    //     site-wide bundle into per-page inline subsets that LOST the
    //     photography lightbox's presentation rules, and view-transition
    //     head swaps dropped scoped <style> tags on aborted transitions.
    //     The external /_assets bundle is the transition-safe delivery.
    //     Read the astro.config comment before touching this.
    const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');
    expect(html).toMatch(/rel="preload" as="image" type="image\/avif"/);
    expect(html).not.toMatch(/rel="preload" as="image" type="image\/webp"/);
    expect(html).toMatch(/<link rel="stylesheet" href="\/_assets\//);
    expect(html).toContain('rel="stylesheet" href="/hdr-palette.css"');
  });

  it('robots.txt blocks training crawlers but allows user-triggered AI fetchers', () => {
    // 2026-07-01 decision: ChatGPT-User / Perplexity-User / OAI-SearchBot are
    // user-triggered fetchers, not training crawlers. Blocking them broke the
    // /llms.txt invitation (a recruiter asking an assistant about the site got
    // nothing). Training bots stay blocked.
    const robots = fs.readFileSync(path.join(distDir, 'robots.txt'), 'utf-8');
    for (const bot of ['GPTBot', 'ClaudeBot', 'CCBot', 'PerplexityBot', 'Google-Extended', 'Bytespider']) {
      expect(robots).toContain(`User-agent: ${bot}\nDisallow: /`);
    }
    for (const bot of ['ChatGPT-User', 'Perplexity-User', 'OAI-SearchBot']) {
      expect(robots).not.toContain(`User-agent: ${bot}`);
    }
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
    // Ceiling raised 80 KB → 128 KB on 2026-07-01: inlineStylesheets 'always'
    // adds the page's full stylesheet (~40 KB raw, ~4 KB over brotli) to the
    // HTML in exchange for killing the render-blocking CSS request. The real
    // guard against re-inlined plate grids is the data-plate check above —
    // a single regressed plate would blow past this ceiling anyway.
    expect(aboutHtml.length).toBeLessThan(128_000);
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

  describe('Reachability of /beyond (the experiments wing)', () => {
    it('every top-level surface that should reach the object axis does', () => {
      // /relief shipped orphaned: one 12px muted line at the bottom of
      // /photography was the site's only inbound link to a top-level URL.
      // Source locks live in hazards.test.ts; this one proves the links
      // survive the build.
      expect(indexHtml).toMatch(/href="\/beyond\/?"/);
      expect(workHtml).toMatch(/href="\/beyond\/?"/);
      expect(photographyHtml).toMatch(/href="\/beyond\/?"/);
    });
  });

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
    // Collect shipped CSS from BOTH delivery modes so these material locks
    // hold regardless of inlineStylesheets: every external /_assets file
    // plus any inlined <style> blocks in the key pages. (2026-07-02: the
    // delivery mode reverted to external after the lightbox incident.)
    const assetsDir = path.join(distDir, '_assets');
    const external = fs.existsSync(assetsDir)
      ? fs.readdirSync(assetsDir)
          .filter((f) => f.endsWith('.css'))
          .map((f) => fs.readFileSync(path.join(assetsDir, f), 'utf-8'))
      : [];
    const pages = [
      'index.html',
      path.join('photography', 'index.html'),
      path.join('work', 'index.html'),
      path.join('about', 'index.html'),
    ];
    const inline = pages
      .map((p) => fs.readFileSync(path.join(distDir, p), 'utf-8'))
      .flatMap((html) => Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g), (m) => m[1]));
    cssBundle = external.concat(inline).join('\n');
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

  it('.glass-tabbar stays retired — the bottom tab bar was removed 2026-07 (collided with browser chrome); its material was dead CSS until the P3 sweep (2026-07-19)', () => {
    expect(cssBundle).not.toContain('.glass-tabbar');
  });

  it('defines the backlit-crystal chip lens (2026-06-10)', () => {
    expect(cssBundle).toContain('.chip-lens');
    expect(cssBundle).toContain('.cl-ring');
    expect(cssBundle).toContain('.cl-core');
  });

  it('extends the crystal control material to buttons site-wide', () => {
    // minifiers may collapse ::before to :before; accept either
    expect(cssBundle).toMatch(/\.glass-control::?before/);
    expect(cssBundle).toContain('.theme-toggle:active');
  });

  it('ships the chip lens markup on the photography rail', () => {
    const html = fs.readFileSync(
      path.join(distDir, 'photography', 'index.html'),
      'utf-8'
    );
    // A2.1 owner ruling (2026-07-31): the capsule rail and its lens vessel
    // are retired from the category index - "way too loud... rethink the
    // entire pill aesthetic." The index is bare text; the lit word is the
    // selection. This lock now guards the ABSENCE of the vessel and the
    // presence of the bare list.
    expect(html).not.toContain('id="chip-lens"');
    expect(html).toContain('id="cat-list"');
    expect(html).toContain('cat-link');
  });

  it('respects prefers-reduced-motion for glass specular', () => {
    expect(cssBundle).toContain('prefers-reduced-motion');
  });

  it('ships the lightbox backdrop rule (transparent-lightbox incident, 2026-07-02)', () => {
    // The dialog's darkening is one arbitrary-value utility; when it fell
    // out of the shipped CSS the lightbox rendered as fog: backdrop-blur
    // over an undarkened page, page chrome visible through the overlay.
    // Exact emitted (minified) form — update deliberately if the minifier
    // or the alpha value changes:
    expect(cssBundle).toContain('bg-\\[\\#0a0a0a\\]\\/\\[0\\.92\\]{background-color:#0a0a0aeb}');
  });
});

describe('Glass lab bench (Glass Build B v1)', () => {
  it('builds the bench locally with all four materials', () => {
    const html = fs.readFileSync(path.join(distDir, 'glass-lab/index.html'), 'utf8');
    expect(html).toContain('data-glass-bench');
    expect((html.match(/data-gpill/g) || []).length).toBe(3);
    expect(html).toContain('field\u0020computation on a uniform grid'.replace('\u0020',' '));
    expect(html).toContain('noindex');
  });
});

describe('Glass Build B promotion: hero complications are refractive C', () => {
  it('home hero carries the bench and both glass pills', () => {
    const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
    expect(html).toContain('data-glass-bench');
    expect((html.match(/data-gpill/g) || []).length).toBe(2);
    expect((html.match(/data-variant="c"/g) || []).length).toBe(2);
  });
});
