import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/client';
import { debts, transactions } from '@/db/schema';
import { createAccount } from '@/lib/auth/accounts';
import type { Viewer } from '@/lib/auth/viewer';
import { createBudget, spentFor } from '@/lib/budgets';
import {
  addPayment,
  createDebt,
  debtStatus,
  debtTotals,
  deleteDebt,
  deletePayment,
  listDebts,
  updateDebt,
} from '@/lib/debts';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { monthKey } from '@/lib/time';
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

describe('debtStatus', () => {
  it('is unpaid with nothing repaid, partly paid in between, paid once everything is repaid', () => {
    expect(debtStatus(10000, 0)).toBe('unpaid');
    expect(debtStatus(10000, 4000)).toBe('partly paid');
    expect(debtStatus(10000, 10000)).toBe('paid');
  });
});

describe('part payments', () => {
  it('reduces what is outstanding and rejects a payment larger than that', async () => {
    const { id } = await createDebt(owner, { personName: 'Ali', amountSen: 50000, lentOn: '2026-11-01' });
    await addPayment(owner, id, { amountSen: 20000, paidOn: '2026-11-10' });
    expect((await debtTotals(owner)).outstandingSen).toBe(30000);
    await expect(addPayment(owner, id, { amountSen: 30001, paidOn: '2026-11-11' })).rejects.toThrow(ValidationError);
    expect((await debtTotals(owner)).outstandingSen).toBe(30000);
  });

  it('rejects payments of zero, below zero and fractions of a sen', async () => {
    const { id } = await createDebt(owner, { personName: 'Ali', amountSen: 50000, lentOn: '2026-11-01' });
    for (const amountSen of [0, -100, 10.5, Number.NaN]) {
      await expect(addPayment(owner, id, { amountSen, paidOn: '2026-11-10' })).rejects.toThrow(ValidationError);
    }
  });

  it('marks the debt paid when the last sen is repaid, and a deleted payment reopens it', async () => {
    const { id } = await createDebt(owner, { personName: 'Ali', amountSen: 50000, lentOn: '2026-11-01' });
    await addPayment(owner, id, { amountSen: 20000, paidOn: '2026-11-10' });
    await addPayment(owner, id, { amountSen: 30000, paidOn: '2026-11-11' });
    const [group] = await listDebts(owner);
    expect(group.debts[0]).toMatchObject({ repaidSen: 50000, outstandingSen: 0, status: 'paid' });
    expect(group.debts[0].payments.map((p) => p.amountSen)).toEqual([20000, 30000]);
    await deletePayment(owner, group.debts[0].payments[1].id);
    const [again] = await listDebts(owner);
    expect(again.debts[0]).toMatchObject({ repaidSen: 20000, outstandingSen: 30000, status: 'partly paid' });
  });

  it('rejects a payment dated before the loan, too far ahead, or not a real date', async () => {
    at('2026-11-12T04:00:00Z');
    const { id } = await createDebt(owner, { personName: 'Ali', amountSen: 50000, lentOn: '2026-11-01' });
    await expect(addPayment(owner, id, { amountSen: 100, paidOn: '2026-10-31' })).rejects.toThrow(ValidationError);
    await expect(addPayment(owner, id, { amountSen: 100, paidOn: '2026-11-14' })).rejects.toThrow(ValidationError);
    await expect(addPayment(owner, id, { amountSen: 100, paidOn: '2026-02-30' })).rejects.toThrow(ValidationError);
    await expect(addPayment(owner, id, { amountSen: 100, paidOn: '12/11/2026' })).rejects.toThrow(ValidationError);
    await addPayment(owner, id, { amountSen: 100, paidOn: '2026-11-13' });
  });

  it('rejects a payment for a debt that is not there', async () => {
    await expect(addPayment(owner, 'missing', { amountSen: 100, paidOn: '2026-11-10' })).rejects.toThrow(ValidationError);
    await expect(deletePayment(owner, 'missing')).rejects.toThrow(ValidationError);
  });
});

