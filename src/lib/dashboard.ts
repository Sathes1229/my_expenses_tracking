import type { Viewer } from '@/lib/auth/viewer';
import { listBudgetSummaries, type BudgetSummary } from './budgets';
import { debtTotals } from './debts';
import { listTransactions, type TransactionRow } from './transactions';

export type Dashboard = {
  month: string;
  budgets: BudgetSummary[];
  /** The latest 8 transactions in the month that the viewer may see, newest first. */
  recent: TransactionRow[];
  /** Absent for guests. */
  totals?: { spentSen: number; allocatedSen: number };
  /**
   * Absent for guests. Largest first, one entry per budget id; includes Uncategorised (id null) and
   * archived budgets, named "(archived)", when they have spending.
   */
  byBudget?: { id: string | null; name: string; spentSen: number }[];
  /** Owner only. */
  debts?: { outstandingSen: number; people: { name: string; outstandingSen: number }[] };
};

const RECENT = 8;

/**
 * The home page for one month, built only from the reads that already apply each role's
 * visibility: a guest's summaries carry no amounts and their transaction list holds only their
 * own rows, so household figures are never computed for them, let alone sent.
 */
export async function getDashboard(viewer: Viewer, month: string): Promise<Dashboard> {
  const [budgets, rows] = await Promise.all([listBudgetSummaries(viewer, month), listTransactions(viewer, { month })]);
  const dashboard: Dashboard = { month, budgets, recent: rows.slice(0, RECENT) };
  if (viewer.role === 'guest') return dashboard;

  // Every transaction counts, including Uncategorised and budgets archived since; the allocation
  // is only the active budgets', since an archived budget has none for the month. Grouped by id, not
  // name: an archived budget and a new one may share a name, and each bar must match its own budget.
  const active = new Set(budgets.map((b) => b.id));
  const spent = new Map<string | null, { name: string; spentSen: number }>();
  for (const row of rows) {
    const group = spent.get(row.budgetId);
    if (group) {
      group.spentSen += row.totalSen;
    } else {
      const archived = row.budgetId !== null && !active.has(row.budgetId);
      spent.set(row.budgetId, { name: archived ? `${row.budgetName} (archived)` : row.budgetName, spentSen: row.totalSen });
    }
  }
  dashboard.totals = {
    spentSen: rows.reduce((sum, row) => sum + row.totalSen, 0),
    allocatedSen: budgets.reduce((sum, b) => sum + (b.allocationSen ?? 0), 0),
  };
  dashboard.byBudget = [...spent]
    .map(([id, group]) => ({ id, ...group }))
    .sort((a, b) => b.spentSen - a.spentSen || a.name.localeCompare(b.name));

  if (viewer.role === 'owner') dashboard.debts = await debtTotals(viewer);
  return dashboard;
}
