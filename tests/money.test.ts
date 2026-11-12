import { describe, expect, it } from 'vitest';
import { formatRM, parseRM } from '@/lib/money';

describe('parseRM', () => {
  it('parses plain and decimal amounts into sen', () => {
    expect(parseRM('12')).toBe(1200);
    expect(parseRM('12.5')).toBe(1250);
    expect(parseRM('1,234.50')).toBe(123450);
  });

  it('accepts an RM prefix in any case with spaces', () => {
    expect(parseRM('RM12.50')).toBe(1250);
    expect(parseRM(' rm 0.07 ')).toBe(7);
  });

  it('rejects invalid input', () => {
    expect(parseRM('12.345')).toBeNull();
    expect(parseRM('-5')).toBeNull();
    expect(parseRM('')).toBeNull();
    expect(parseRM('abc')).toBeNull();
  });
});

describe('formatRM', () => {
  it('formats sen as ringgit', () => {
    expect(formatRM(123450)).toBe('RM 1,234.50');
    expect(formatRM(-500)).toBe('-RM 5.00');
  });
});
