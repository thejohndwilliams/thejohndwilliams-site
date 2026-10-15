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

// Re-exported for backward compatibility; source of truth is src/data/links.ts.
export { navItems, socialLinks } from '../data/links';
