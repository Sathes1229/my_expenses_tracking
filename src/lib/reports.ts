import type { Viewer } from '@/lib/auth/viewer';
import { listBudgetNames } from './budgets';
import { ForbiddenError } from './errors';
import { dayKey, monthKey, shiftMonth } from './time';
import { listTransactions, type TransactionRow } from './transactions';

/** One budget's spending in the report's month and the month before. `id: null` is Uncategorised. */
export type ReportRow = { id: string | null; name: string; archived: boolean; thisSen: number; lastSen: number };
/** Spending so far by the end of `day`, in each month; null past today or past that month's end. */
export type DailyPoint = { day: number; thisSen: number | null; lastSen: number | null };

export type MonthReport = {
  month: string;
  previous: string;
  totalSen: number;
  previousTotalSen: number;
  /** Budgets with spending in either month, this month's largest first. */
  byBudget: ReportRow[];
  daily: DailyPoint[];
  /** The current month only: both months up to the same day, capped at last month's length. */
  sameDay: { day: number; thisSen: number; lastSen: number } | null;
};

function daysIn(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Spending per day of the month, on the Malaysia clock. */
function byDay(rows: TransactionRow[]): Map<number, number> {
  const days = new Map<number, number>();
  for (const row of rows) {
    const day = Number(dayKey(row.occurredAt).slice(8));
    days.set(day, (days.get(day) ?? 0) + row.totalSen);
  }
  return days;
}

/** Running totals for days 1..length; null after `lastDay`. */
function cumulative(days: Map<number, number>, length: number, lastDay: number): (number | null)[] {
  let sum = 0;
  return Array.from({ length }, (_, i) => {
    const day = i + 1;
    if (day > lastDay) return null;
    sum += days.get(day) ?? 0;
    return sum;
  });
}

/**
 * The monthly report: totals, each budget against last month, and the two months day by day. Built
 * from the same reads as Home, so a guest, who sees no household figures, is refused.
 */
export async function getMonthReport(viewer: Viewer, month: string, now: Date = new Date()): Promise<MonthReport> {
  if (viewer.role === 'guest') throw new ForbiddenError();
  const previous = shiftMonth(month, -1);
  const [thisRows, lastRows, active] = await Promise.all([
    listTransactions(viewer, { month }),
    listTransactions(viewer, { month: previous }),
    listBudgetNames(viewer),
  ]);
  const activeIds = new Set(active.map((b) => b.id));

  const rows = new Map<string | null, ReportRow>();
  const add = (row: TransactionRow, which: 'thisSen' | 'lastSen') => {
    let entry = rows.get(row.budgetId);
    if (!entry) {
      entry = {
        id: row.budgetId,
        // The page shows its own word for Uncategorised, in the viewer's language.
        name: row.budgetId === null ? '' : row.budgetName,
        archived: row.budgetId !== null && !activeIds.has(row.budgetId),
        thisSen: 0,
        lastSen: 0,
      };
      rows.set(row.budgetId, entry);
    }
    entry[which] += row.totalSen;
  };
  for (const row of thisRows) add(row, 'thisSen');
  for (const row of lastRows) add(row, 'lastSen');

  const thisLength = daysIn(month);
  const lastLength = daysIn(previous);
  const isCurrent = month === monthKey(now);
  const today = Number(dayKey(now).slice(8));
  const thisLine = cumulative(byDay(thisRows), Math.max(thisLength, lastLength), isCurrent ? today : thisLength);
  const lastLine = cumulative(byDay(lastRows), Math.max(thisLength, lastLength), lastLength);
  const daily = thisLine.map((thisSen, i) => ({ day: i + 1, thisSen, lastSen: lastLine[i] }));

  let sameDay: MonthReport['sameDay'] = null;
  if (isCurrent) {
    const day = Math.min(today, lastLength);
    sameDay = { day, thisSen: thisLine[day - 1] ?? 0, lastSen: lastLine[day - 1] ?? 0 };
  }

  const sum = (list: TransactionRow[]) => list.reduce((total, row) => total + row.totalSen, 0);
  return {
    month,
    previous,
    totalSen: sum(thisRows),
    previousTotalSen: sum(lastRows),
    byBudget: [...rows.values()].sort((a, b) => b.thisSen - a.thisSen || a.name.localeCompare(b.name)),
    daily,
    sameDay,
  };
}
