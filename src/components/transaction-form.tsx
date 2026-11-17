'use client';

import { useActionState, useId, useState } from 'react';
import { Button } from '@/components/button';
import { ButtonLink } from '@/components/button-link';
import { controlClass, controlProps, Field, FieldShell } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { Select } from '@/components/select';
import { SubmitButton } from '@/components/submit-button';
import { useFocusFirstInvalid } from '@/components/use-focus-first-invalid';
import { useMessages } from '@/i18n/client';
import { fmt } from '@/i18n/format';
import { initialFormState, type FormState } from '@/lib/form-state';
import { formatRM, parseRM } from '@/lib/money';
import { ITEM_FIELDS } from '@/lib/transaction-form-data';
import { dayKey, timeKey } from '@/lib/time';
import { PAYMENT_METHODS, type TransactionInput } from '@/lib/transaction-types';

type Props = {
  /** The server action this form submits to. It checks who is acting itself. */
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** Budgets the picker offers, besides Uncategorised. */
  budgets: { id: string; name: string }[];
  /** Starting values: a saved transaction, or what was read from a receipt. */
  initial?: Partial<TransactionInput>;
  /** Things to double-check before saving, such as a total the receipt reader was unsure of. */
  warnings?: string[];
  submitLabel: string;
  /** Where Cancel goes. */
  cancelHref: string;
  /** Extra fixed fields for the action, such as the id of the transaction being edited. */
  hidden?: Record<string, string>;
};

type Row = { key: number; name: string; quantity: string; unit: string; total: string };

const money = (sen: number) => (sen / 100).toFixed(2);

function textarea(id: string, error: string | undefined) {
  return { ...controlProps(id, { error }), className: `${controlClass(error)} py-2` };
}

/** What the rows add up to, or null while any row is too incomplete to count. */
function itemsSum(rows: Row[]): number | null {
  let sum = 0;
  for (const row of rows) {
    const total = row.total.trim() ? parseRM(row.total) : null;
    if (total !== null) {
      sum += total;
      continue;
    }
    const quantity = Number(row.quantity.trim());
    const unit = row.unit.trim() ? parseRM(row.unit) : null;
    if (row.total.trim() || !(quantity > 0) || unit === null) return null;
    sum += Math.round(quantity * unit);
  }
  return sum;
}

