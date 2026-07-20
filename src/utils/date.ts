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
  { name: 'Photography', href: '/photography' },
  { name: 'Work', href: '/work' },
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
