/**
 * Site link data: header nav and social links. Single source for the
 * nav, the footer and /links. Moved from src/utils/date.ts (no value change).
 */

/**
 * Navigation items for the header component.
 */
export const navItems = [
  { name: 'Photography', href: '/photography' },
  { name: 'Work', href: '/work' },
  { name: 'Beyond', href: '/beyond' },
  { name: 'About', href: '/about' },
] as const;

/**
 * Connect-section social links. Single source of truth (P3 fix, 2026-07-19):
 * the home page previously rendered its own diverged copy while tests
 * asserted this one. Rendered by index.astro, locked by navigation.test.
 */
export const socialLinks = [
  {
    name: 'LinkedIn',
    url: 'https://www.linkedin.com/in/john-davis-williams/',
    description: 'Professional network',
    icon: '/images/previews/linkedin.svg',
    hero: '/images/linkedin-hero.webp',
    heroFallback: '/images/linkedin-hero.jpg',
    heroAlt: 'Macro photograph of wet moss with water droplets and golden highlights'
  },
  {
    name: 'GitHub',
    url: 'https://github.com/thejohndwilliams',
    description: 'Code',
    icon: '/images/previews/github.svg',
    hero: '/images/github-hero.webp',
    heroFallback: '/images/github-hero.jpg',
    heroAlt: 'Thermal visualization of a floor plan in neon pink and cyan'
  },
  {
    name: 'Instagram',
    url: 'https://www.instagram.com/thejohndwilliams/',
    description: 'Photography',
    icon: '/images/previews/instagram.svg',
    hero: '/images/instagram-hero.webp',
    heroFallback: '/images/instagram-hero.jpg',
    heroAlt: 'Single white cloud against a deep blue night sky'
  },
  {
    name: 'Behance',
    url: 'https://www.behance.net/killthewizard',
    description: 'Design',
    icon: '/images/previews/behance.svg',
    hero: '/images/behance-hero.webp',
    heroFallback: '/images/behance-hero.jpg',
    heroAlt: 'Abstract minimalist silhouettes in soft gray and pale green tones'
  }
] as const;
