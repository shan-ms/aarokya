/**
 * ART – Utility function tests
 *
 * Covers:
 *  - cn() (class merging)
 *  - formatCurrency() – paise → ₹ with Indian formatting
 *  - formatCurrencyCompact() – K / L / Cr abbreviations
 *  - formatDate() / formatDateTime()
 *  - formatPhone()
 *  - truncate()
 */

import {
  cn,
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatDateTime,
  formatPhone,
  truncate,
} from '@/lib/utils';

// ── cn (class name merger) ─────────────────────────────────────────

describe('cn', () => {
  it('merges class strings', () => {
    const result = cn('text-red-500', 'bg-blue-500');
    expect(result).toContain('text-red-500');
    expect(result).toContain('bg-blue-500');
  });

  it('handles conditional classes', () => {
    const result = cn('base', false && 'hidden', 'extra');
    expect(result).toContain('base');
    expect(result).toContain('extra');
    expect(result).not.toContain('hidden');
  });

  it('resolves tailwind conflicts (last wins)', () => {
    const result = cn('text-red-500', 'text-blue-500');
    expect(result).toBe('text-blue-500');
  });

  it('handles undefined and null inputs', () => {
    const result = cn('base', undefined, null);
    expect(result).toBe('base');
  });
});

// ── formatCurrency ─────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats 0 paise as ₹0.00', () => {
    const result = formatCurrency(0);
    expect(result).toMatch(/₹\s?0\.00/);
  });

  it('formats 100 paise as ₹1.00', () => {
    const result = formatCurrency(100);
    expect(result).toMatch(/₹\s?1\.00/);
  });

  it('formats 399900 paise (basic insurance threshold) correctly', () => {
    const result = formatCurrency(399900);
    // Should be ₹3,999.00 in en-IN
    expect(result).toMatch(/3,999\.00/);
  });

  it('formats 1000000 paise (premium insurance threshold) correctly', () => {
    const result = formatCurrency(1000000);
    // ₹10,000.00
    expect(result).toMatch(/10,000\.00/);
  });

  it('formats large values with Indian grouping (lakhs, crores)', () => {
    const result = formatCurrency(1875000000); // ₹1,87,50,000.00
    expect(result).toMatch(/1,87,50,000\.00/);
  });

  it('handles negative paise', () => {
    const result = formatCurrency(-50000);
    expect(result).toMatch(/-₹\s?500\.00|₹\s?-500\.00/);
  });

  it('formats fractional paise (e.g. 150 → ₹1.50)', () => {
    const result = formatCurrency(150);
    expect(result).toMatch(/1\.50/);
  });
});

// ── formatCurrencyCompact ──────────────────────────────────────────

describe('formatCurrencyCompact', () => {
  it('formats values below ₹1K with full currency format', () => {
    const result = formatCurrencyCompact(5000); // ₹50
    expect(result).toMatch(/₹\s?50\.00/);
  });

  it('formats thousands as K', () => {
    const result = formatCurrencyCompact(100000); // ₹1000 → ₹1.0K
    expect(result).toBe('₹1.0K');
  });

  it('formats lakhs as L', () => {
    const result = formatCurrencyCompact(10000000); // ₹1,00,000 → ₹1.00L
    expect(result).toBe('₹1.00L');
  });

  it('formats crores as Cr', () => {
    const result = formatCurrencyCompact(1000000000); // ₹1,00,00,000 → ₹1.00Cr
    expect(result).toBe('₹1.00Cr');
  });

  it('formats 1875000000 paise (dashboard HSA value) as ₹1.88Cr', () => {
    const result = formatCurrencyCompact(1875000000);
    expect(result).toBe('₹1.88Cr');
  });

  it('formats 34500000 paise (daily contributions) as ₹3.45L', () => {
    const result = formatCurrencyCompact(34500000);
    expect(result).toBe('₹3.45L');
  });

  it('formats 0 paise', () => {
    const result = formatCurrencyCompact(0);
    expect(result).toMatch(/₹\s?0\.00/);
  });
});

// ── formatDate / formatDateTime ────────────────────────────────────

describe('formatDate', () => {
  it('formats ISO date string to default format (dd MMM yyyy)', () => {
    expect(formatDate('2026-03-18T10:30:00Z')).toBe('18 Mar 2026');
  });

  it('accepts custom format string', () => {
    expect(formatDate('2026-03-18T10:30:00Z', 'yyyy-MM-dd')).toBe('2026-03-18');
  });

  it('returns original string for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('handles date-only ISO string', () => {
    expect(formatDate('2025-06-15')).toBe('15 Jun 2025');
  });
});

describe('formatDateTime', () => {
  it('includes time with AM/PM', () => {
    const result = formatDateTime('2026-03-18T10:30:00Z');
    // "dd MMM yyyy, hh:mm a"
    expect(result).toMatch(/18 Mar 2026/);
    expect(result).toMatch(/\d{2}:\d{2}\s?(AM|PM)/i);
  });
});

// ── formatPhone ────────────────────────────────────────────────────

describe('formatPhone', () => {
  it('formats +91 13-digit phone with spaces', () => {
    expect(formatPhone('+919876543210')).toBe('+91 98765 43210');
  });

  it('returns unchanged for non-Indian numbers', () => {
    expect(formatPhone('+14155551234')).toBe('+14155551234');
  });

  it('returns unchanged for short numbers', () => {
    expect(formatPhone('+9198765')).toBe('+9198765');
  });

  it('returns unchanged for numbers without +91 prefix', () => {
    expect(formatPhone('9876543210')).toBe('9876543210');
  });
});

// ── truncate ───────────────────────────────────────────────────────

describe('truncate', () => {
  it('does not truncate when string is shorter than limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('does not truncate when string equals limit', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates and adds ellipsis when string exceeds limit', () => {
    expect(truncate('hello world', 5)).toBe('hello...');
  });

  it('handles empty string', () => {
    expect(truncate('', 5)).toBe('');
  });

  it('handles limit of 0', () => {
    expect(truncate('hello', 0)).toBe('...');
  });
});
