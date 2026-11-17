import { describe, expect, it } from 'vitest';
import { messages } from '@/i18n/messages';
import { parseStarterForm } from '@/lib/starter-form-data';

function form(fields: [string, string][]): FormData {
  const data = new FormData();
  for (const [name, value] of fields) data.append(name, value);
  return data;
}

describe('parseStarterForm', () => {
  it('turns ticked rows with amounts into picks, with the submitted names', () => {
    const result = parseStarterForm(
      form([
        ['pick', 'groceries'],
        ['name_groceries', 'Barang dapur'],
        ['amount_groceries', '600'],
        ['pick', 'petrol'],
        ['name_petrol', 'Minyak kereta'],
        ['amount_petrol', '250.50'],
      ]),
      'ms',
    );
    expect(result).toEqual({
      ok: true,
      picks: [
        { name: 'Barang dapur', allocationSen: 60000 },
        { name: 'Minyak kereta', allocationSen: 25050 },
      ],
    });
  });

  it('asks for an amount under each ticked row that has none or a bad one', () => {
    const result = parseStarterForm(
      form([
        ['pick', 'groceries'],
        ['name_groceries', 'Groceries'],
        ['amount_groceries', ''],
        ['pick', 'health'],
        ['name_health', 'Health'],
        ['amount_health', 'abc'],
      ]),
      'en',
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        amount_groceries: messages.en.errors.enterMonthlyAmount,
        amount_health: messages.en.errors.budgetAmountFormat,
      },
    });
  });

  it('asks to tick at least one row', () => {
    const result = parseStarterForm(form([['amount_groceries', '600']]), 'ms');
    expect(result).toEqual({ ok: false, errors: { pick: messages.ms.errors.starterNoneChosen } });
  });

  it('ignores rows that are not ticked, and keys it does not know', () => {
    const result = parseStarterForm(
      form([
        ['pick', 'groceries'],
        ['name_groceries', 'Groceries'],
        ['amount_groceries', '600'],
        ['amount_petrol', '300'],
        ['pick', 'yacht'],
        ['amount_yacht', '9999'],
      ]),
      'en',
    );
    expect(result).toEqual({ ok: true, picks: [{ name: 'Groceries', allocationSen: 60000 }] });
  });
});
