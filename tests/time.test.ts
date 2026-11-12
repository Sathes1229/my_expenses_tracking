import { describe, expect, it } from 'vitest';
import { dayKey, fromLocalDateTime, monthKey, monthLabel, monthRange } from '@/lib/time';

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
});
