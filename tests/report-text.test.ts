import { describe, expect, it } from 'vitest';
import { changeSummary } from '@/lib/report-text';
import { dayMonthLabel } from '@/lib/time';

describe('changeSummary', () => {
  it('says how much more was spent, in RM and percent', () => {
    expect(changeSummary(147440, 131200)).toEqual({ kind: 'more', diffSen: 16240, percent: 12 });
  });

  it('says how much less was spent', () => {
    expect(changeSummary(100, 200)).toEqual({ kind: 'less', diffSen: 100, percent: 50 });
  });

  it('says when nothing changed', () => {
    expect(changeSummary(500, 500)).toEqual({ kind: 'same', diffSen: 0, percent: 0 });
  });

  it('gives no percent when last month had no spending', () => {
    expect(changeSummary(500, 0)).toEqual({ kind: 'noPrevious', diffSen: 500, percent: null });
    expect(changeSummary(0, 0)).toEqual({ kind: 'noPrevious', diffSen: 0, percent: null });
  });
});

describe('dayMonthLabel', () => {
  it('writes a day of a month in either language', () => {
    expect(dayMonthLabel('2026-11', 17)).toBe('17 Nov');
    expect(dayMonthLabel('2026-08', 3, 'ms')).toBe('3 Ogo');
  });
});
