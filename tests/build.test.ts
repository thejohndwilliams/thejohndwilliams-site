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
import sharp from 'sharp';

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
      expect(fs.existsSync(path.join(relief, `depth-${mm}mm-w1240.avif`))).toBe(true);
      expect(fs.existsSync(path.join(relief, `depth-${mm}mm-w1240.webp`))).toBe(true);
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
    // inlining a ~80-130 KB data-plate attribute per plate. /about keeps one
    // plate beside Background; before extraction its HTML was ~336 KB.
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
      expect(indexHtml).toContain('href="/about/"');
      expect(indexHtml).toContain('href="/work/"');
      expect(indexHtml).toContain('href="/photography/"');
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
      expect(workHtml).toContain('Job Application Analytics');
    });

    // Owner order 2026-10-25: the queue-forecast project is erased from the
    // public site and its repository retired. This lock keeps it gone - the
    // card named employer customer verticals and a production claim.
    it('work: the retired queue-forecast project never returns', () => {
      expect(workHtml).not.toContain('Queue Forecast');
      expect(workHtml).not.toContain('queue-forecast-dashboard');
      expect(workHtml).not.toContain('Holt-Winters');
      expect(workHtml).not.toContain('workforce planning');
    });

    it('contains technology tags', () => {
      expect(workHtml).toContain('Python');
    });

    it('links and locks the agent governance case study', () => {
      expect(workHtml).toContain('href="/work/agent-governance/"');
      // 2026-10-25: the two 'Forecasting' hits were the retired queue card.
      expect((workHtml.match(/Forecasting/g) || []).length).toBe(0);
      const html = fs.readFileSync(path.join(distDir, 'work', 'agent-governance', 'index.html'), 'utf8');
      const title = 'Human Oversight for a Multi-Agent System: Approval Gates, Evidence and Separation of Duties';
      expect(html).toContain(`<title>${title} | John D. Williams</title>`);
      expect(html).toContain(`<h1>${title}</h1>`);
      expect(html).not.toContain('\u2014');
      expect(html).not.toContain('Independent personal project');
      expect(html).toContain('Personal project.');
      expect(html).toContain('An independent challenger');
      expect(html).toContain('and to the management-system approach of ISO/IEC 42001');
      expect(html).not.toContain('and with the management-system approach of ISO/IEC 42001');
      expect(html).toContain('treated as data and never as instructions.');
      expect(html).not.toContain('treated as data and never as instruction.');
      expect(html).toContain('key-like strings, and terms from a separate configurable list. The scan must pass before anything is shared.');
      expect(html).toContain('The design question was this:');
      expect(html).not.toContain('The design question was simple:');
      expect(html).toContain('NIST (the Manage function)');
      expect(html).not.toContain('NIST (Manage)');
      expect(html).toContain('The approval workflow is a fixed list, not a judgment call:');
      expect(html).not.toContain('fixed table, not a judgment call');
      expect(html).toContain('One rule sits under the whole list:');
      expect(html).not.toContain('under the whole table:');
      expect(html).toContain('routing table');
      expect(html).toContain('Not endorsed by or affiliated with NIST or ISO.');
      expect(html).toContain('Mapped by theme, not certified');
      expect(html).toContain('/figures/gate-flow.svg');
      expect(html).toContain('/figures/audit-trail.svg');
      expect(html).toContain('/figures/controls-mapping.svg');
      expect(html).toContain('ILLUSTRATIVE');
      expect(html).toContain('SYNTHETIC');
      expect(html).not.toMatch(/<style[\s\S]*?<\/style>/);
      expect(html).not.toMatch(/\sstyle="/);
      expect(html).not.toContain('#7E9CB8');
      expect(html).not.toContain('#7e9cb8');
      const gate = html.indexOf('/figures/gate-flow.svg');
      const audit = html.indexOf('/figures/audit-trail.svg');
      const map = html.indexOf('/figures/controls-mapping.svg');
      const worked = html.indexOf('A worked example');
      const shows = html.indexOf('What this shows');
      const disclaimer = html.lastIndexOf('Not endorsed by or affiliated with NIST or ISO.');
      expect(gate).toBeGreaterThan(html.indexOf('non-waivable rules'));
      expect(gate).toBeLessThan(html.indexOf('Rules are ranked'));
      expect(audit).toBeGreaterThan(worked);
      expect(map).toBeGreaterThan(shows);
      expect(map).toBeLessThan(disclaimer);
      const sitemap = fs.readFileSync(path.join(distDir, 'sitemap-0.xml'), 'utf8');
      expect(sitemap).toContain('/work/agent-governance/');
      expect(sitemap).not.toContain('\u2014');
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
    expect((html.match(/data-gpill/g) || []).length).toBe(4); // 1 wall + 2 cloud + footer
    expect(html).toContain('field\u0020computation on a uniform grid'.replace('\u0020',' '));
    expect(html).toContain('noindex');
  });
});

