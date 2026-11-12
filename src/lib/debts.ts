import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { debtPayments, debts } from '@/db/schema';
import { assertOwner, type Viewer } from '@/lib/auth/viewer';
import { ValidationError } from '@/lib/errors';
import { dayKey } from './time';

// Debts are the owner's private record. Every function starts with assertOwner, so a member or a
// guest gets a ForbiddenError before any row is read. Amounts are whole sen; dates are
// YYYY-MM-DD strings on the Malaysia calendar. Debts never touch transactions or budgets.

export type DebtStatus = 'unpaid' | 'partly paid' | 'paid';

export type DebtInput = { personName: string; amountSen: number; lentOn: string; dueOn?: string; note?: string };

export type DebtPayment = { id: string; amountSen: number; paidOn: string };

export type DebtEntry = {
  id: string;
  amountSen: number;
  repaidSen: number;
  outstandingSen: number;
  status: DebtStatus;
  lentOn: string;
  dueOn?: string;
  note?: string;
  payments: DebtPayment[];
};

export type DebtGroup = { personName: string; outstandingSen: number; debts: DebtEntry[] };

const NAME_MAX = 60;
const NOTE_MAX = 500;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function debtStatus(amountSen: number, repaidSen: number): DebtStatus {
  if (repaidSen <= 0) return 'unpaid';
  return repaidSen >= amountSen ? 'paid' : 'partly paid';
}

function checkName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) throw new ValidationError('personName', 'Enter who you lent the money to.');
  if (name.length > NAME_MAX) throw new ValidationError('personName', `Use ${NAME_MAX} characters or fewer.`);
  return name;
}

function checkAmount(field: string, sen: number): number {
  if (!Number.isSafeInteger(sen) || sen <= 0) throw new ValidationError(field, 'Enter an amount above RM 0.00.');
  return sen;
}

function checkNote(raw: string | undefined): string | null {
  const note = raw?.trim() ?? '';
  if (note.length > NOTE_MAX) throw new ValidationError('note', `Use ${NOTE_MAX} characters or fewer.`);
  return note || null;
}

/** A real calendar date written YYYY-MM-DD. */
function checkDate(field: string, value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const [, y, m, d] = match.map(Number);
    const parsed = new Date(Date.UTC(y, m - 1, d));
    if (y >= 1 && parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d) {
      return value;
    }
  }
  throw new ValidationError(field, 'Enter a real date.');
}

/** A date that has happened or is at most one day ahead (Malaysia time), so a clock a little off still works. */
function checkNotAhead(field: string, value: string): string {
  checkDate(field, value);
  const limit = dayKey(new Date(Date.now() + 24 * 60 * 60 * 1000));
  if (value > limit) throw new ValidationError(field, 'Choose today or an earlier date.');
  return value;
}

function checkDebtFields(input: DebtInput) {
  const personName = checkName(input.personName);
  const amountSen = checkAmount('amount', input.amountSen);
  const lentOn = checkNotAhead('lentOn', input.lentOn);
  const dueOn = input.dueOn ? checkDate('dueOn', input.dueOn) : null;
  if (dueOn && dueOn < lentOn) throw new ValidationError('dueOn', 'The due date cannot be before the day you lent it.');
  return { personName, amountSen, lentOn, dueOn, note: checkNote(input.note) };
}

function repaidFor(tx: Tx, debtId: string): number {
  const row = tx
    .select({ total: sql<number>`coalesce(sum(${debtPayments.amountSen}), 0)` })
    .from(debtPayments)
    .where(eq(debtPayments.debtId, debtId))
    .get();
  return row?.total ?? 0;
}

function existingDebt(tx: Tx, id: string) {
  const row = tx.select().from(debts).where(eq(debts.id, id)).get();
  if (!row) throw new ValidationError('debt', 'That debt is not in the app any more.');
  return row;
}

export async function createDebt(owner: Viewer, input: DebtInput): Promise<{ id: string }> {
  assertOwner(owner);
  const values = checkDebtFields(input);
  return db.transaction((tx) => tx.insert(debts).values(values).returning({ id: debts.id }).get());
}

export async function updateDebt(owner: Viewer, id: string, input: DebtInput): Promise<void> {
  assertOwner(owner);
  db.transaction((tx) => {
    existingDebt(tx, id);
    const values = checkDebtFields(input);
    if (values.amountSen < repaidFor(tx, id)) {
      throw new ValidationError('amount', 'That is less than what has already been repaid.');
    }
    const earliest = tx
      .select({ paidOn: sql<string | null>`min(${debtPayments.paidOn})` })
      .from(debtPayments)
      .where(eq(debtPayments.debtId, id))
      .get()?.paidOn;
    if (earliest && earliest < values.lentOn) {
      throw new ValidationError('lentOn', 'A payment is dated before that day. Change or remove the payment first.');
    }
    tx.update(debts).set(values).where(eq(debts.id, id)).run();
  });
}

