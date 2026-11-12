import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { budgetAllocations, budgets, transactions } from '@/db/schema';
import { createAccount } from '@/lib/auth/accounts';
import type { Viewer } from '@/lib/auth/viewer';
import {
  allocationFor,
  archiveBudget,
  budgetState,
  createBudget,
  listBudgetNames,
  listBudgetSummaries,
  spentFor,
  updateBudget,
} from '@/lib/budgets';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { fromLocalDateTime } from '@/lib/time';
import { resetDb } from './helpers/db';

let owner: Viewer;
let member: Viewer;
let guest: Viewer;

beforeEach(async () => {
  await resetDb();
  const o = await createAccount({ username: 'owner', displayName: 'Owner', password: 'password1', role: 'owner' });
  const m = await createAccount({ username: 'siti', displayName: 'Siti', password: 'password1', role: 'member' });
  const g = await createAccount({ username: 'ali', displayName: 'Ali', password: 'password1', role: 'guest' });
  owner = { id: o.id, role: 'owner', displayName: 'Owner' };
  member = { id: m.id, role: 'member', displayName: 'Siti' };
  guest = { id: g.id, role: 'guest', displayName: 'Ali' };
});

afterEach(() => {
  vi.useRealTimers();
});

// Only Date is faked, so the database and password hashing keep working.
const at = (iso: string) => vi.useFakeTimers({ toFake: ['Date'], now: new Date(iso) });

function spend(budgetId: string | null, totalSen: number, when: Date) {
  db.insert(transactions)
    .values({ merchant: 'Shop', occurredAt: when.getTime(), totalSen, paymentMethod: 'cash', createdBy: member.id, budgetId })
    .run();
}

describe('budgetState', () => {
  it('is fine below the threshold, tight from it, over past the allocation', () => {
    expect(budgetState(7999, 10000, 80)).toBe('fine');
    expect(budgetState(8000, 10000, 80)).toBe('tight');
    expect(budgetState(10000, 10000, 80)).toBe('tight');
    expect(budgetState(10001, 10000, 80)).toBe('over');
  });

  it('treats any spending against a zero allocation as over, and no spending as fine', () => {
    expect(budgetState(1, 0, 80)).toBe('over');
    expect(budgetState(0, 0, 80)).toBe('fine');
  });
});

describe('allocation history', () => {
  it('keeps earlier months at their old value when the allocation changes', async () => {
    at('2026-10-15T04:00:00Z');
    const { id } = await createBudget(owner, { name: 'Groceries', allocationSen: 80000 });
    at('2026-11-15T04:00:00Z');
    await updateBudget(owner, id, { allocationSen: 100000 });

    expect(await allocationFor(id, '2026-09')).toBe(0);
    expect(await allocationFor(id, '2026-10')).toBe(80000);
    expect(await allocationFor(id, '2026-11')).toBe(100000);
    expect(await allocationFor(id, '2027-03')).toBe(100000);
  });

  it('replaces the allocation when changed twice in the same month', async () => {
    at('2026-11-02T04:00:00Z');
    const { id } = await createBudget(owner, { name: 'Groceries', allocationSen: 80000 });
    await updateBudget(owner, id, { allocationSen: 90000 });
    expect(await allocationFor(id, '2026-11')).toBe(90000);
    expect(db.select().from(budgetAllocations).where(eq(budgetAllocations.budgetId, id)).all()).toHaveLength(1);
  });

  it('does not write an allocation when only the name or threshold changes', async () => {
    at('2026-10-15T04:00:00Z');
    const { id } = await createBudget(owner, { name: 'Groceries', allocationSen: 80000 });
    at('2026-11-15T04:00:00Z');
    await updateBudget(owner, id, { name: 'Food', thresholdPct: 90 });
    expect(await allocationFor(id, '2026-11')).toBe(80000);
    expect(db.select().from(budgetAllocations).where(eq(budgetAllocations.budgetId, id)).all()).toHaveLength(1);
    expect(db.select().from(budgets).where(eq(budgets.id, id)).get()).toMatchObject({ name: 'Food', thresholdPct: 90 });
  });
});

describe('spentFor', () => {
  it('sums one budget for one Malaysian month, and null means Uncategorised', async () => {
    at('2026-11-15T04:00:00Z');
    const { id } = await createBudget(owner, { name: 'Groceries', allocationSen: 80000 });
    const { id: other } = await createBudget(owner, { name: 'Transport', allocationSen: 10000 });
    spend(id, 1000, fromLocalDateTime('2026-11-01', '00:00')); // first instant of November
    spend(id, 2000, fromLocalDateTime('2026-11-30', '23:59'));
    spend(id, 4000, fromLocalDateTime('2026-12-01', '00:00')); // next month
    spend(id, 8000, fromLocalDateTime('2026-10-31', '23:59')); // previous month
    spend(other, 500, fromLocalDateTime('2026-11-10', '12:00'));
    spend(null, 700, fromLocalDateTime('2026-11-10', '12:00'));

    expect(await spentFor(id, '2026-11')).toBe(3000);
    expect(await spentFor(other, '2026-11')).toBe(500);
    expect(await spentFor(null, '2026-11')).toBe(700);
    expect(await spentFor(id, '2027-01')).toBe(0);
  });
});