describe('Glass Build B promotion: hero complications are refractive C', () => {
  it('home hero carries the bench and both glass pills', () => {
    const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
    expect(html).toContain('data-glass-bench');
    expect((html.match(/data-gpill/g) || []).length).toBe(3); // hero pair + footer
    expect((html.match(/data-variant="c"/g) || []).length).toBe(3);
  });
});

describe('The spread (owner order 2026-08-01): the material takes its seats', () => {
  it('work: the practice strip sits under Selected Work', () => {
    const work = fs.readFileSync(path.join(distDir, 'work/index.html'), 'utf8');
    const heroIdx = work.indexOf('Selected Work');
    const stripIdx = work.indexOf('Consulting in data engineering');
    expect(stripIdx).toBeGreaterThan(heroIdx);
    expect(stripIdx).toBeLessThan(work.indexOf('Job Application Analytics'));
    expect(work).not.toContain('Resume (PDF)');
    expect(work).not.toContain('/files/Williams-John-D-Resume.pdf');
    expect(fs.existsSync(path.join(distDir, 'files', 'Williams-John-D-Resume.pdf'))).toBe(false);
    expect(work).toContain('Data, cybersecurity and operations projects by John D. Williams, with writings and research to come.');
    expect(work).not.toContain('The living resume of John D. Williams: data engineering, cybersecurity, and operations projects, with writings and research to come.');
    expect(work).toContain('Process Controls');
    expect(work).not.toContain('Incident Command');
    expect(work).not.toContain('Forecasting tool for enterprise support operations');
    expect((work.match(/Forecasting/g) || []).length).toBe(0);
  });
  it('about: the consulting card is retired; More stands under the name', () => {
    const about = fs.readFileSync(path.join(distDir, 'about/index.html'), 'utf8');
    expect(about).not.toContain('I take on select consulting work');
    expect(about).not.toContain('Resume (PDF)');
    expect(about).not.toContain('/files/Williams-John-D-Resume.pdf');
    // Page-level pill removed. Footer Contact remains, so the count
    // is More + footer. Header Contact is a plain link, not a glass pill.
    expect((about.match(/data-gpill/g) || []).length).toBe(2);
    expect(about).toContain('/data/kinetic/earth.json');
    expect(about).not.toContain('/data/kinetic/structure.json');
    expect(about).not.toContain('/data/kinetic/sky.json');
    expect(about).toContain('Neon traced across the night');
    expect(about).toContain('Turquoise sea against rock formations');
  });
  it('beyond: photograph at rest, plates stay in templates until a mode is chosen', async () => {
    const beyond = fs.readFileSync(path.join(distDir, 'beyond/index.html'), 'utf8');
    const live = beyond.replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, '');
    const mainStart = beyond.indexOf('<main');
    const mainEnd = beyond.indexOf('</main>');
    const main = beyond.slice(mainStart, mainEnd);
    // Trailing space keeps the figure class from matching __canvas / __stage.
    // Nothing is mounted on first paint: a resting visit opens no depth WebGL context.
    expect((live.match(/class="kplate3d /g) || []).length).toBe(0);
    expect((live.match(/class="kinetic-plate /g) || []).length).toBe(0);
    expect((beyond.match(/class="kplate3d /g) || []).length).toBe(4);
    expect((beyond.match(/class="kinetic-plate /g) || []).length).toBe(4);
    expect((beyond.match(/data-study-tpl=/g) || []).length).toBe(4);
    expect((live.match(/Hologram · stacked planes/g) || []).length).toBe(0);
    expect(beyond).toContain('Hologram · stacked planes');
    expect(beyond).toContain('Point cloud · true depth');
    expect(beyond).toContain('data-depth-layers');
    expect(beyond).toContain('id="depth-layers"');
    expect(beyond).not.toMatch(/id="depth-layers"[^>]*\shidden/);
    expect(beyond).toContain('class="beyond-banner"');
    expect(beyond).toContain('Lone tree against a smoldering horizon');
    expect((beyond.match(/id="depth-stack"/g) || []).length).toBe(1);
    expect((beyond.match(/id="depth-separation"/g) || []).length).toBe(1);
    expect(beyond).toContain('The photograph separated into five depth layers, far to near.');
    expect(beyond).toContain('data-autoplay="0"');
    const banner = beyond.match(/<img\b[^>]*beyond-banner__img[^>]*>/i)?.[0];
    expect(banner, 'banner img').toBeTruthy();
    expect(banner).toContain('fetchpriority="high"');
    expect(banner).toContain('width="1200"');
    expect(banner).toContain('height="901"');
    expect(banner).not.toContain('style=');
    const bannerPicture = beyond.slice(beyond.indexOf('class="beyond-banner"'), beyond.indexOf('id="beyond"'));
    for (const tag of bannerPicture.match(/<(?:img|source)\b[^>]*>/gi) || []) {
      const srcset = tag.match(/\bsrcset="([^"]+)"/)?.[1];
      expect(srcset, tag).toBeTruthy();
      for (const part of srcset!.split(',')) {
        const candidate = part.trim().match(/^(\S+)\s+(\d+)w$/);
        expect(candidate, part).toBeTruthy();
        const file = await sharp(path.join(process.cwd(), 'public', candidate![1])).metadata();
        expect(file.width, candidate![1]).toBe(Number(candidate![2]));
      }
    }
    const stackBase = beyond.match(/<img\b[^>]*depth-stack__base[^>]*>/i)?.[0];
    expect(stackBase, 'depth stack base').toBeTruthy();
    expect(stackBase).toContain('loading="lazy"');
    expect(stackBase).not.toContain('fetchpriority');
    expect((beyond.match(/fetchpriority="high"/g) || []).length).toBe(2);
    expect(beyond).not.toContain('The same frame, as space');
    expect(beyond).not.toContain('Beyond%20Photography');
    expect(beyond).toContain('The envelope');
    expect(beyond).toContain('img-2528');
    expect(beyond).toContain('dsc-0014');
    expect(beyond).toContain('dscf1022');
    expect(beyond).not.toContain('img-6552');
    expect(beyond).not.toContain('7r51018-enhanced-sr');
    expect(beyond).toContain('>Contact<');
    expect(main).not.toContain('>Contact<');
    expect(main).not.toContain('Take one home');
    expect(main).not.toContain('The edition');
    expect(main).not.toContain('Three sizes, one depth');
    expect(main).not.toContain('Collecting');
    expect(main).not.toContain('Hahnemühle');
    expect(main).not.toContain('cut to order');
    expect(main).not.toContain('—');
    expect(main).toContain('Studies in texture.');
    expect(main).toContain('Scale study');
    expect(main).toContain('One depth, three sizes');
    expect(main).toContain('Open questions');
    expect(main).toContain('Which relief depth survives ordinary room light?');
    expect(main).toContain('a Gaussian convolution, the closed-form');
    expect(main).toContain('Back to the photographs');
    // 2026-10-28 rebuild: the hero is full-bleed under the bleed-short
    // exemption, the seven relief thumbnails are one scrubbed figure, and
    // the page's controls share the layer figure's box (no glass chip rail).
    expect(banner).toContain('data-bleed-short');
    expect(main).toContain('Seven depths, one photograph.');
    expect((main.match(/class="depth-scrub__frame/g) || []).length).toBe(2);
    expect(main).toMatch(/<input[^>]*type="range"[^>]*max="6"[^>]*aria-valuetext="4 mm"[^>]*data-scrub-range/);
    expect(main).not.toContain('glass-chip-rail');
    expect(main).not.toContain('depth-grid');
    expect(main).not.toContain('The depth studies');
    const imgs = beyond.match(/<img\b[^>]*>/gi) || [];
    expect(imgs.length).toBeGreaterThan(0);
    for (const tag of imgs) {
      const src = tag.match(/\bsrc="([^"]+)"/)?.[1] ?? tag.match(/\bdata-src="([^"]+)"/)?.[1];
      const width = tag.match(/\bwidth="(\d+)"/)?.[1];
      const height = tag.match(/\bheight="(\d+)"/)?.[1];
      expect(src, tag).toBeTruthy();
      expect(width, src).toBeTruthy();
      expect(height, src).toBeTruthy();
      const meta = await sharp(path.join(process.cwd(), 'public', src!)).metadata();
      expect(String(meta.width), src).toBe(width);
      expect(String(meta.height), src).toBe(height);
    }
  });
  it('depth: draft figure is noindex, unlinked from the sitemap, and has no inline styles', () => {
    const html = fs.readFileSync(path.join(distDir, 'depth/index.html'), 'utf8');
    expect(html).toContain('noindex');
    expect(html).toContain('id="depth-stack"');
    expect(html).toContain('id="depth-separation"');
    expect(html).toContain('type="range"');
    expect(html).toContain('min="0"');
    expect(html).toContain('max="1"');
    expect(html).toContain('step="0.01"');
    expect(html).toContain('Layer separation');
    expect(html).toContain('>Replay<');
    expect(html).not.toContain('\u2014');
    expect(html).not.toMatch(/<style[\s\S]*?<\/style>/);
    expect(html).not.toMatch(/\sstyle="/);
    expect(html).not.toContain('KineticPlate');
    expect(html).toContain('fetchpriority="high"');
    expect(html).not.toContain('data-autoplay="0"');
    expect(html).toContain('/images/depth/w800/layer1.webp 800w');
    expect(html).not.toContain('2400w');
    const lower = html.toLowerCase();
    // Sales wording stays banned. The nav label is Contact, and this page
    // sets inquire={false}, so that CTA is absent too. Same count: zero.
    for (const word of ['purchase', 'sale', 'price', 'edition', 'inquire', 'licence', 'license']) {
      expect(lower, word).not.toMatch(new RegExp(`\\b${word}\\b`));
    }
    expect(html).not.toContain('>Contact<');
    expect(html).not.toContain('aria-label="Contact"');
    const sitemap = fs.readFileSync(path.join(distDir, 'sitemap-0.xml'), 'utf8');
    expect(sitemap).not.toContain('/depth');
    expect(sitemap).not.toContain('\u2014');
    const robots = fs.readFileSync(path.join(distDir, 'robots.txt'), 'utf8');
    expect(robots).toContain('Disallow: /depth');
  });

  it('footer: the inquiry stands beside the verse on every page', () => {
    const beyond = fs.readFileSync(path.join(distDir, 'beyond/index.html'), 'utf8');
    const footIdx = beyond.indexOf('John 15:13');
    expect(footIdx).toBeGreaterThan(-1);
    expect(beyond.slice(footIdx - 2000).includes('data-gpill')).toBe(true);
  });
});
