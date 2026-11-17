import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAccount } from '@/lib/auth/accounts';
import type { Viewer } from '@/lib/auth/viewer';
import { archiveBudget, createBudget } from '@/lib/budgets';
import { ForbiddenError } from '@/lib/errors';
import { getMonthReport } from '@/lib/reports';
import { fromLocalDateTime } from '@/lib/time';
import { createTransaction } from '@/lib/transactions';
import { resetDb } from './helpers/db';

let owner: Viewer;
let member: Viewer;
let guest: Viewer;
let groceries: string;
let dining: string;
let petrol: string;

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
  // 17 November 2026, noon in Malaysia. Only Date is faked, so the database keeps working.
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-17T04:00:00Z') });
  await resetDb();
  owner = await person('owner', 'Owner', 'owner');
  member = await person('siti', 'Siti', 'member');
  guest = await person('ali', 'Ali', 'guest');
  groceries = (await createBudget(owner, { name: 'Groceries', allocationSen: 80000 })).id;
  dining = (await createBudget(owner, { name: 'Dining', allocationSen: 20000 })).id;
  petrol = (await createBudget(owner, { name: 'Petrol', allocationSen: 30000 })).id;

  // October: 105.00 in all.
  await spend(member, 'Tesco', 3000, groceries, '2026-10-10');
  await spend(member, 'Shell', 6000, petrol, '2026-10-15');
  await spend(owner, 'Sushi', 1000, dining, '2026-10-30');
  await spend(member, 'Mydin', 500, groceries, '2026-10-31');
  // November up to the 17th: 80.00 in all, one of them a guest's.
  await spend(member, 'Giant', 4000, groceries, '2026-11-03');
  await spend(guest, 'Mamak', 1500, dining, '2026-11-04');
  await spend(owner, 'Parking', 500, null, '2026-11-05');
  await spend(member, 'Jaya Grocer', 2000, groceries, '2026-11-17', '10:00');

  await archiveBudget(owner, petrol);
});

afterEach(() => vi.useRealTimers());

describe('getMonthReport', () => {
  it('totals this month and last month, grouped by budget, with Uncategorised and archived budgets', async () => {
    const report = await getMonthReport(member, '2026-11');
    expect(report.month).toBe('2026-11');
    expect(report.previous).toBe('2026-10');
    expect(report.totalSen).toBe(8000);
    expect(report.previousTotalSen).toBe(10500);
    expect(report.byBudget).toEqual([
      { id: groceries, name: 'Groceries', archived: false, thisSen: 6000, lastSen: 3500 },
      { id: dining, name: 'Dining', archived: false, thisSen: 1500, lastSen: 1000 },
      { id: null, name: '', archived: false, thisSen: 500, lastSen: 0 },
      { id: petrol, name: 'Petrol', archived: true, thisSen: 0, lastSen: 6000 },
    ]);
  });

  it("includes a guest's entries in the household figures", async () => {
    const report = await getMonthReport(owner, '2026-11');
    expect(report.byBudget.find((row) => row.id === dining)?.thisSen).toBe(1500);
  });

  it('builds cumulative daily lines and stops this month at today', async () => {
    const { daily } = await getMonthReport(member, '2026-11');
    expect(daily).toHaveLength(31);
    expect(daily[0]).toEqual({ day: 1, thisSen: 0, lastSen: 0 });
    expect(daily[2].thisSen).toBe(4000);
    expect(daily[16]).toEqual({ day: 17, thisSen: 8000, lastSen: 9000 });
    expect(daily[17].thisSen).toBeNull();
    expect(daily[29].lastSen).toBe(10000);
    expect(daily[30]).toEqual({ day: 31, thisSen: null, lastSen: 10500 });
  });

  it('compares to the same day last month', async () => {
    const { sameDay } = await getMonthReport(member, '2026-11');
    expect(sameDay).toEqual({ day: 17, thisSen: 8000, lastSen: 9000 });
  });

  it("caps the same day at last month's length", async () => {
    vi.setSystemTime(new Date('2026-12-31T04:00:00Z'));
    await spend(member, 'Year end', 700, groceries, '2026-12-31');
    const { sameDay, daily } = await getMonthReport(member, '2026-12');
    expect(sameDay).toEqual({ day: 30, thisSen: 0, lastSen: 8000 });
    expect(daily[30]).toEqual({ day: 31, thisSen: 700, lastSen: null });
  });

  it('has no same-day comparison for a past month, and a full line for it', async () => {
    const report = await getMonthReport(member, '2026-10');
    expect(report.sameDay).toBeNull();
    expect(report.daily[30].thisSen).toBe(10500);
    expect(report.previousTotalSen).toBe(0);
  });

  it('refuses a guest', async () => {
    await expect(getMonthReport(guest, '2026-11')).rejects.toThrow(ForbiddenError);
  });
});