describe('listBudgetSummaries', () => {
  it('gives guests only id, name, remaining and state', async () => {
    at('2026-11-15T04:00:00Z');
    const { id } = await createBudget(owner, { name: 'Groceries', allocationSen: 80000 });
    await updateBudget(owner, id, { allocationSen: 100000 });

    const g = (await listBudgetSummaries(guest, '2026-11'))[0];
    expect(g).toEqual({ id, name: 'Groceries', remainingSen: 100000, state: 'fine' });
    expect(Object.keys(g).sort()).toEqual(['id', 'name', 'remainingSen', 'state']);

    const m = (await listBudgetSummaries(member, '2026-11'))[0];
    expect(m.allocationSen).toBe(100000);
    expect(m).toEqual({ id, name: 'Groceries', remainingSen: 100000, state: 'fine', allocationSen: 100000, spentSen: 0, thresholdPct: 80 });
  });

  it('reports remaining as allocation minus spent, negative when over, with the state to match', async () => {
    at('2026-11-15T04:00:00Z');
    const { id } = await createBudget(owner, { name: 'Groceries', allocationSen: 10000 });
    spend(id, 8000, new Date());
    expect((await listBudgetSummaries(owner, '2026-11'))[0]).toMatchObject({ remainingSen: 2000, state: 'tight', spentSen: 8000 });
    spend(id, 3000, new Date());
    expect((await listBudgetSummaries(guest, '2026-11'))[0]).toEqual({ id, name: 'Groceries', remainingSen: -1000, state: 'over' });
  });

  it('leaves archived budgets out', async () => {
    const { id } = await createBudget(owner, { name: 'Groceries', allocationSen: 10000 });
    await createBudget(owner, { name: 'Transport', allocationSen: 10000 });
    await archiveBudget(owner, id);
    expect((await listBudgetSummaries(owner, '2026-11')).map((b) => b.name)).toEqual(['Transport']);
  });
});

describe('listBudgetNames', () => {
  it('lists active budgets for every role', async () => {
    const { id } = await createBudget(owner, { name: 'Groceries', allocationSen: 10000 });
    const { id: gone } = await createBudget(owner, { name: 'Old', allocationSen: 10000 });
    await archiveBudget(owner, gone);
    for (const viewer of [owner, member, guest]) {
      expect(await listBudgetNames(viewer)).toEqual([{ id, name: 'Groceries' }]);
    }
  });
});

describe('rules', () => {
  it('only the owner writes', async () => {
    at('2026-11-15T04:00:00Z');
    const { id } = await createBudget(owner, { name: 'Groceries', allocationSen: 10000 });
    for (const viewer of [member, guest]) {
      await expect(createBudget(viewer, { name: 'X', allocationSen: 1 })).rejects.toThrow(ForbiddenError);
      await expect(updateBudget(viewer, id, { allocationSen: 1 })).rejects.toThrow(ForbiddenError);
      await expect(archiveBudget(viewer, id)).rejects.toThrow(ForbiddenError);
    }
    expect(db.select().from(budgets).all()).toHaveLength(1);
    expect(await allocationFor(id, '2026-11')).toBe(10000);
  });

  it('needs a name, unique among active budgets without regard to case', async () => {
    await createBudget(owner, { name: 'Groceries', allocationSen: 1 });
    await expect(createBudget(owner, { name: 'groceries', allocationSen: 1 })).rejects.toThrow(ValidationError);
    await expect(createBudget(owner, { name: '  ', allocationSen: 1 })).rejects.toThrow(ValidationError);
    const { id } = await createBudget(owner, { name: 'Transport', allocationSen: 1 });
    await expect(updateBudget(owner, id, { name: 'GROCERIES' })).rejects.toThrow(ValidationError);
    await updateBudget(owner, id, { name: 'transport' }); // its own name in another case is fine
  });

  it('frees the name when a budget is archived', async () => {
    const { id } = await createBudget(owner, { name: 'Groceries', allocationSen: 1 });
    await archiveBudget(owner, id);
    await createBudget(owner, { name: 'Groceries', allocationSen: 1 });
  });

  it('checks allocation and threshold ranges', async () => {
    await expect(createBudget(owner, { name: 'A', allocationSen: -1 })).rejects.toThrow(ValidationError);
    await expect(createBudget(owner, { name: 'A', allocationSen: 1.5 })).rejects.toThrow(ValidationError);
    await expect(createBudget(owner, { name: 'A', allocationSen: 1, thresholdPct: 0 })).rejects.toThrow(ValidationError);
    await expect(createBudget(owner, { name: 'A', allocationSen: 1, thresholdPct: 101 })).rejects.toThrow(ValidationError);
    await createBudget(owner, { name: 'Zero', allocationSen: 0, thresholdPct: 100 });
  });

  it('refuses to change or archive a budget that is archived or unknown', async () => {
    const { id } = await createBudget(owner, { name: 'Groceries', allocationSen: 1 });
    await archiveBudget(owner, id);
    await expect(updateBudget(owner, id, { allocationSen: 5 })).rejects.toThrow(ValidationError);
    await expect(archiveBudget(owner, id)).rejects.toThrow(ValidationError);
    await expect(archiveBudget(owner, 'nope')).rejects.toThrow(ValidationError);
  });

  it('keeps past transactions on an archived budget', async () => {
    const { id } = await createBudget(owner, { name: 'Groceries', allocationSen: 1 });
    spend(id, 500, new Date());
    await archiveBudget(owner, id);
    expect(db.select().from(transactions).where(eq(transactions.budgetId, id)).all()).toHaveLength(1);
  });
});
