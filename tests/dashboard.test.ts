import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAccount } from '@/lib/auth/accounts';
import type { Viewer } from '@/lib/auth/viewer';
import { archiveBudget, createBudget } from '@/lib/budgets';
import { getDashboard } from '@/lib/dashboard';
import { addPayment, createDebt } from '@/lib/debts';
import { fromLocalDateTime } from '@/lib/time';
import { createTransaction } from '@/lib/transactions';
import { resetDb } from './helpers/db';

let owner: Viewer;
let member: Viewer;
let guest: Viewer;
let groceries: string;
let dining: string;

async function person(username: string, displayName: string, role: Viewer['role']): Promise<Viewer> {
  const a = await createAccount({ username, displayName, password: 'password1', role });
  return { id: a.id, role, displayName };
}

function spend(who: Viewer, merchant: string, totalSen: number, budgetId: string | null, day: string, time = '12:00') {
  return createTransaction(who, {
    merchant,
    occurredAt: fromLocalDateTime(day, time),
    totalSen,
    paymentMethod: 'qr',
    budgetId,
    items: [],
  });
}

beforeEach(async () => {
  // Only Date is faked, so the database and password hashing keep working. Budgets created now
  // get their allocation from November 2026.
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-12T04:00:00Z') });
  await resetDb();
  owner = await person('owner', 'Owner', 'owner');
  member = await person('siti', 'Siti', 'member');
  guest = await person('ali', 'Ali', 'guest');
  groceries = (await createBudget(owner, { name: 'Groceries', allocationSen: 80000 })).id;
  dining = (await createBudget(owner, { name: 'Dining', allocationSen: 20000 })).id;
  await spend(member, 'Tesco', 4000, groceries, '2026-11-03');
  await spend(guest, 'Mamak', 1500, dining, '2026-11-04');
  await spend(owner, 'Parking', 500, null, '2026-11-05');
  await spend(owner, 'Old shop', 9900, groceries, '2026-10-20');
  const debt = await createDebt(owner, { personName: 'Ali', amountSen: 50000, lentOn: '2026-11-01' });
  await addPayment(owner, debt.id, { amountSen: 20000, paidOn: '2026-11-10' });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('what each role receives', () => {
  it('gives a guest budget names, what is left and their own transactions, and nothing else', async () => {
    const g = await getDashboard(guest, '2026-11');
    expect(g.totals).toBeUndefined();
    expect(g.byBudget).toBeUndefined();
    expect(g.debts).toBeUndefined();
    expect(g.recent.every((t) => t.createdById === guest.id)).toBe(true);
    expect(g.recent.map((t) => t.merchant)).toEqual(['Mamak']);
    expect(Object.keys(g.budgets[0]).sort()).toEqual(['id', 'name', 'remainingSen', 'state']);
    for (const budget of g.budgets) expect(Object.keys(budget).sort()).toEqual(['id', 'name', 'remainingSen', 'state']);
    // The whole object, as it would be sent: no other person's spending, no household amounts.
    const sent = JSON.stringify(g);
    for (const hidden of ['Tesco', 'Parking', 'allocationSen', 'spentSen', 'outstandingSen']) {
      expect(sent).not.toContain(hidden);
    }
  });

  it('gives a member the household totals but no debts', async () => {
    const m = await getDashboard(member, '2026-11');
    expect(m.totals).toEqual({ spentSen: 6000, allocatedSen: 100000 });
    expect(m.debts).toBeUndefined();
    expect(m.recent.map((t) => t.merchant)).toEqual(['Parking', 'Mamak', 'Tesco']);
  });

  it('gives the owner the debts summary as well', async () => {
    const o = await getDashboard(owner, '2026-11');
    expect(o.debts?.outstandingSen).toBe(30000);
    expect(o.debts?.people).toEqual([{ name: 'Ali', outstandingSen: 30000 }]);
    expect(o.totals).toEqual({ spentSen: 6000, allocatedSen: 100000 });
  });
});

describe('spending by budget', () => {
  it('lists budgets with spending, largest first, with Uncategorised, and leaves out budgets with none', async () => {
    await createBudget(owner, { name: 'Petrol', allocationSen: 30000 });
    const m = await getDashboard(member, '2026-11');
    expect(m.byBudget).toEqual([
      { name: 'Groceries', spentSen: 4000 },
      { name: 'Dining', spentSen: 1500 },
      { name: 'Uncategorised', spentSen: 500 },
    ]);
    expect(m.totals?.allocatedSen).toBe(130000);
  });

  it('keeps an archived budget spending by name, but not its allocation', async () => {
    await archiveBudget(owner, dining);
    const o = await getDashboard(owner, '2026-11');
    expect(o.budgets.map((b) => b.name)).toEqual(['Groceries']);
    expect(o.byBudget).toContainEqual({ name: 'Dining', spentSen: 1500 });
    expect(o.totals).toEqual({ spentSen: 6000, allocatedSen: 80000 });
  });
});

describe('the month', () => {
  it('covers only the month asked for', async () => {
    const m = await getDashboard(member, '2026-10');
    expect(m.month).toBe('2026-10');
    expect(m.totals?.spentSen).toBe(9900);
    expect(m.byBudget).toEqual([{ name: 'Groceries', spentSen: 9900 }]);
    expect(m.recent.map((t) => t.merchant)).toEqual(['Old shop']);
  });

  it('keeps the latest 8 transactions, newest first', async () => {
    for (let i = 1; i <= 9; i++) {
      await spend(member, `Shop ${i}`, 100, groceries, '2026-11-11', `0${i}:00`);
    }
    const m = await getDashboard(member, '2026-11');
    expect(m.recent).toHaveLength(8);
    expect(m.recent[0].merchant).toBe('Shop 9');
    expect(m.recent[7].merchant).toBe('Shop 2');
    expect(m.totals?.spentSen).toBe(6000 + 900);
  });
});
