import type { Locale } from '@/i18n/locale';
import { say } from './errors';
import { formText } from './form-state';
import { parseRM } from './money';
import { dayKey, fromLocalDateTime } from './time';
import { PAYMENT_METHODS, type ItemInput, type PaymentMethod, type TransactionInput } from './transaction-types';

/**
 * The transaction form's field names, shared by the form and the server actions. Item fields repeat
 * once per row, so they are read with getAll and matched by position.
 */
export const ITEM_FIELDS = { name: 'itemName', quantity: 'itemQuantity', unit: 'itemUnitPrice', total: 'itemLineTotal' };

export type ParsedForm =
  | { ok: true; input: TransactionInput }
  | { ok: false; errors: Record<string, string> };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;
const QUANTITY = /^\d+(?:\.\d{1,3})?$/;

function strings(formData: FormData, name: string): string[] {
  return formData.getAll(name).map((v) => (typeof v === 'string' ? v : ''));
}

/** Malaysia wall-clock date and time to an instant, or null when either is not a real date and time. */
export function readWhen(date: string, time: string): Date | null {
  if (!DATE.test(date) || !TIME.test(time)) return null;
  try {
    const when = fromLocalDateTime(date, time);
    // Date.parse rolls 31 February into March; a date that changes on the way through was not real.
    return dayKey(when) === date ? when : null;
  } catch {
    return null;
  }
}

/**
 * Reads the form into a TransactionInput. Amounts go through parseRM; a field that does not parse
 * comes back as a message under that field. Business rules (positive total, not in the future,
 * budget in use) are checked again by the lib, which is the only place that has to be right.
 */
export function parseTransactionForm(formData: FormData, locale: Locale = 'en'): ParsedForm {
  const errors: Record<string, string> = {};

  const merchant = formText(formData, 'merchant');
  if (!merchant.trim()) errors.merchant = say(locale, 'enterMerchant');

  const totalText = formText(formData, 'total').trim();
  const totalSen = totalText ? parseRM(totalText) : null;
  if (totalSen === null) errors.total = totalText ? say(locale, 'totalFormat') : say(locale, 'enterTotal');

  const occurredAt = readWhen(formText(formData, 'date').trim(), formText(formData, 'time').trim());
  if (!occurredAt) errors.occurredAt = say(locale, 'enterDateTime');

  const method = formText(formData, 'paymentMethod');
  if (!PAYMENT_METHODS.includes(method as PaymentMethod)) errors.paymentMethod = say(locale, 'choosePayment');

  const names = strings(formData, ITEM_FIELDS.name);
  const quantities = strings(formData, ITEM_FIELDS.quantity);
  const units = strings(formData, ITEM_FIELDS.unit);
  const totals = strings(formData, ITEM_FIELDS.total);
  const items: ItemInput[] = names.map((name, i) => {
    const quantityText = (quantities[i] ?? '').trim();
    const quantity = QUANTITY.test(quantityText) ? Number(quantityText) : NaN;
    if (!(quantity > 0)) errors[`items.${i}.quantity`] = say(locale, 'quantityFormat');
    if (!name.trim()) errors[`items.${i}.name`] = say(locale, 'enterItemName');

    const unitText = (units[i] ?? '').trim();
    const unitPriceSen = unitText ? parseRM(unitText) : null;
    if (unitPriceSen === null) {
      errors[`items.${i}.unitPrice`] = unitText ? say(locale, 'unitPriceFormat') : say(locale, 'enterUnitPrice');
    }

    // Left blank, the lib works the line total out as quantity times price.
    const lineText = (totals[i] ?? '').trim();
    const parsedLine = lineText ? parseRM(lineText) : NaN;
    if (lineText && parsedLine === null) errors[`items.${i}.lineTotal`] = say(locale, 'lineTotalFormat');

    return { name, quantity, unitPriceSen: unitPriceSen ?? 0, lineTotalSen: parsedLine ?? NaN };
  });

  if (Object.keys(errors).length > 0 || totalSen === null || !occurredAt) return { ok: false, errors };

  const budgetId = formText(formData, 'budgetId');
  // Set by the scan page. The lib only links an upload the same person made and nobody has used yet.
  const receiptUploadId = formText(formData, 'receiptUploadId');
  return {
    ok: true,
    input: {
      merchant,
      occurredAt,
      receiptNumber: formText(formData, 'receiptNumber'),
      totalSen,
      paymentMethod: method as PaymentMethod,
      budgetId: budgetId === '' ? null : budgetId,
      note: formText(formData, 'note'),
      items,
      ...(receiptUploadId ? { receiptUploadId } : {}),
    },
  };
}
