import { describe, expect, it } from 'vitest';
import { parseTransactionForm } from '@/lib/transaction-form-data';

function form(entries: [string, string][]) {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

const base: [string, string][] = [
  ['merchant', 'Tesco'],
  ['date', '2026-11-03'],
  ['time', '19:05'],
  ['total', '45.5'],
  ['paymentMethod', 'qr'],
  ['budgetId', ''],
];

describe('parseTransactionForm', () => {
  it('reads Malaysia date and time, amounts in sen, and an empty budget as Uncategorised', () => {
    const r = parseTransactionForm(form(base));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.totalSen).toBe(4550);
    expect(r.input.budgetId).toBeNull();
    expect(r.input.occurredAt.toISOString()).toBe('2026-11-03T11:05:00.000Z');
  });

  it('keeps item rows in order and leaves a blank line total for the lib to work out', () => {
    const r = parseTransactionForm(
      form([
        ...base,
        ['itemName', 'Milk'], ['itemQuantity', '2'], ['itemUnitPrice', '6.50'], ['itemLineTotal', '13'],
        ['itemName', 'Rice'], ['itemQuantity', '0.5'], ['itemUnitPrice', '20'], ['itemLineTotal', ''],
      ]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.input.items[0]).toEqual({ name: 'Milk', quantity: 2, unitPriceSen: 650, lineTotalSen: 1300 });
    expect(r.input.items[1].quantity).toBe(0.5);
    expect(r.input.items[1].lineTotalSen).toBeNaN();
  });

  it('reports each bad field under its own name', () => {
    const r = parseTransactionForm(
      form([
        ['merchant', ' '], ['date', '2026-02-30'], ['time', '19:05'], ['total', 'abc'], ['paymentMethod', 'gold'],
        ['itemName', ''], ['itemQuantity', '0'], ['itemUnitPrice', '1.234'], ['itemLineTotal', 'x'],
      ]),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(
      ['items.0.lineTotal', 'items.0.name', 'items.0.quantity', 'items.0.unitPrice', 'merchant', 'occurredAt', 'paymentMethod', 'total'].sort(),
    );
  });

  it('passes on the scanned receipt to link, and nothing when there is none', () => {
    const scanned = parseTransactionForm(form([...base, ['receiptUploadId', 'u1']]));
    const manual = parseTransactionForm(form(base));
    expect(scanned.ok && scanned.input.receiptUploadId).toBe('u1');
    expect(manual.ok && 'receiptUploadId' in manual.input).toBe(false);
  });
});