describe('createDebt and updateDebt', () => {
  it('trims the name and note and stores the dates as given', async () => {
    const { id } = await createDebt(owner, {
      personName: '  Ali  ',
      amountSen: 5000,
      lentOn: '2026-11-01',
      dueOn: '2026-12-01',
      note: '  for the car  ',
    });
    const [group] = await listDebts(owner);
    expect(group.personName).toBe('Ali');
    expect(group.debts[0]).toMatchObject({ id, lentOn: '2026-11-01', dueOn: '2026-12-01', note: 'for the car' });
  });

  it('validates name, amount, dates and note', async () => {
    at('2026-11-12T04:00:00Z');
    const ok = { personName: 'Ali', amountSen: 5000, lentOn: '2026-11-01' };
    const bad = [
      { ...ok, personName: '   ' },
      { ...ok, personName: 'x'.repeat(61) },
      { ...ok, amountSen: 0 },
      { ...ok, amountSen: 12.5 },
      { ...ok, lentOn: '2026-13-01' },
      { ...ok, lentOn: '2026-11-14' },
      { ...ok, dueOn: '2026-10-31' },
      { ...ok, dueOn: 'soon' },
      { ...ok, note: 'n'.repeat(501) },
    ];
    for (const input of bad) await expect(createDebt(owner, input)).rejects.toThrow(ValidationError);
    await expect(
      createDebt(owner, { ...ok, personName: 'x'.repeat(60), note: 'n'.repeat(500), dueOn: '2026-11-01' }),
    ).resolves.toBeTruthy();
    // a past loan date is fine
    await expect(createDebt(owner, { ...ok, lentOn: '2025-01-01' })).resolves.toBeTruthy();
  });

  it('cannot lower the amount below what is already repaid', async () => {
    const { id } = await createDebt(owner, { personName: 'Ali', amountSen: 50000, lentOn: '2026-11-01' });
    await addPayment(owner, id, { amountSen: 20000, paidOn: '2026-11-10' });
    const same = { personName: 'Ali', lentOn: '2026-11-01' };
    await expect(updateDebt(owner, id, { ...same, amountSen: 19999 })).rejects.toThrow(ValidationError);
    await updateDebt(owner, id, { ...same, amountSen: 20000, note: 'less' });
    const [group] = await listDebts(owner);
    expect(group.debts[0]).toMatchObject({ amountSen: 20000, status: 'paid', note: 'less' });
  });

  it('cannot move the loan date after an existing payment, and clears an optional field left out', async () => {
    const { id } = await createDebt(owner, {
      personName: 'Ali',
      amountSen: 50000,
      lentOn: '2026-11-01',
      dueOn: '2026-12-01',
      note: 'x',
    });
    await addPayment(owner, id, { amountSen: 100, paidOn: '2026-11-05' });
    await expect(updateDebt(owner, id, { personName: 'Ali', amountSen: 50000, lentOn: '2026-11-06' })).rejects.toThrow(
      ValidationError,
    );
    await updateDebt(owner, id, { personName: 'Ali', amountSen: 50000, lentOn: '2026-11-02' });
    const [group] = await listDebts(owner);
    expect(group.debts[0].dueOn).toBeUndefined();
    expect(group.debts[0].note).toBeUndefined();
  });

  it('rejects updating or deleting a debt that is not there', async () => {
    await expect(updateDebt(owner, 'missing', { personName: 'Ali', amountSen: 1, lentOn: '2026-11-01' })).rejects.toThrow(
      ValidationError,
    );
    await expect(deleteDebt(owner, 'missing')).rejects.toThrow(ValidationError);
  });

  it('deleting a debt removes its payments', async () => {
    const { id } = await createDebt(owner, { personName: 'Ali', amountSen: 50000, lentOn: '2026-11-01' });
    await addPayment(owner, id, { amountSen: 100, paidOn: '2026-11-05' });
    await deleteDebt(owner, id);
    expect(await listDebts(owner)).toEqual([]);
    expect(db.$client.prepare('select count(*) as n from debt_payments').get()).toEqual({ n: 0 });
  });
});

