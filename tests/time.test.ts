import { describe, expect, it } from 'vitest';
import { dayKey, fromLocalDateTime, monthKey, monthLabel, monthRange, parseMonthParam, shiftMonth, timeKey } from '@/lib/time';

// 2026-10-31T16:30:00Z is 00:30 on 1 Nov in Malaysia
const lateOct = new Date('2026-10-31T16:30:00Z');

describe('time helpers (Asia/Kuala_Lumpur)', () => {
  it('keys a date by its Malaysian month and day', () => {
    expect(monthKey(lateOct)).toBe('2026-11');
    expect(dayKey(lateOct)).toBe('2026-11-01');
  });

  it('gives a month range with an exclusive end', () => {
    expect(monthRange('2026-11').start.toISOString()).toBe('2026-10-31T16:00:00.000Z');
    expect(monthRange('2026-11').end.toISOString()).toBe('2026-11-30T16:00:00.000Z');
  });

  it('rolls the range over a year boundary', () => {
    expect(monthRange('2026-12').end.toISOString()).toBe('2026-12-31T16:00:00.000Z');
  });

  it('converts local date and time to UTC', () => {
    expect(fromLocalDateTime('2026-11-01', '00:30').toISOString()).toBe('2026-10-31T16:30:00.000Z');
  });

  it('labels a month', () => {
    expect(monthLabel('2026-11')).toBe('November 2026');
  });

  it('accepts a YYYY-MM month parameter and falls back to the current month otherwise', () => {
    const now = monthKey(new Date());
    expect(parseMonthParam('2026-03')).toBe('2026-03');
    for (const bad of [undefined, '', '2026-13', '2026-00', '2026-3', '26-03', '2026-03-01', ' 2026-03', 'abc', '0000-05']) {
      expect(parseMonthParam(bad)).toBe(now);
    }
  });

  it('shifts a month across year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-11', 0)).toBe('2026-11');
  });

  it('reads the Malaysian clock time', () => {
    expect(timeKey(lateOct)).toBe('00:30');
  });
});
