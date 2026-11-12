import { and, asc, desc, eq, gte, isNull, lt, lte, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { budgetAllocations, budgets, transactions } from '@/db/schema';
import { assertOwner, type Viewer } from '@/lib/auth/viewer';
import { ValidationError } from '@/lib/errors';
import { budgetState, type BudgetState } from './budget-state';
import { monthKey, monthRange } from './time';

export { budgetState, type BudgetState };

/**
 * One budget for one month. Guests get only the first four keys: the three optional ones are
 * left out of the object on the server, not hidden by the page.
 */
export type BudgetSummary = {
  id: string;
  name: string;
  remainingSen: number;
  state: BudgetState;
  allocationSen?: number;
  spentSen?: number;
  thresholdPct?: number;
};

const NAME_MAX = 60;
const DEFAULT_THRESHOLD = 80;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function checkName(tx: Tx, raw: string, exceptId?: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) throw new ValidationError('name', 'Enter a name for the budget.');
  if (name.length > NAME_MAX) throw new ValidationError('name', `Use ${NAME_MAX} characters or fewer.`);
  const clash = tx
    .select({ id: budgets.id })
    .from(budgets)
    .where(and(isNull(budgets.archivedAt), sql`lower(${budgets.name}) = lower(${name})`))
    .all()
    .some((row) => row.id !== exceptId);
  if (clash) throw new ValidationError('name', 'Another budget already has that name.');
  return name;
}

function checkAllocation(sen: number): number {
  if (!Number.isSafeInteger(sen) || sen < 0) {
    throw new ValidationError('allocation', 'Enter an amount of RM 0.00 or more.');
  }
  return sen;
}

function checkThreshold(pct: number): number {
  if (!Number.isInteger(pct) || pct < 1 || pct > 100) {
    throw new ValidationError('threshold', 'Enter a whole number from 1 to 100.');
  }
  return pct;
}

function activeBudget(tx: Tx, id: string) {
  const row = tx.select().from(budgets).where(eq(budgets.id, id)).get();
  if (!row || row.archivedAt !== null) throw new ValidationError('budget', 'That budget is not in the app any more.');
  return row;
}

/** From this month on, the budget has this allocation. Earlier months keep theirs. */
function setAllocation(tx: Tx, budgetId: string, allocationSen: number) {
  tx.insert(budgetAllocations)
    .values({ budgetId, fromMonth: monthKey(new Date()), allocationSen })
    .onConflictDoUpdate({
      target: [budgetAllocations.budgetId, budgetAllocations.fromMonth],
      set: { allocationSen },
    })
    .run();
}

export async function createBudget(
  owner: Viewer,
  input: { name: string; allocationSen: number; thresholdPct?: number },
): Promise<{ id: string }> {
  assertOwner(owner);
  return db.transaction((tx) => {
    const name = checkName(tx, input.name);
    const allocationSen = checkAllocation(input.allocationSen);
    const thresholdPct = checkThreshold(input.thresholdPct ?? DEFAULT_THRESHOLD);
    const { id } = tx.insert(budgets).values({ name, thresholdPct }).returning({ id: budgets.id }).get();
    setAllocation(tx, id, allocationSen);
    return { id };
  });
}

export async function updateBudget(
  owner: Viewer,
  id: string,
  changes: { name?: string; allocationSen?: number; thresholdPct?: number },
): Promise<void> {
  assertOwner(owner);
  db.transaction((tx) => {
    activeBudget(tx, id);
    const patch: { name?: string; thresholdPct?: number } = {};
    if (changes.name !== undefined) patch.name = checkName(tx, changes.name, id);
    if (changes.thresholdPct !== undefined) patch.thresholdPct = checkThreshold(changes.thresholdPct);
    const allocationSen = changes.allocationSen === undefined ? undefined : checkAllocation(changes.allocationSen);
    if (Object.keys(patch).length > 0) tx.update(budgets).set(patch).where(eq(budgets.id, id)).run();
    if (allocationSen !== undefined) setAllocation(tx, id, allocationSen);
  });
}

/** A soft delete: past transactions keep pointing at the budget, but it leaves pickers and the current month. */
export async function archiveBudget(owner: Viewer, id: string): Promise<void> {
  assertOwner(owner);
  db.transaction((tx) => {
    activeBudget(tx, id);
    tx.update(budgets).set({ archivedAt: Date.now() }).where(eq(budgets.id, id)).run();
  });
}

/** The allocation in force for a month: the latest change made in that month or before it. */
export async function allocationFor(budgetId: string, month: string): Promise<number> {
  const row = db
    .select({ allocationSen: budgetAllocations.allocationSen })
    .from(budgetAllocations)
    .where(and(eq(budgetAllocations.budgetId, budgetId), lte(budgetAllocations.fromMonth, month)))
    .orderBy(desc(budgetAllocations.fromMonth))
    .limit(1)
    .get();
  return row?.allocationSen ?? 0;
}

/** Total spent in a month. `null` is Uncategorised. */
export async function spentFor(budgetId: string | null, month: string): Promise<number> {
  const { start, end } = monthRange(month);
  const row = db
    .select({ total: sql<number>`coalesce(sum(${transactions.totalSen}), 0)` })
    .from(transactions)
    .where(
      and(
        budgetId === null ? isNull(transactions.budgetId) : eq(transactions.budgetId, budgetId),
        gte(transactions.occurredAt, start.getTime()),
        lt(transactions.occurredAt, end.getTime()),
      ),
    )
    .get();
  return row?.total ?? 0;
}

function activeBudgets() {
  return db
    .select({ id: budgets.id, name: budgets.name, thresholdPct: budgets.thresholdPct })
    .from(budgets)
    .where(isNull(budgets.archivedAt))
    .orderBy(asc(budgets.createdAt), asc(budgets.name))
    .all();
}

/** Active budgets for a month. Owners and members see the amounts; guests only what is left and the state. */
export async function listBudgetSummaries(viewer: Viewer, month: string): Promise<BudgetSummary[]> {
  return Promise.all(
    activeBudgets().map(async (b): Promise<BudgetSummary> => {
      const [allocationSen, spentSen] = await Promise.all([allocationFor(b.id, month), spentFor(b.id, month)]);
      const base = {
        id: b.id,
        name: b.name,
        remainingSen: allocationSen - spentSen,
        state: budgetState(spentSen, allocationSen, b.thresholdPct),
      };
      if (viewer.role === 'guest') return base;
      return { ...base, allocationSen, spentSen, thresholdPct: b.thresholdPct };
    }),
  );
}

/** Active budgets for a picker. Every role may see names, so the viewer is only taken to keep the call shape of the other reads. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function listBudgetNames(_viewer: Viewer): Promise<{ id: string; name: string }[]> {
  return activeBudgets().map(({ id, name }) => ({ id, name }));
}
