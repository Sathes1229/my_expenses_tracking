import { and, asc, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { budgets, receiptUploads, transactionItems, transactions, user } from '@/db/schema';
import type { Viewer } from '@/lib/auth/viewer';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { evaluateBudgetAlerts } from './notifications';
import { monthKey, monthRange } from './time';
import { PAYMENT_METHODS, UNCATEGORISED, type ItemInput, type PaymentMethod, type TransactionInput } from './transaction-types';

export * from './transaction-types';

export type TransactionRow = {
  id: string;
  merchant: string;
  occurredAt: Date;
  totalSen: number;
  paymentMethod: PaymentMethod;
  budgetName: string;
  createdById: string;
  createdByName: string;
  hasReceipt: boolean;
  canEdit: boolean;
};

export type TransactionDetail = TransactionRow & {
  receiptNumber?: string;
  note?: string;
  budgetId: string | null;
  items: ItemInput[];
  receiptUploadId?: string;
};

export type TransactionFilter = {
  month: string;
  /** `null` is Uncategorised; left out means every budget. */
  budgetId?: string | null;
  /** Ignored for guests, who only ever see their own rows. */
  personId?: string;
  paymentMethod?: PaymentMethod;
};

const MERCHANT_MAX = 100;
const RECEIPT_NUMBER_MAX = 60;
const NOTE_MAX = 500;
const ITEM_NAME_MAX = 100;
const ITEMS_MAX = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const canEditRow = (viewer: Viewer, createdBy: string) => viewer.role === 'owner' || createdBy === viewer.id;

type Clean = {
  merchant: string;
  occurredAt: number;
  receiptNumber: string | null;
  totalSen: number;
  paymentMethod: PaymentMethod;
  budgetId: string | null;
  note: string | null;
  items: ItemInput[];
};

function optionalText(raw: string | undefined, max: number, field: string, label: string): string | null {
  const text = (raw ?? '').trim();
  if (!text) return null;
  if (text.length > max) throw new ValidationError(field, `${label} can be at most ${max} characters.`);
  return text;
}

function cleanItems(items: ItemInput[]): ItemInput[] {
  if (items.length > ITEMS_MAX) throw new ValidationError('items', `Add at most ${ITEMS_MAX} items.`);
  return items.map((item, i) => {
    const name = item.name.trim();
    if (!name) throw new ValidationError(`items.${i}.name`, 'Enter the item name.');
    if (name.length > ITEM_NAME_MAX) {
      throw new ValidationError(`items.${i}.name`, `Use ${ITEM_NAME_MAX} characters or fewer.`);
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new ValidationError(`items.${i}.quantity`, 'Enter a quantity above 0.');
    }
    if (!Number.isSafeInteger(item.unitPriceSen) || item.unitPriceSen < 0) {
      throw new ValidationError(`items.${i}.unitPrice`, 'Enter the price of one, RM 0.00 or more.');
    }
    const lineTotalSen = Number.isNaN(item.lineTotalSen)
      ? Math.round(item.quantity * item.unitPriceSen)
      : item.lineTotalSen;
    if (!Number.isSafeInteger(lineTotalSen) || lineTotalSen < 0) {
      throw new ValidationError(`items.${i}.lineTotal`, 'Enter the line total, RM 0.00 or more.');
    }
    return { name, quantity: item.quantity, unitPriceSen: item.unitPriceSen, lineTotalSen };
  });
}

/** Everything but the budget, which depends on the row being replaced. */
function clean(input: TransactionInput): Omit<Clean, 'budgetId'> {
  const merchant = input.merchant.trim().replace(/\s+/g, ' ');
  if (!merchant) throw new ValidationError('merchant', 'Enter where the money was spent.');
  if (merchant.length > MERCHANT_MAX) {
    throw new ValidationError('merchant', `Use ${MERCHANT_MAX} characters or fewer.`);
  }
  if (!Number.isSafeInteger(input.totalSen) || input.totalSen <= 0) {
    throw new ValidationError('total', 'Enter a total above RM 0.00.');
  }
  const at = input.occurredAt.getTime();
  if (Number.isNaN(at)) throw new ValidationError('occurredAt', 'Enter a valid date and time.');
  if (at > Date.now() + DAY_MS) throw new ValidationError('occurredAt', 'The date cannot be more than a day ahead.');
  if (!PAYMENT_METHODS.includes(input.paymentMethod)) {
    throw new ValidationError('paymentMethod', 'Choose how it was paid.');
  }
  return {
    merchant,
    occurredAt: at,
    receiptNumber: optionalText(input.receiptNumber, RECEIPT_NUMBER_MAX, 'receiptNumber', 'The receipt number'),
    totalSen: input.totalSen,
    paymentMethod: input.paymentMethod,
    note: optionalText(input.note, NOTE_MAX, 'note', 'The note'),
    items: cleanItems(input.items),
  };
}

/** A new row may only use an active budget. An existing row may also keep the one it has, even if archived. */
function checkBudget(tx: Tx, budgetId: string | null, keep?: string | null): string | null {
  if (budgetId === null) return null;
  if (budgetId === keep) return budgetId;
  const row = tx.select({ archivedAt: budgets.archivedAt }).from(budgets).where(eq(budgets.id, budgetId)).get();
  if (!row || row.archivedAt !== null) throw new ValidationError('budget', 'Choose a budget from the list.');
  return budgetId;
}

function writeItems(tx: Tx, transactionId: string, items: ItemInput[]) {
  if (items.length === 0) return;
  tx.insert(transactionItems)
    .values(items.map((item, position) => ({ transactionId, position, ...item })))
    .run();
}

/** Ties a receipt this person uploaded to the transaction saved from it. */
function linkReceipt(tx: Tx, viewer: Viewer, transactionId: string, uploadId: string | undefined) {
  if (!uploadId) return;
  tx.update(receiptUploads)
    .set({ transactionId })
    .where(
      and(eq(receiptUploads.id, uploadId), eq(receiptUploads.uploadedBy, viewer.id), isNull(receiptUploads.transactionId)),
    )
    .run();
}

/**
 * Runs after a write has committed, for each budget and month it touched. A failure here must not
 * make a saved change look failed, so it is logged and left.
 */
async function alertAfterWrite(touched: { budgetId: string | null; occurredAt: number }[]): Promise<void> {
  const seen = new Set<string>();
  for (const { budgetId, occurredAt } of touched) {
    const month = monthKey(new Date(occurredAt));
    const key = `${budgetId}|${month}`;
    if (budgetId === null || seen.has(key)) continue;
    seen.add(key);
    try {
      await evaluateBudgetAlerts(budgetId, month);
    } catch (error) {
      console.error('Could not check budget alerts', error);
    }
  }
}

export async function createTransaction(viewer: Viewer, input: TransactionInput): Promise<{ id: string }> {
  const data = clean(input);
  const created = db.transaction((tx) => {
    const budgetId = checkBudget(tx, input.budgetId);
    const { items, ...columns } = data;
    const { id } = tx
      .insert(transactions)
      .values({ ...columns, budgetId, createdBy: viewer.id })
      .returning({ id: transactions.id })
      .get();
    writeItems(tx, id, items);
    linkReceipt(tx, viewer, id, input.receiptUploadId);
    return { id, budgetId, occurredAt: data.occurredAt };
  });
  await alertAfterWrite([created]);
  return { id: created.id };
}

/** The row's maker, for the permission check. A missing row is its own error. */
function owned(tx: Tx, viewer: Viewer, id: string) {
  const row = tx
    .select({ createdBy: transactions.createdBy, budgetId: transactions.budgetId, occurredAt: transactions.occurredAt })
    .from(transactions)
    .where(eq(transactions.id, id))
    .get();
  if (!row) throw new ValidationError('transaction', 'That transaction is not in the app any more.');
  if (!canEditRow(viewer, row.createdBy)) throw new ForbiddenError('You can only change transactions you added.');
  return row;
}

export async function updateTransaction(viewer: Viewer, id: string, input: TransactionInput): Promise<void> {
  const touched = db.transaction((tx) => {
    const existing = owned(tx, viewer, id);
    const data = clean(input);
    const budgetId = checkBudget(tx, input.budgetId, existing.budgetId);
    const { items, ...columns } = data;
    tx.update(transactions)
      .set({ ...columns, budgetId, updatedAt: Date.now() })
      .where(eq(transactions.id, id))
      .run();
    tx.delete(transactionItems).where(eq(transactionItems.transactionId, id)).run();
    writeItems(tx, id, items);
    linkReceipt(tx, viewer, id, input.receiptUploadId);
    return [existing, { budgetId, occurredAt: data.occurredAt }];
  });
  // The old budget and month are re-checked too; the unique index keeps repeats harmless.
  await alertAfterWrite(touched);
}

export async function deleteTransaction(viewer: Viewer, id: string): Promise<void> {
  const removed = db.transaction((tx) => {
    const existing = owned(tx, viewer, id);
    // Items go with it (cascade); the receipt record stays but points at nothing (set null).
    tx.delete(transactions).where(eq(transactions.id, id)).run();
    return existing;
  });
  await alertAfterWrite([removed]);
}

const hasReceiptSql = sql<number>`exists (select 1 from ${receiptUploads} where ${receiptUploads.transactionId} = ${transactions.id})`;

function selectRows() {
  return db
    .select({
      id: transactions.id,
      merchant: transactions.merchant,
      occurredAt: transactions.occurredAt,
      totalSen: transactions.totalSen,
      paymentMethod: transactions.paymentMethod,
      budgetId: transactions.budgetId,
      budgetName: budgets.name,
      createdById: transactions.createdBy,
      createdByName: user.name,
      hasReceipt: hasReceiptSql,
      receiptNumber: transactions.receiptNumber,
      note: transactions.note,
    })
    .from(transactions)
    .leftJoin(budgets, eq(budgets.id, transactions.budgetId))
    .leftJoin(user, eq(user.id, transactions.createdBy));
}

type RawRow = ReturnType<ReturnType<typeof selectRows>['all']>[number];

function toRow(viewer: Viewer, r: RawRow): TransactionRow {
  return {
    id: r.id,
    merchant: r.merchant,
    occurredAt: new Date(r.occurredAt),
    totalSen: r.totalSen,
    paymentMethod: r.paymentMethod as PaymentMethod,
    budgetName: r.budgetName ?? UNCATEGORISED,
    createdById: r.createdById,
    createdByName: r.createdByName ?? 'Unknown',
    hasReceipt: Boolean(r.hasReceipt),
    canEdit: canEditRow(viewer, r.createdById),
  };
}

/** `null` when it does not exist or the viewer may not see it: the two look the same on purpose. */
export async function getTransaction(viewer: Viewer, id: string): Promise<TransactionDetail | null> {
  const r = selectRows().where(eq(transactions.id, id)).get();
  if (!r) return null;
  if (viewer.role === 'guest' && r.createdById !== viewer.id) return null;
  const items = db
    .select({
      name: transactionItems.name,
      quantity: transactionItems.quantity,
      unitPriceSen: transactionItems.unitPriceSen,
      lineTotalSen: transactionItems.lineTotalSen,
    })
    .from(transactionItems)
    .where(eq(transactionItems.transactionId, id))
    .orderBy(asc(transactionItems.position))
    .all();
  const upload = db
    .select({ id: receiptUploads.id })
    .from(receiptUploads)
    .where(eq(receiptUploads.transactionId, id))
    .get();
  return {
    ...toRow(viewer, r),
    budgetId: r.budgetId,
    items,
    ...(r.receiptNumber ? { receiptNumber: r.receiptNumber } : {}),
    ...(r.note ? { note: r.note } : {}),
    ...(upload ? { receiptUploadId: upload.id } : {}),
  };
}

/** Newest first. A guest's list is cut to their own rows here, in the query, whatever the filter says. */
export async function listTransactions(viewer: Viewer, filter: TransactionFilter): Promise<TransactionRow[]> {
  const { start, end } = monthRange(filter.month);
  const where = [gte(transactions.occurredAt, start.getTime()), lt(transactions.occurredAt, end.getTime())];
  if (viewer.role === 'guest') where.push(eq(transactions.createdBy, viewer.id));
  else if (filter.personId) where.push(eq(transactions.createdBy, filter.personId));
  if (filter.paymentMethod) where.push(eq(transactions.paymentMethod, filter.paymentMethod));
  if (filter.budgetId === null) where.push(isNull(transactions.budgetId));
  else if (filter.budgetId !== undefined) where.push(eq(transactions.budgetId, filter.budgetId));
  return selectRows()
    .where(and(...where))
    .orderBy(desc(transactions.occurredAt), desc(transactions.createdAt))
    .all()
    .map((r) => toRow(viewer, r));
}

/** People who may appear in the person filter: anyone who has a transaction. Names only. */
export async function listPeople(viewer: Viewer): Promise<{ id: string; name: string }[]> {
  if (viewer.role === 'guest') return [];
  return db
    .selectDistinct({ id: user.id, name: user.name })
    .from(transactions)
    .innerJoin(user, eq(user.id, transactions.createdBy))
    .orderBy(asc(user.name))
    .all();
}
