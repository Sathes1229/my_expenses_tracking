import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { receiptUploads, transactionItems, user } from '@/db/schema';
import { createAccount } from '@/lib/auth/accounts';
import type { Viewer } from '@/lib/auth/viewer';
import { archiveBudget, createBudget, spentFor } from '@/lib/budgets';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { fromLocalDateTime } from '@/lib/time';
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  updateTransaction,
  type TransactionInput,
} from '@/lib/transactions';
import { resetDb } from './helpers/db';

let owner: Viewer;
let member: Viewer;
let member2: Viewer;
let guest: Viewer;
let guest2: Viewer;
let groceries: string;
let dining: string;
let input: TransactionInput;

const d = (day: string) => fromLocalDateTime(day, '12:00');

async function person(username: string, displayName: string, role: Viewer['role']): Promise<Viewer> {
  const a = await createAccount({ username, displayName, password: 'password1', role });
  return { id: a.id, role, displayName };
}

beforeEach(async () => {
  await resetDb();
  owner = await person('owner', 'Owner', 'owner');
  member = await person('siti', 'Siti', 'member');
  member2 = await person('lee', 'Lee', 'member');
  guest = await person('ali', 'Ali', 'guest');
  guest2 = await person('bob', 'Bob', 'guest');
  groceries = (await createBudget(owner, { name: 'Groceries', allocationSen: 80000 })).id;
  dining = (await createBudget(owner, { name: 'Dining', allocationSen: 30000 })).id;
  input = {
    merchant: 'Tesco',
    occurredAt: d('2026-11-03'),
    totalSen: 4550,
    paymentMethod: 'qr',
    budgetId: groceries,
    items: [],
  };
});

afterEach(() => {
  vi.useRealTimers();
});

describe('visibility', () => {
  it('hides other people rows from guests, in the list and by id', async () => {
    const { id } = await createTransaction(member, input);
    expect(await getTransaction(guest, id)).toBeNull();
    expect(await listTransactions(guest, { month: '2026-11' })).toHaveLength(0);
    expect(await getTransaction(member2, id)).not.toBeNull();
  });

  it('shows a guest their own rows only, and ignores personId for them', async () => {
    await createTransaction(member, input);
    const mine = await createTransaction(guest, { ...input, merchant: 'Mine' });
    await createTransaction(guest2, { ...input, merchant: 'Theirs' });
    const rows = await listTransactions(guest, { month: '2026-11', personId: member.id });
    expect(rows.map((r) => r.id)).toEqual([mine.id]);
  });

  it('lets members see everything but edit only their own', async () => {
    const { id } = await createTransaction(member, input);
    const rows = await listTransactions(member2, { month: '2026-11' });
    expect(rows).toHaveLength(1);
    expect(rows[0].canEdit).toBe(false);
    expect((await listTransactions(member, { month: '2026-11' }))[0].canEdit).toBe(true);
    expect((await listTransactions(owner, { month: '2026-11' }))[0].canEdit).toBe(true);
    expect((await getTransaction(member2, id))?.canEdit).toBe(false);
  });
});

describe('edit and delete rights', () => {
  it('refuses other people rows for members, allows the owner', async () => {
    const { id } = await createTransaction(member, input);
    await expect(updateTransaction(member2, id, input)).rejects.toThrow(ForbiddenError);
    await expect(deleteTransaction(member2, id)).rejects.toThrow(ForbiddenError);
    await updateTransaction(owner, id, { ...input, totalSen: 5000 });
    expect((await getTransaction(owner, id))?.totalSen).toBe(5000);
    await updateTransaction(member, id, { ...input, totalSen: 5100 });
    await deleteTransaction(owner, id);
    expect(await getTransaction(owner, id)).toBeNull();
  });

  it('refuses a guest on a row that is not theirs', async () => {
    const { id } = await createTransaction(member, input);
    await expect(updateTransaction(guest, id, input)).rejects.toThrow(ForbiddenError);
    await expect(deleteTransaction(guest, id)).rejects.toThrow(ForbiddenError);
  });

  it('lets a guest edit and delete their own', async () => {
    const { id } = await createTransaction(guest, input);
    await updateTransaction(guest, id, { ...input, merchant: 'Giant' });
    expect((await getTransaction(guest, id))?.merchant).toBe('Giant');
    await deleteTransaction(guest, id);
    expect(await getTransaction(guest, id)).toBeNull();
  });
});

describe('budgets and months', () => {
  it('counts a guest entry against the household budget', async () => {
    await createTransaction(member, { ...input, totalSen: 5000 });
    await createTransaction(guest, { ...input, totalSen: 1000, budgetId: groceries });
    expect(await spentFor(groceries, '2026-11')).toBe(6000);
  });

  it('puts 00:30 on 1 November Malaysia time in November', async () => {
    await createTransaction(owner, { ...input, occurredAt: new Date('2026-10-31T16:30:00Z') });
    expect(await listTransactions(owner, { month: '2026-10' })).toHaveLength(0);
    expect(await listTransactions(owner, { month: '2026-11' })).toHaveLength(1);
  });

  it('files under Uncategorised when the budget is null', async () => {
    const { id } = await createTransaction(owner, { ...input, budgetId: null });
    expect((await getTransaction(owner, id))?.budgetName).toBe('Uncategorised');
    expect(await spentFor(null, '2026-11')).toBe(4550);
  });

  it('keeps an archived budget on update, but refuses to move to one', async () => {
    const { id } = await createTransaction(owner, input);
    await archiveBudget(owner, groceries);
    await updateTransaction(owner, id, { ...input, totalSen: 6000 });
    expect((await getTransaction(owner, id))?.budgetName).toBe('Groceries');
    await archiveBudget(owner, dining);
    await expect(updateTransaction(owner, id, { ...input, budgetId: dining })).rejects.toThrow(ValidationError);
    await expect(createTransaction(owner, input)).rejects.toThrow(ValidationError);
  });
});

