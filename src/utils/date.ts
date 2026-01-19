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
  { name: 'About', href: '/about' },
  { name: 'Work', href: '/work' },
  { name: 'Writing', href: '/writing' },
  { name: 'Links', href: '/links' },
] as const;

/**
 * Social links for the footer component.
 */
export const socialLinks = [
  { name: 'LinkedIn', url: 'https://www.linkedin.com/in/john-davis-williams/' },
  { name: 'GitHub', url: 'https://github.com/thejohndwilliams' },
  { name: 'Instagram', url: 'https://www.instagram.com/thejohndwilliams/' },
] as const;
