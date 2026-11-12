// What the receipt reader returned, turned into starting values for the transaction form. No
// database import, so the scan page can use the type too. Nothing here throws: a value that cannot
// be right is left out and a warning tells the person to fill it in.

import { formatRM, parseRM } from './money';
import { readWhen } from './transaction-form-data';
import { PAYMENT_METHODS, type ItemInput, type PaymentMethod, type TransactionInput } from './transaction-types';

export type ReceiptDraft = { initial: Partial<TransactionInput>; warnings: string[] };

// The form's own limits, so a long name read off a receipt still fits the field.
const MERCHANT_MAX = 100;
const RECEIPT_NUMBER_MAX = 60;
const ITEM_NAME_MAX = 100;
const QUANTITY = /^\d+(?:\.\d{1,3})?$/;
const NOON = '12:00';

type Fields = Record<string, unknown>;

function fields(value: unknown): Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Fields) : {};
}

const absent = (value: unknown) => value === null || value === undefined || value === '';

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = value.trim().replace(/\s+/g, ' ');
  return clean ? clean.slice(0, max) : undefined;
}

/** RM to sen through the decimal text, as typed amounts are: no float arithmetic on money. */
function sen(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? parseRM(String(value)) : null;
  return typeof value === 'string' ? parseRM(value) : null;
}

function quantity(value: unknown): number | null {
  const raw = typeof value === 'number' || typeof value === 'string' ? String(value).trim() : '';
  const n = QUANTITY.test(raw) ? Number(raw) : 0;
  return n > 0 ? n : null;
}

function readItems(value: unknown): { items: ItemInput[]; dropped: number } {
  const items: ItemInput[] = [];
  let dropped = 0;
  for (const entry of Array.isArray(value) ? value : []) {
    const row = fields(entry);
    const name = text(row.name, ITEM_NAME_MAX);
    const q = quantity(row.quantity);
    const unitPriceSen = sen(row.unitPrice);
    const lineTotalSen = sen(row.lineTotal);
    if (!name || q === null || unitPriceSen === null || lineTotalSen === null) dropped += 1;
    else items.push({ name, quantity: q, unitPriceSen, lineTotalSen });
  }
  return { items, dropped };
}

export function toDraft(raw: unknown, budgets: { id: string; name: string }[]): ReceiptDraft {
  const r = fields(raw);
  const initial: Partial<TransactionInput> = {};
  const warnings: string[] = [];

  const merchant = text(r.merchant, MERCHANT_MAX);
  if (merchant) initial.merchant = merchant;
  const receiptNumber = text(r.receiptNumber, RECEIPT_NUMBER_MAX);
  if (receiptNumber) initial.receiptNumber = receiptNumber;

  if (absent(r.date)) {
    warnings.push('No date was found on the receipt.');
  } else {
    const date = typeof r.date === 'string' ? r.date.trim() : '';
    const time = typeof r.time === 'string' ? r.time.trim() : '';
    const exact = time ? readWhen(date, time) : null;
    const when = exact ?? readWhen(date, NOON);
    if (!when) warnings.push('The date on the receipt could not be read.');
    else {
      initial.occurredAt = when;
      if (time && !exact) warnings.push('The time on the receipt could not be read, so it is set to 12:00.');
    }
  }

  if (absent(r.total)) {
    warnings.push('No total was found on the receipt.');
  } else {
    const total = sen(r.total);
    if (total !== null && total > 0) initial.totalSen = total;
    else warnings.push('The total on the receipt could not be read.');
  }

  if (PAYMENT_METHODS.includes(r.paymentMethod as PaymentMethod)) initial.paymentMethod = r.paymentMethod as PaymentMethod;

  const suggested = typeof r.suggestedBudget === 'string' ? r.suggestedBudget.trim().toLowerCase() : '';
  const budget = suggested ? budgets.find((b) => b.name.toLowerCase() === suggested) : undefined;
  if (budget) initial.budgetId = budget.id;

  const { items, dropped } = readItems(r.items);
  initial.items = items;
  if (dropped === 1) warnings.push('1 item could not be read and was left out.');
  if (dropped > 1) warnings.push(`${dropped} items could not be read and were left out.`);
  if (items.length > 0 && initial.totalSen !== undefined) {
    const sum = items.reduce((total, item) => total + item.lineTotalSen, 0);
    if (sum !== initial.totalSen) {
      warnings.push(`The items add up to ${formatRM(sum)} but the total reads ${formatRM(initial.totalSen)}.`);
    }
  }

  return { initial, warnings };
}