describe('listDebts and debtTotals', () => {
  it('groups by person ignoring case and spacing, names the group as on the newest debt, largest outstanding first', async () => {
    await createDebt(owner, { personName: 'ali', amountSen: 10000, lentOn: '2026-10-01' });
    await createDebt(owner, { personName: ' ALI ', amountSen: 20000, lentOn: '2026-11-01' });
    await createDebt(owner, { personName: 'Bala', amountSen: 50000, lentOn: '2026-09-01' });
    await createDebt(owner, { personName: 'Chong', amountSen: 5000, lentOn: '2026-11-02' });
    const groups = await listDebts(owner);
    expect(groups.map((g) => [g.personName, g.outstandingSen])).toEqual([
      ['Bala', 50000],
      ['ALI', 30000],
      ['Chong', 5000],
    ]);
    expect(await debtTotals(owner)).toEqual({
      outstandingSen: 85000,
      people: [
        { name: 'Bala', outstandingSen: 50000 },
        { name: 'ALI', outstandingSen: 30000 },
        { name: 'Chong', outstandingSen: 5000 },
      ],
    });
  });

  it('puts unpaid and partly paid debts before paid ones, newest first, and keeps paid debts', async () => {
    const paid = await createDebt(owner, { personName: 'Ali', amountSen: 1000, lentOn: '2026-11-10' });
    await addPayment(owner, paid.id, { amountSen: 1000, paidOn: '2026-11-11' });
    const old = await createDebt(owner, { personName: 'Ali', amountSen: 2000, lentOn: '2026-09-01' });
    const recent = await createDebt(owner, { personName: 'Ali', amountSen: 3000, lentOn: '2026-10-01' });
    const [group] = await listDebts(owner);
    expect(group.debts.map((d) => d.id)).toEqual([recent.id, old.id, paid.id]);
    expect(group.outstandingSen).toBe(5000);
    expect((await debtTotals(owner)).outstandingSen).toBe(5000);
  });

  it('leaves people who have repaid everything out of the totals but keeps them in the list', async () => {
    const { id } = await createDebt(owner, { personName: 'Ali', amountSen: 1000, lentOn: '2026-11-01' });
    await addPayment(owner, id, { amountSen: 1000, paidOn: '2026-11-02' });
    expect(await debtTotals(owner)).toEqual({ outstandingSen: 0, people: [] });
    expect(await listDebts(owner)).toHaveLength(1);
  });

  it('is empty when there are no debts', async () => {
    expect(await listDebts(owner)).toEqual([]);
    expect(await debtTotals(owner)).toEqual({ outstandingSen: 0, people: [] });
  });
});

describe('who may use debts', () => {
  it('throws ForbiddenError for members and guests on every function, and changes nothing', async () => {
    const { id } = await createDebt(owner, { personName: 'Ali', amountSen: 50000, lentOn: '2026-11-01' });
    await addPayment(owner, id, { amountSen: 100, paidOn: '2026-11-02' });
    const [group] = await listDebts(owner);
    const paymentId = group.debts[0].payments[0].id;
    const input = { personName: 'Zed', amountSen: 1, lentOn: '2026-11-01' };
    for (const viewer of [member, guest]) {
      await expect(listDebts(viewer)).rejects.toThrow(ForbiddenError);
      await expect(debtTotals(viewer)).rejects.toThrow(ForbiddenError);
      await expect(createDebt(viewer, input)).rejects.toThrow(ForbiddenError);
      await expect(updateDebt(viewer, id, input)).rejects.toThrow(ForbiddenError);
      await expect(deleteDebt(viewer, id)).rejects.toThrow(ForbiddenError);
      await expect(addPayment(viewer, id, { amountSen: 1, paidOn: '2026-11-02' })).rejects.toThrow(ForbiddenError);
      await expect(deletePayment(viewer, paymentId)).rejects.toThrow(ForbiddenError);
    }
    expect(db.select().from(debts).all()).toHaveLength(1);
    expect((await listDebts(owner))[0].debts[0].repaidSen).toBe(100);
  });
});

describe('debts are not spending', () => {
  it('creating, paying and deleting debts never changes a budget spent amount', async () => {
    const { id: budgetId } = await createBudget(owner, { name: 'Groceries', allocationSen: 80000 });
    db.insert(transactions)
      .values({ merchant: 'Shop', occurredAt: Date.now(), totalSen: 4500, paymentMethod: 'cash', createdBy: member.id, budgetId })
      .run();
    const month = monthKey(new Date());
    const spent = async () => [await spentFor(budgetId, month), await spentFor(null, month)];
    const before = await spent();
    expect(before).toEqual([4500, 0]);

    const { id } = await createDebt(owner, { personName: 'Ali', amountSen: 50000, lentOn: '2026-11-01' });
    expect(await spent()).toEqual(before);
    await addPayment(owner, id, { amountSen: 20000, paidOn: '2026-11-10' });
    expect(await spent()).toEqual(before);
    await deleteDebt(owner, id);
    expect(await spent()).toEqual(before);
    expect(db.select().from(transactions).all()).toHaveLength(1);
  });
});
