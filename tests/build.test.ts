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

  it('/writing renders as a redirect to home', () => {
    const writingPath = path.join(distDir, 'writing', 'index.html');
    expect(fs.existsSync(writingPath)).toBe(true);
    const html = fs.readFileSync(writingPath, 'utf-8');
    expect(html).toMatch(/http-equiv="refresh"/i);
    expect(html).toContain('noindex');
  });

  it('/links renders as a redirect to home', () => {
    const linksPath = path.join(distDir, 'links', 'index.html');
    expect(fs.existsSync(linksPath)).toBe(true);
    const html = fs.readFileSync(linksPath, 'utf-8');
    expect(html).toMatch(/http-equiv="refresh"/i);
    expect(html).toContain('noindex');
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

    it('does not contain the removed Links nav entry', () => {
      // Removed from the desktop/mobile nav — nav items array is now 3
      // The /links route still exists as a redirect but is not linked from nav
      const navSection = indexHtml.match(/<nav[\s\S]*?<\/nav>/g)?.join('\n') ?? '';
      expect(navSection).not.toContain('href="/links"');
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
      expect(aboutHtml).toContain('linear-gradient(to right, #0a0a0a 0%');
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

  it('wires the pointer-tracked specular listener in the hoisted bundle', () => {
    const assetsDir = path.join(distDir, '_assets');
    const jsFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
    const jsBundle = jsFiles
      .map((f) => fs.readFileSync(path.join(assetsDir, f), 'utf-8'))
      .join('\n');
    // Minifier rewrites function names; fingerprint on stable string literals.
    expect(jsBundle).toContain('--mx');
    expect(jsBundle).toContain('--my');
    expect(jsBundle).toContain('pointermove');
    expect(jsBundle).toContain('prefers-reduced-motion: reduce');
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

  it('emits pointer-tracked specular variables on glass surfaces', () => {
    expect(cssBundle).toContain('var(--mx');
    expect(cssBundle).toContain('var(--my');
  });

  it('gates the Tier 2 displacement behind @supports', () => {
    expect(cssBundle).toContain('backdrop-filter: url(#glass-lens)');
    // The @supports rule should be emitted, not the unconditional form.
    expect(cssBundle).toMatch(/@supports[^{]*backdrop-filter:\s*url\(#glass-lens\)/);
  });

  it('respects prefers-reduced-motion for glass specular', () => {
    expect(cssBundle).toContain('prefers-reduced-motion');
  });
});
