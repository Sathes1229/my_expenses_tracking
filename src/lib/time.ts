import type { Locale } from '@/i18n/locale';

export const TZ = 'Asia/Kuala_Lumpur';

/** The Intl locale behind each app language: British English and Malaysian Malay. */
const INTL: Record<Locale, string> = { en: 'en-GB', ms: 'ms-MY' };

const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function local(d: Date): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of parts.formatToParts(d)) out[p.type] = p.value;
  return out;
}

export function monthKey(d: Date): string {
  const p = local(d);
  return `${p.year}-${p.month}`;
}

/** The latest month an entry can be in: entries may be dated up to a day ahead. */
export function latestMonth(now: Date = new Date()): string {
  return monthKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));
}

export function dayKey(d: Date): string {
  const p = local(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Interpret a wall-clock date ("2026-11-01") and time ("00:30") in TZ and return the instant. */
export function fromLocalDateTime(date: string, time: string): Date {
  const wall = Date.parse(`${date}T${time}:00Z`);
  if (Number.isNaN(wall)) throw new RangeError(`Invalid date/time: ${date} ${time}`);
  // Offset of TZ at roughly this instant, taken from what the formatter shows for the guess.
  const shown = local(new Date(wall));
  const shownMs = Date.parse(
    `${shown.year}-${shown.month}-${shown.day}T${shown.hour}:${shown.minute}:${shown.second}Z`,
  );
  const offset = shownMs - wall;
  return new Date(wall - offset);
}

/** First instant of the month (inclusive) to the first instant of the next month (exclusive). */
export function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return {
    start: fromLocalDateTime(`${month}-01`, '00:00'),
    end: fromLocalDateTime(`${next}-01`, '00:00'),
  };
}

const MONTH_PARAM = /^(?!0000)\d{4}-(?:0[1-9]|1[0-2])$/;

/** A month from a query string or form, checked as YYYY-MM. Anything else gives the current month. */
export function parseMonthParam(value: string | undefined): string {
  return value !== undefined && MONTH_PARAM.test(value) ? value : monthKey(new Date());
}

export function monthLabel(month: string, locale: Locale = 'en'): string {
  const [y, m] = month.split('-').map(Number);
  const name = new Intl.DateTimeFormat(INTL[locale], { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
  return `${name} ${y}`;
}

/** "17 Nov" or "3 Ogo": a day of a YYYY-MM month, in the given language. */
export function dayMonthLabel(month: string, day: number, locale: Locale = 'en'): string {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(INTL[locale], { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, day)),
  );
}

/** The month `delta` months from `month` (a YYYY-MM string). */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** "HH:mm" on the Malaysia clock, for a time input. */
export function timeKey(d: Date): string {
  const p = local(d);
  return `${p.hour}:${p.minute}`;
}

const whenOptions = {
  short: { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  long: { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

const when = {
  short: { en: new Intl.DateTimeFormat(INTL.en, whenOptions.short), ms: new Intl.DateTimeFormat(INTL.ms, whenOptions.short) },
  long: { en: new Intl.DateTimeFormat(INTL.en, whenOptions.long), ms: new Intl.DateTimeFormat(INTL.ms, whenOptions.long) },
};

/** "3 Nov, 12:00" in Malaysia time. */
export const formatWhen = (d: Date, locale: Locale = 'en') => when.short[locale].format(d);
/** "3 November 2026, 12:00" in Malaysia time. */
export const formatWhenLong = (d: Date, locale: Locale = 'en') => when.long[locale].format(d);
