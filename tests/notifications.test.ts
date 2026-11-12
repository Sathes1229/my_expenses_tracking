import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/client';
import { notifications } from '@/db/schema';
import { createAccount } from '@/lib/auth/accounts';
import type { Viewer } from '@/lib/auth/viewer';
import { archiveBudget, createBudget } from '@/lib/budgets';
import { evaluateBudgetAlerts, listNotifications, markAllRead, unreadCount } from '@/lib/notifications';
import { fromLocalDateTime } from '@/lib/time';
import { createTransaction, deleteTransaction, updateTransaction, type TransactionInput } from '@/lib/transactions';
import { resetDb } from './helpers/db';

let owner: Viewer;
let member: Viewer;
let guest: Viewer;
let groceries: string;

async function person(username: string, displayName: string, role: Viewer['role']): Promise<Viewer> {
  const a = await createAccount({ username, displayName, password: 'password1', role });
  return { id: a.id, role, displayName };
}

const tx = (totalSen: number, budgetId: string | null = groceries, day = '2026-11-03'): TransactionInput => ({
  merchant: 'Tesco',
  occurredAt: fromLocalDateTime(day, '12:00'),
  totalSen,
  paymentMethod: 'qr',
  budgetId,
  items: [],
});

beforeEach(async () => {
  await resetDb();
  owner = await person('owner', 'Owner', 'owner');
  member = await person('siti', 'Siti', 'member');
  guest = await person('ali', 'Ali', 'guest');
  // RM 100 allocation, 80% threshold, in the month the tests spend in.
  groceries = (await createBudget(owner, { name: 'Groceries', allocationSen: 10000, thresholdPct: 80 })).id;
});

describe('budget alerts', () => {
  it('alerts once at the threshold, again when over, and never leaks amounts', async () => {
    await createTransaction(owner, tx(7900));
    expect(await listNotifications(owner)).toHaveLength(0);
    await createTransaction(owner, tx(200));
    expect((await listNotifications(owner))[0].text).toBe('Groceries has passed its warning level for November 2026.');
    await createTransaction(owner, tx(100));
    expect(await listNotifications(owner)).toHaveLength(1);
    await createTransaction(owner, tx(2000));
    const all = await listNotifications(owner);
    expect(all).toHaveLength(2);
    expect(all.map((n) => n.text)).toContain('Groceries is over budget for November 2026.');
    expect((await listNotifications(guest)).map((n) => n.text).join(' ')).not.toMatch(/RM|\d+\.\d\d/);
  });

  it('creates both notifications on one jump from under the threshold to over 100%', async () => {
    await createTransaction(owner, tx(12000));
    expect((await listNotifications(owner)).map((n) => n.text).sort()).toEqual([
      'Groceries has passed its warning level for November 2026.',
      'Groceries is over budget for November 2026.',
    ]);
  });

  it('alerts the new budget when a transaction is moved into it', async () => {
    const school = (await createBudget(owner, { name: 'School', allocationSen: 10000 })).id;
    const petrol = (await createBudget(owner, { name: 'Petrol', allocationSen: 10000 })).id;
    const { id } = await createTransaction(owner, tx(1000, petrol));
    await updateTransaction(owner, id, { ...tx(9000, school) });
    expect((await listNotifications(owner)).some((n) => n.text.startsWith('School has passed'))).toBe(true);
  });

  it('evaluates the old budget too when a transaction moves out of it', async () => {
    // Moving a row to another month changes both months; neither may fail or repeat.
    const { id } = await createTransaction(owner, tx(9000));
    expect(await listNotifications(owner)).toHaveLength(1);
    await updateTransaction(owner, id, tx(9000, groceries, '2026-10-20'));
    await deleteTransaction(owner, id);
    expect(await listNotifications(owner)).toHaveLength(1);
  });

  it('skips archived budgets, uncategorised spending and zero allocations', async () => {
    const zero = (await createBudget(owner, { name: 'Zero', allocationSen: 0 })).id;
    const old = (await createBudget(owner, { name: 'Old', allocationSen: 10000 })).id;
    await archiveBudget(owner, old);
    await createTransaction(owner, tx(50000, null));
    await createTransaction(owner, tx(50000, zero));
    await evaluateBudgetAlerts(old, '2026-11');
    await evaluateBudgetAlerts(null, '2026-11');
    expect(db.select().from(notifications).all()).toHaveLength(0);
  });

  it('shows the budget name as it is now', async () => {
    await createTransaction(owner, tx(9000));
    const { updateBudget } = await import('@/lib/budgets');
    await updateBudget(owner, groceries, { name: 'Food' });
    expect((await listNotifications(owner))[0].text).toBe('Food has passed its warning level for November 2026.');
  });
});

describe('read state', () => {
  it('is kept per person', async () => {
    await createTransaction(owner, tx(9000));
    expect(await unreadCount(member)).toBeGreaterThan(0);
    expect((await listNotifications(member))[0].read).toBe(false);
    await markAllRead(member);
    expect(await unreadCount(member)).toBe(0);
    expect((await listNotifications(member))[0].read).toBe(true);
    expect(await unreadCount(owner)).toBeGreaterThan(0);
  });

  it('marks again cleanly when called twice', async () => {
    await createTransaction(owner, tx(9000));
    await markAllRead(member);
    await markAllRead(member);
    expect(await unreadCount(member)).toBe(0);
  });
});