export function TransactionForm({ action, budgets, initial, warnings, submitLabel, cancelHref, hidden }: Props) {
  const [state, formAction] = useActionState(action, initialFormState);
  const { common, transactions } = useMessages();
  const t = transactions.form;
  const formRef = useFocusFirstInvalid(state);
  const errors = state.fieldErrors;
  const noteId = useId();
  // After a failed submit React resets uncontrolled fields, so they are put back from what was sent.
  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;

  const [rows, setRows] = useState<Row[]>(() =>
    (initial?.items ?? []).map((item, key) => ({
      key,
      name: item.name,
      quantity: String(item.quantity),
      unit: money(item.unitPriceSen),
      total: money(item.lineTotalSen),
    })),
  );
  // Row keys only ever go up, so a removed row's key is never reused.
  const [nextKey, setNextKey] = useState(rows.length);
  const [totalText, setTotalText] = useState(initial?.totalSen !== undefined ? money(initial.totalSen) : '');
  const change = (key: number, patch: Partial<Row>) =>
    setRows((all) => all.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const totalSen = totalText.trim() ? parseRM(totalText) : null;
  const sum = itemsSum(rows);
  let note: string | null = null;
  if (rows.length > 0 && sum !== null && totalSen !== null && sum !== totalSen) {
    note = fmt(sum < totalSen ? t.itemsLess : t.itemsMore, {
      sum: formatRM(sum),
      difference: formatRM(Math.abs(totalSen - sum)),
    });
  }

  return (
    <form ref={formRef} action={formAction} noValidate className="flex max-w-xl flex-col gap-5">
      <FormAlert state={state} />
      {warnings && warnings.length > 0 && (
        <div className="rounded-control border border-line-strong bg-surface px-3 py-3">
          <p className="font-semibold text-ink">{t.checkFirst}</p>
          <ul className="mt-1 list-disc pl-5 text-muted">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
      {hidden && Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}

      <Field label={t.merchant} name="merchant" defaultValue={v('merchant', initial?.merchant ?? '')} error={errors?.merchant} maxLength={100} autoComplete="off" />
      <Field
        label={t.total}
        name="total"
        inputMode="decimal"
        autoComplete="off"
        value={totalText}
        onChange={(event) => setTotalText(event.target.value)}
        error={errors?.total}
      />
      <div className="grid grid-cols-1 gap-5 min-[420px]:grid-cols-2">
        <Field
          label={t.date}
          name="date"
          type="date"
          defaultValue={v('date', initial?.occurredAt ? dayKey(initial.occurredAt) : '')}
          error={errors?.occurredAt}
          hint={t.dateHint}
        />
        <Field label={t.time} name="time" type="time" defaultValue={v('time', initial?.occurredAt ? timeKey(initial.occurredAt) : '')} />
      </div>
      <Select label={transactions.paidWith} name="paymentMethod" defaultValue={v('paymentMethod', initial?.paymentMethod ?? 'qr')} error={errors?.paymentMethod}>
        {PAYMENT_METHODS.map((method) => (
          <option key={method} value={method}>
            {common.payment[method]}
          </option>
        ))}
      </Select>
      <Select label={transactions.budget} name="budgetId" defaultValue={v('budgetId', initial?.budgetId ?? '')} error={errors?.budget}>
        <option value="">{common.uncategorised}</option>
        {budgets.map((budget) => (
          <option key={budget.id} value={budget.id}>
            {budget.name}
          </option>
        ))}
      </Select>
      <Field label={t.receiptNumber} name="receiptNumber" defaultValue={v('receiptNumber', initial?.receiptNumber ?? '')} error={errors?.receiptNumber} maxLength={60} autoComplete="off" />
      <FieldShell id={noteId} label={t.note} error={errors?.note}>
        <textarea {...textarea(noteId, errors?.note)} name="note" rows={3} maxLength={500} defaultValue={v('note', initial?.note ?? '')} />
      </FieldShell>

      <section aria-labelledby="items-heading" className="flex flex-col gap-4">
        <h2 id="items-heading" className="text-lg font-semibold text-ink">
          {t.items}
        </h2>
        {errors?.items && <p className="text-sm font-medium text-danger"><span className="sr-only">{common.errorPrefix} </span>{errors.items}</p>}
        {rows.length === 0 && <p className="text-muted">{t.noItems}</p>}
        {rows.map((row, i) => (
          <fieldset key={row.key} className="flex flex-col gap-4 rounded-surface border border-line p-4">
            <legend className="px-1 text-sm font-semibold text-ink">{fmt(t.item, { n: i + 1 })}</legend>
            <Field label={t.itemName} name={ITEM_FIELDS.name} value={row.name} onChange={(e) => change(row.key, { name: e.target.value })} error={errors?.[`items.${i}.name`]} maxLength={100} autoComplete="off" />
            <div className="grid grid-cols-2 gap-4">
              <Field label={t.quantity} name={ITEM_FIELDS.quantity} inputMode="decimal" value={row.quantity} onChange={(e) => change(row.key, { quantity: e.target.value })} error={errors?.[`items.${i}.quantity`]} autoComplete="off" />
              <Field label={t.unitPrice} name={ITEM_FIELDS.unit} inputMode="decimal" value={row.unit} onChange={(e) => change(row.key, { unit: e.target.value })} error={errors?.[`items.${i}.unitPrice`]} autoComplete="off" />
            </div>
            <Field
              label={t.lineTotal}
              hint={t.lineTotalHint}
              name={ITEM_FIELDS.total}
              inputMode="decimal"
              value={row.total}
              onChange={(e) => change(row.key, { total: e.target.value })}
              error={errors?.[`items.${i}.lineTotal`]}
              autoComplete="off"
            />
            <div>
              <Button variant="quiet" className="-ml-3" onClick={() => setRows((all) => all.filter((r) => r.key !== row.key))}>
                {fmt(t.removeItem, { n: i + 1 })}
              </Button>
            </div>
          </fieldset>
        ))}
        <div>
          <Button
            variant="secondary"
            onClick={() => {
              setRows((all) => [...all, { key: nextKey, name: '', quantity: '1', unit: '', total: '' }]);
              setNextKey(nextKey + 1);
            }}
          >
            {t.addItem}
          </Button>
        </div>
        <p role="status" className="text-sm text-muted empty:hidden">
          {note}
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <ButtonLink href={cancelHref} variant="secondary">
          {common.cancel}
        </ButtonLink>
      </div>
    </form>
  );
}
