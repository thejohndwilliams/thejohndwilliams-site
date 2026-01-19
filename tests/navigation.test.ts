import { describe, it, expect } from 'vitest';
import { navItems, socialLinks } from '../src/utils/date';

describe('navItems', () => {
  it('has the correct number of navigation items', () => {
    expect(navItems).toHaveLength(4);
  });

  it('contains all required navigation pages', () => {
    const names = navItems.map((item) => item.name);
    expect(names).toContain('About');
    expect(names).toContain('Work');
    expect(names).toContain('Writing');
    expect(names).toContain('Links');
  });

  it('has correct href paths for all items', () => {
    const hrefs = navItems.map((item) => item.href);
    expect(hrefs).toContain('/about');
    expect(hrefs).toContain('/work');
    expect(hrefs).toContain('/writing');
    expect(hrefs).toContain('/links');
  });

  it('each item has both name and href properties', () => {
    navItems.forEach((item) => {
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('href');
      expect(typeof item.name).toBe('string');
      expect(typeof item.href).toBe('string');
    });
  });

  it('all hrefs start with a forward slash', () => {
    navItems.forEach((item) => {
      expect(item.href.startsWith('/')).toBe(true);
    });
  });
});

describe('socialLinks', () => {
  it('has the correct number of social links', () => {
    expect(socialLinks).toHaveLength(3);
  });

  it('contains all required social platforms', () => {
    const names = socialLinks.map((link) => link.name);
    expect(names).toContain('LinkedIn');
    expect(names).toContain('GitHub');
    expect(names).toContain('Instagram');
  });

  it('each link has both name and url properties', () => {
    socialLinks.forEach((link) => {
      expect(link).toHaveProperty('name');
      expect(link).toHaveProperty('url');
      expect(typeof link.name).toBe('string');
      expect(typeof link.url).toBe('string');
    });
  });

  it('all urls are valid HTTPS URLs', () => {
    socialLinks.forEach((link) => {
      expect(link.url.startsWith('https://')).toBe(true);
      expect(() => new URL(link.url)).not.toThrow();
    });
  });

  it('LinkedIn URL points to correct profile', () => {
    const linkedin = socialLinks.find((link) => link.name === 'LinkedIn');
    expect(linkedin?.url).toContain('linkedin.com');
  });

  it('GitHub URL points to correct profile', () => {
    const github = socialLinks.find((link) => link.name === 'GitHub');
    expect(github?.url).toContain('github.com');
  });

  it('Instagram URL points to correct profile', () => {
    const instagram = socialLinks.find((link) => link.name === 'Instagram');
    expect(instagram?.url).toContain('instagram.com');
  });
});
