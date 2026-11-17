import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAccount } from '@/lib/auth/accounts';
import type { Viewer } from '@/lib/auth/viewer';
import { allocationFor, archiveBudget, createBudget, hasAnyBudget, listBudgetNames } from '@/lib/budgets';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { createStarterBudgets } from '@/lib/starter-budgets';
import { resetDb } from './helpers/db';

let owner: Viewer;
let member: Viewer;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-17T04:00:00Z') });
  await resetDb();
  const o = await createAccount({ username: 'owner', displayName: 'Owner', password: 'password1', role: 'owner' });
  const m = await createAccount({ username: 'siti', displayName: 'Siti', password: 'password1', role: 'member' });
  owner = { id: o.id, role: 'owner', displayName: 'Owner' };
  member = { id: m.id, role: 'member', displayName: 'Siti' };
});

afterEach(() => vi.useRealTimers());

describe('createStarterBudgets', () => {
  it('creates each pick as a budget with its allocation from this month, names as typed', async () => {
    await createStarterBudgets(owner, [
      { name: 'Barang dapur', allocationSen: 60000 },
      { name: 'Minyak kereta', allocationSen: 25000 },
    ]);
    const budgets = await listBudgetNames(owner);
    expect(budgets.map((b) => b.name)).toEqual(['Barang dapur', 'Minyak kereta']);
    expect(await allocationFor(budgets[0].id, '2026-11')).toBe(60000);
    expect(await allocationFor(budgets[1].id, '2026-11')).toBe(25000);
  });

  it('creates nothing when one pick breaks a budget rule', async () => {
    await expect(
      createStarterBudgets(owner, [
        { name: 'Groceries', allocationSen: 60000 },
        { name: 'groceries', allocationSen: 10000 },
      ]),
    ).rejects.toThrow(ValidationError);
    expect(await listBudgetNames(owner)).toEqual([]);
  });

  it('refuses a member', async () => {
    await expect(createStarterBudgets(member, [{ name: 'Groceries', allocationSen: 60000 }])).rejects.toThrow(ForbiddenError);
  });

  it('refuses an empty list', async () => {
    await expect(createStarterBudgets(owner, [])).rejects.toThrow(ValidationError);
  });
});

describe('hasAnyBudget', () => {
  it('is false for a new household and stays true once a budget exists, even archived', async () => {
    expect(await hasAnyBudget()).toBe(false);
    const { id } = await createBudget(owner, { name: 'Groceries', allocationSen: 1000 });
    expect(await hasAnyBudget()).toBe(true);
    await archiveBudget(owner, id);
    expect(await hasAnyBudget()).toBe(true);
  });
});
