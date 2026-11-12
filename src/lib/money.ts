// Money is whole sen (integer). Parsing and formatting use strings and integers only.

const AMOUNT = /^(?:rm)?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;

/** Parse "12", "12.5", "1,234.50", "RM12.50" into sen. Returns null for anything else. */
export function parseRM(text: string): number | null {
  const match = AMOUNT.exec(text.trim().toLowerCase());
  if (!match) return null;
  const ringgit = Number(match[1].replaceAll(',', ''));
  const sen = Number((match[2] ?? '').padEnd(2, '0'));
  const total = ringgit * 100 + sen;
  return Number.isSafeInteger(total) ? total : null;
}

/** Format sen as "RM 1,234.50", or "-RM 5.00" when negative. */
export function formatRM(sen: number): string {
  const abs = Math.abs(sen);
  const ringgit = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cents = (abs % 100).toString().padStart(2, '0');
  return `${sen < 0 ? '-' : ''}RM ${ringgit}.${cents}`;
}

/**
 * The AI budget's US dollars, from whole micro-USD, to the nearest cent: "US$1.02". An amount
 * that rounds to nothing reads "under US$0.01", so usage never looks like zero.
 */
export function formatUsd(microUsd: number): string {
  const cents = Math.round(microUsd / 10_000);
  if (microUsd > 0 && cents === 0) return 'under US$0.01';
  return `US$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
