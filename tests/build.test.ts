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
    const pages = ['about', 'work', 'writing', 'links'];
    pages.forEach((page) => {
      const pagePath = path.join(distDir, page, 'index.html');
      expect(fs.existsSync(pagePath)).toBe(true);
    });
  });

  it('generates 404 page', () => {
    // 404 is generated at root level, not in a subdirectory
    const notFoundPath = path.join(distDir, '404.html');
    expect(fs.existsSync(notFoundPath)).toBe(true);
  });

  it('generates the blog post page', () => {
    const postPath = path.join(distDir, 'writing', 'dashboard-nobody-uses', 'index.html');
    expect(fs.existsSync(postPath)).toBe(true);
  });
});

describe('Generated HTML Content', () => {
  let indexHtml: string;
  let aboutHtml: string;
  let workHtml: string;
  let writingHtml: string;

  beforeAll(async () => {
    await execAsync('npm run build');
    indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');
    aboutHtml = fs.readFileSync(path.join(distDir, 'about', 'index.html'), 'utf-8');
    workHtml = fs.readFileSync(path.join(distDir, 'work', 'index.html'), 'utf-8');
    writingHtml = fs.readFileSync(path.join(distDir, 'writing', 'index.html'), 'utf-8');
  }, 60000);

  describe('Homepage', () => {
    it('contains the site title', () => {
      expect(indexHtml).toContain('John D. Williams');
    });

    it('contains navigation links', () => {
      expect(indexHtml).toContain('href="/about"');
      expect(indexHtml).toContain('href="/work"');
      expect(indexHtml).toContain('href="/writing"');
    });

    it('contains social links', () => {
      expect(indexHtml).toContain('linkedin.com');
      expect(indexHtml).toContain('github.com');
    });
  });

  describe('About Page', () => {
    it('contains the about page title', () => {
      expect(aboutHtml).toContain('About');
    });

    it('contains biographical content', () => {
      expect(aboutHtml).toContain('data');
    });
  });

  describe('Work Page', () => {
    it('contains project information', () => {
      expect(workHtml).toContain('Enterprise Analytics Platform');
    });

    it('contains technology tags', () => {
      expect(workHtml).toContain('Python');
    });
  });

  describe('Writing Page', () => {
    it('contains blog post listing', () => {
      expect(writingHtml).toContain('dashboard');
    });

    it('links to blog posts', () => {
      expect(writingHtml).toContain('href="/writing/dashboard-nobody-uses"');
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
});
