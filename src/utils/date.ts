/**
 * Formats an ISO date string to a human-readable format.
 * @param dateString - ISO date string (e.g., "2025-01-15")
 * @returns Formatted date string (e.g., "January 15, 2025")
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date string: ${dateString}`);
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    // Parse-as-UTC dates ('2025-03-05' = UTC midnight) must format in UTC too,
    // or negative-offset timezones roll back a day. Keeps output TZ-stable.
    timeZone: 'UTC',
  });
}

/**
 * Gets the current year.
 * @returns Current year as a number
 */
export function getCurrentYear(): number {
  return new Date().getFullYear();
}

/**
 * Navigation items for the header component.
 */
export const navItems = [
  { name: 'Photography', href: '/photography/' },
  { name: 'Work', href: '/work/' },
  { name: 'Beyond', href: '/beyond/' },
  { name: 'About', href: '/about/' },
] as const;

const connectSet = (slug: string, ext: 'avif' | 'webp') =>
  [400, 800, 1200, 1600].map((w) => `/images/connect/${slug}-${w}.${ext} ${w}w`).join(', ');

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
    connectAvif: connectSet('linkedin', 'avif'),
    connectWebp: connectSet('linkedin', 'webp'),
    w: 1600,
    h: 900,
    thumbAvif: '/images/links/linkedin-240.avif',
    thumb: '/images/links/linkedin-240.webp',
    thumbFallback: '/images/links/linkedin-240.jpg',
    thumbW: 240,
    thumbH: 135,
    heroAlt: 'Macro photograph of wet moss with water droplets and golden highlights'
  },
  {
    name: 'GitHub',
    url: 'https://github.com/thejohndwilliams',
    description: 'Code',
    icon: '/images/previews/github.svg',
    hero: '/images/github-hero.webp',
    heroFallback: '/images/github-hero.jpg',
    connectAvif: connectSet('github', 'avif'),
    connectWebp: connectSet('github', 'webp'),
    w: 1600,
    h: 1200,
    thumbAvif: '/images/links/github-240.avif',
    thumb: '/images/links/github-240.webp',
    thumbFallback: '/images/links/github-240.jpg',
    thumbW: 240,
    thumbH: 180,
    heroAlt: 'Thermal visualization of a floor plan in neon pink and cyan'
  },
  {
    name: 'Instagram',
    url: 'https://www.instagram.com/thejohndwilliams/',
    description: 'Photography',
    icon: '/images/previews/instagram.svg',
    hero: '/images/instagram-hero.webp',
    heroFallback: '/images/instagram-hero.jpg',
    connectAvif: connectSet('instagram', 'avif'),
    connectWebp: connectSet('instagram', 'webp'),
    w: 1600,
    h: 900,
    thumbAvif: '/images/links/instagram-240.avif',
    thumb: '/images/links/instagram-240.webp',
    thumbFallback: '/images/links/instagram-240.jpg',
    thumbW: 240,
    thumbH: 135,
    heroAlt: 'Single white cloud against a deep blue night sky'
  },
  {
    name: 'Behance',
    url: 'https://www.behance.net/killthewizard',
    description: 'Design',
    icon: '/images/previews/behance.svg',
    hero: '/images/behance-hero.webp',
    heroFallback: '/images/behance-hero.jpg',
    connectAvif: connectSet('behance', 'avif'),
    connectWebp: connectSet('behance', 'webp'),
    w: 1600,
    h: 1008,
    thumbAvif: '/images/links/behance-240.avif',
    thumb: '/images/links/behance-240.webp',
    thumbFallback: '/images/links/behance-240.jpg',
    thumbW: 240,
    thumbH: 151,
    heroAlt: 'Abstract minimalist silhouettes in soft gray and pale green tones'
  }
] as const;
