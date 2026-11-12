export const TZ = 'Asia/Kuala_Lumpur';

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

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const name = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
  return `${name} ${y}`;
}