describe('validation', () => {
  it('rejects bad input', async () => {
    await expect(createTransaction(owner, { ...input, totalSen: 0 })).rejects.toThrow(ValidationError);
    await expect(createTransaction(owner, { ...input, totalSen: 10.5 })).rejects.toThrow(ValidationError);
    await expect(createTransaction(owner, { ...input, merchant: '   ' })).rejects.toThrow(ValidationError);
    await expect(createTransaction(owner, { ...input, budgetId: 'nope' })).rejects.toThrow(ValidationError);
    await expect(
      createTransaction(owner, { ...input, items: [{ name: 'Milk', quantity: 0, unitPriceSen: 100, lineTotalSen: 0 }] }),
    ).rejects.toThrow(ValidationError);
    await expect(
      createTransaction(owner, { ...input, items: [{ name: '', quantity: 1, unitPriceSen: 100, lineTotalSen: 100 }] }),
    ).rejects.toThrow(ValidationError);
  });

  it('allows up to a day ahead, not more', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-12T00:00:00Z') });
    await createTransaction(owner, { ...input, occurredAt: new Date('2026-11-12T23:00:00Z') });
    await expect(
      createTransaction(owner, { ...input, occurredAt: new Date('2026-11-13T01:00:00Z') }),
    ).rejects.toThrow(ValidationError);
  });
});

describe('items', () => {
  it('stores items in order and reads them back', async () => {
    const { id } = await createTransaction(owner, {
      ...input,
      items: [
        { name: 'Milk', quantity: 2, unitPriceSen: 650, lineTotalSen: 1300 },
        { name: 'Rice', quantity: 0.5, unitPriceSen: 2000, lineTotalSen: 1000 },
      ],
    });
    const got = await getTransaction(owner, id);
    expect(got?.items.map((i) => i.name)).toEqual(['Milk', 'Rice']);
    expect(got?.items[1]).toMatchObject({ quantity: 0.5, lineTotalSen: 1000 });
  });

  it('rounds a missing line total to the nearest sen and replaces items on update', async () => {
    const { id } = await createTransaction(owner, {
      ...input,
      items: [{ name: 'Nuts', quantity: 0.333, unitPriceSen: 1000, lineTotalSen: Number.NaN }],
    });
    expect((await getTransaction(owner, id))?.items[0].lineTotalSen).toBe(333);
    await updateTransaction(owner, id, { ...input, items: [] });
    expect(db.select().from(transactionItems).where(eq(transactionItems.transactionId, id)).all()).toHaveLength(0);
  });
});

describe('who made it', () => {
  it('shows the creator name, even after they are removed', async () => {
    const { id } = await createTransaction(member, input);
    db.update(user).set({ removedAt: new Date() }).where(eq(user.id, member.id)).run();
    const got = await getTransaction(owner, id);
    expect(got?.createdByName).toBe('Siti');
    expect(got?.createdById).toBe(member.id);
  });
});

describe('filters', () => {
  it('narrows by payment method, budget (null is Uncategorised) and person', async () => {
    await createTransaction(member, input);
    await createTransaction(owner, { ...input, merchant: 'Mamak', paymentMethod: 'cash', budgetId: dining });
    await createTransaction(guest, { ...input, merchant: 'Stall', paymentMethod: 'cash', budgetId: null });
    const names = async (f: Parameters<typeof listTransactions>[1]) =>
      (await listTransactions(owner, f)).map((r) => r.merchant).sort();
    expect(await names({ month: '2026-11' })).toEqual(['Mamak', 'Stall', 'Tesco']);
    expect(await names({ month: '2026-11', paymentMethod: 'cash' })).toEqual(['Mamak', 'Stall']);
    expect(await names({ month: '2026-11', budgetId: dining })).toEqual(['Mamak']);
    expect(await names({ month: '2026-11', budgetId: null })).toEqual(['Stall']);
    expect(await names({ month: '2026-11', personId: member.id })).toEqual(['Tesco']);
  });

  it('lists newest first', async () => {
    await createTransaction(owner, { ...input, merchant: 'Old', occurredAt: d('2026-11-01') });
    await createTransaction(owner, { ...input, merchant: 'New', occurredAt: d('2026-11-09') });
    expect((await listTransactions(owner, { month: '2026-11' })).map((r) => r.merchant)).toEqual(['New', 'Old']);
  });
});

describe('receipts', () => {
  it('links a receipt the person uploaded, and not one from another person', async () => {
    const mine = db.insert(receiptUploads).values({ path: 'a.jpg', uploadedBy: member.id }).returning({ id: receiptUploads.id }).get();
    const theirs = db.insert(receiptUploads).values({ path: 'b.jpg', uploadedBy: owner.id }).returning({ id: receiptUploads.id }).get();
    const a = await createTransaction(member, { ...input, receiptUploadId: mine.id });
    const b = await createTransaction(member, { ...input, receiptUploadId: theirs.id });
    expect((await getTransaction(member, a.id))?.hasReceipt).toBe(true);
    expect((await getTransaction(member, a.id))?.receiptUploadId).toBe(mine.id);
    expect((await getTransaction(member, b.id))?.hasReceipt).toBe(false);
  });
});
