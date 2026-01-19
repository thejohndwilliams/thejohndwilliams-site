import { describe, it, expect } from 'vitest';
import { formatDate, getCurrentYear } from '../src/utils/date';

describe('formatDate', () => {
  it('formats a valid ISO date string correctly', () => {
    expect(formatDate('2025-01-15')).toBe('January 15, 2025');
  });

  it('formats dates with different months', () => {
    expect(formatDate('2024-06-01')).toBe('June 1, 2024');
    expect(formatDate('2023-12-25')).toBe('December 25, 2023');
  });

  it('handles single-digit days correctly', () => {
    expect(formatDate('2025-03-05')).toBe('March 5, 2025');
  });

  it('handles leap year dates', () => {
    expect(formatDate('2024-02-29')).toBe('February 29, 2024');
  });

  it('throws an error for invalid date strings', () => {
    expect(() => formatDate('invalid-date')).toThrow('Invalid date string: invalid-date');
  });

  it('throws an error for empty string', () => {
    expect(() => formatDate('')).toThrow('Invalid date string: ');
  });

  it('handles full ISO datetime strings', () => {
    const result = formatDate('2025-01-15T12:00:00Z');
    expect(result).toContain('2025');
    expect(result).toContain('January');
  });
});

describe('getCurrentYear', () => {
  it('returns the current year', () => {
    const currentYear = new Date().getFullYear();
    expect(getCurrentYear()).toBe(currentYear);
  });

  it('returns a number', () => {
    expect(typeof getCurrentYear()).toBe('number');
  });

  it('returns a four-digit year', () => {
    const year = getCurrentYear();
    expect(year).toBeGreaterThanOrEqual(2020);
    expect(year).toBeLessThanOrEqual(2100);
  });
});