/** Removes the debt and, through the foreign key, its payments. */
export async function deleteDebt(owner: Viewer, id: string): Promise<void> {
  assertOwner(owner);
  db.transaction((tx) => {
    existingDebt(tx, id);
    tx.delete(debts).where(eq(debts.id, id)).run();
  });
}

export async function addPayment(
  owner: Viewer,
  debtId: string,
  input: { amountSen: number; paidOn: string },
): Promise<void> {
  assertOwner(owner);
  db.transaction((tx) => {
    const debt = existingDebt(tx, debtId);
    const amountSen = checkAmount('amount', input.amountSen);
    const paidOn = checkNotAhead('paidOn', input.paidOn);
    if (paidOn < debt.lentOn) throw new ValidationError('paidOn', 'The payment cannot be before the day you lent it.');
    const outstanding = debt.amountSen - repaidFor(tx, debtId);
    if (amountSen > outstanding) {
      throw new ValidationError('amount', 'That is more than what is still owed.');
    }
    tx.insert(debtPayments).values({ debtId, amountSen, paidOn }).run();
  });
}

export async function deletePayment(owner: Viewer, paymentId: string): Promise<void> {
  assertOwner(owner);
  db.transaction((tx) => {
    const row = tx.select({ id: debtPayments.id }).from(debtPayments).where(eq(debtPayments.id, paymentId)).get();
    if (!row) throw new ValidationError('payment', 'That payment is not in the app any more.');
    tx.delete(debtPayments).where(eq(debtPayments.id, paymentId)).run();
  });
}

const personKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Debts grouped by person (case and spacing ignored), largest outstanding first. A group takes
 * the name as written on its newest debt. Inside a group, debts still owed come before paid ones,
 * newest first. Paid debts stay, so the history is kept.
 */
export async function listDebts(owner: Viewer): Promise<DebtGroup[]> {
  assertOwner(owner);
  const rows = db.select().from(debts).all();
  const payments = db.select().from(debtPayments).orderBy(asc(debtPayments.paidOn), asc(debtPayments.id)).all();
  const byDebt = new Map<string, DebtPayment[]>();
  for (const p of payments) {
    const list = byDebt.get(p.debtId) ?? [];
    list.push({ id: p.id, amountSen: p.amountSen, paidOn: p.paidOn });
    byDebt.set(p.debtId, list);
  }

  const newestFirst = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    b.lentOn.localeCompare(a.lentOn) || b.createdAt - a.createdAt || b.id.localeCompare(a.id);

  const groups = new Map<string, { rows: typeof rows }>();
  for (const row of [...rows].sort(newestFirst)) {
    const key = personKey(row.personName);
    const group = groups.get(key) ?? { rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }

  const result: DebtGroup[] = [];
  for (const { rows: groupRows } of groups.values()) {
    const entries: DebtEntry[] = groupRows.map((row) => {
      const list = byDebt.get(row.id) ?? [];
      const repaidSen = list.reduce((sum, p) => sum + p.amountSen, 0);
      return {
        id: row.id,
        amountSen: row.amountSen,
        repaidSen,
        outstandingSen: Math.max(0, row.amountSen - repaidSen),
        status: debtStatus(row.amountSen, repaidSen),
        lentOn: row.lentOn,
        ...(row.dueOn ? { dueOn: row.dueOn } : {}),
        ...(row.note ? { note: row.note } : {}),
        payments: list,
      };
    });
    // Array sort is stable: each half keeps its newest-first order.
    entries.sort((a, b) => Number(a.status === 'paid') - Number(b.status === 'paid'));
    result.push({
      personName: groupRows[0].personName,
      outstandingSen: entries.reduce((sum, e) => sum + e.outstandingSen, 0),
      debts: entries,
    });
  }
  return result.sort((a, b) => b.outstandingSen - a.outstandingSen || a.personName.localeCompare(b.personName));
}

/** What is owed in total and by whom. People who have repaid everything are left out. */
export async function debtTotals(
  owner: Viewer,
): Promise<{ outstandingSen: number; people: { name: string; outstandingSen: number }[] }> {
  const groups = await listDebts(owner);
  const people = groups
    .filter((g) => g.outstandingSen > 0)
    .map((g) => ({ name: g.personName, outstandingSen: g.outstandingSen }));
  return { outstandingSen: people.reduce((sum, p) => sum + p.outstandingSen, 0), people };
}
