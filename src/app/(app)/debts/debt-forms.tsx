'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/button';
import { Dialog } from '@/components/dialog';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { useFocusFirstInvalid } from '@/components/use-focus-first-invalid';
import { useMessages } from '@/i18n/client';
import { fmt } from '@/i18n/format';
import { initialFormState, type FormState } from '@/lib/form-state';
import { formatRM } from '@/lib/money';
import {
  addPaymentAction,
  createDebtAction,
  deleteDebtAction,
  deletePaymentAction,
  updateDebtAction,
} from './actions';

/** What the owner can change on one debt, as the page read it from the server. */
export type EditableDebt = {
  id: string;
  personName: string;
  amountSen: number;
  lentOn: string;
  dueOn?: string;
  note?: string;
};

const input = (sen: number) => (sen / 100).toFixed(2);

/** Closes the dialog (so the browser puts focus back on its button) once the action reports success. */
function useCloseOnDone(state: FormState, close: () => void) {
  useEffect(() => {
    if (state.done) close();
    // close only flips local state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

function DebtForm({
  title,
  submitLabel,
  initial,
  today,
  onClose,
}: {
  title: string;
  submitLabel: string;
  initial?: EditableDebt;
  today: string;
  onClose: () => void;
}) {
  const [state, action] = useActionState(initial ? updateDebtAction : createDebtAction, initialFormState);
  const { common, debts: t } = useMessages();
  const formRef = useFocusFirstInvalid(state);
  const [shown, setShown] = useState(true);
  useCloseOnDone(state, () => setShown(false));
  const errors = state.fieldErrors;
  const v = (name: string, fallback: string) => state.values?.[name] ?? fallback;
  return (
    <Dialog open={shown} onClose={onClose} title={title}>
      <form ref={formRef} action={action} noValidate className="flex flex-col gap-4">
        <FormAlert state={state} />
        {initial && <input type="hidden" name="debtId" value={initial.id} />}
        <Field
          label={t.personName}
          name="personName"
          defaultValue={v('personName', initial?.personName ?? '')}
          error={errors?.personName}
          maxLength={60}
          autoComplete="off"
        />
        <Field
          label={t.amount}
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={v('amount', initial ? input(initial.amountSen) : '')}
          error={errors?.amount}
        />
        <Field
          label={t.lentDate}
          name="lentOn"
          type="date"
          defaultValue={v('lentOn', initial?.lentOn ?? today)}
          error={errors?.lentOn}
        />
        <Field
          label={t.dueDate}
          name="dueOn"
          type="date"
          defaultValue={v('dueOn', initial?.dueOn ?? '')}
          error={errors?.dueOn}
        />
        <Field
          label={t.note}
          name="note"
          defaultValue={v('note', initial?.note ?? '')}
          error={errors?.note}
          maxLength={500}
          autoComplete="off"
        />
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => setShown(false)}>
            {common.cancel}
          </Button>
          <SubmitButton>{submitLabel}</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}

/** The dialog is mounted only while open, so a closed form never keeps old input. */
export function RecordDebt({ today, variant = 'primary' }: { today: string; variant?: 'primary' | 'secondary' }) {
  const [open, setOpen] = useState(false);
  const t = useMessages().debts;
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        {t.record}
      </Button>
      {open && <DebtForm title={t.record} submitLabel={t.saveDebt} today={today} onClose={() => setOpen(false)} />}
    </>
  );
}

export function DebtActions({
  debt,
  outstandingSen,
  today,
}: {
  debt: EditableDebt;
  outstandingSen: number;
  today: string;
}) {
  return (
    <div className="-mx-3 flex flex-wrap gap-1">
      {outstandingSen > 0 && <RecordPayment debt={debt} outstandingSen={outstandingSen} today={today} />}
      <EditDebt debt={debt} today={today} />
      <DeleteDebt debt={debt} />
    </div>
  );
}

function RecordPayment({ debt, outstandingSen, today }: { debt: EditableDebt; outstandingSen: number; today: string }) {
  const [open, setOpen] = useState(false);
  const t = useMessages().debts;
  return (
    <>
      <Button variant="quiet" onClick={() => setOpen(true)}>
        {t.recordPayment}
        <span className="sr-only"> {fmt(t.fromName, { name: debt.personName })}</span>
      </Button>
      {open && <PaymentDialog debt={debt} outstandingSen={outstandingSen} today={today} onClose={() => setOpen(false)} />}
    </>
  );
}

function PaymentDialog({
  debt,
  outstandingSen,
  today,
  onClose,
}: {
  debt: EditableDebt;
  outstandingSen: number;
  today: string;
  onClose: () => void;
}) {
  const [state, action] = useActionState(addPaymentAction, initialFormState);
  const { common, debts: t } = useMessages();
  const formRef = useFocusFirstInvalid(state);
  const [shown, setShown] = useState(true);
  useCloseOnDone(state, () => setShown(false));
  const errors = state.fieldErrors;
  return (
    <Dialog open={shown} onClose={onClose} title={fmt(t.paymentTitle, { name: debt.personName })}>
      <form ref={formRef} action={action} noValidate className="flex flex-col gap-4">
        <FormAlert state={state} />
        <input type="hidden" name="debtId" value={debt.id} />
        <Field
          label={t.amountPaid}
          hint={fmt(t.stillOwedHint, { amount: formatRM(outstandingSen) })}
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={state.values?.amount ?? ''}
          error={errors?.amount}
        />
        <Field
          label={t.datePaid}
          name="paidOn"
          type="date"
          defaultValue={state.values?.paidOn ?? today}
          error={errors?.paidOn}
        />
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => setShown(false)}>
            {common.cancel}
          </Button>
          <SubmitButton>{t.savePayment}</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}

function EditDebt({ debt, today }: { debt: EditableDebt; today: string }) {
  const [open, setOpen] = useState(false);
  const { common, debts: t } = useMessages();
  return (
    <>
      <Button variant="quiet" onClick={() => setOpen(true)}>
        {common.edit}
        <span className="sr-only"> {fmt(t.debtOf, { name: debt.personName })}</span>
      </Button>
      {open && (
        <DebtForm
          title={fmt(t.editTitle, { name: debt.personName })}
          submitLabel={t.saveChanges}
          initial={debt}
          today={today}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function DeleteDebt({ debt }: { debt: EditableDebt }) {
  const [open, setOpen] = useState(false);
  const t = useMessages().debts;
  return (
    <>
      <Button variant="quiet" onClick={() => setOpen(true)}>
        {t.delete}
        <span className="sr-only"> {fmt(t.debtOf, { name: debt.personName })}</span>
      </Button>
      {open && (
        <ConfirmDialog
          title={fmt(t.deleteTitle, { amount: formatRM(debt.amountSen) })}
          body={t.deleteBody}
          keepLabel={t.keep}
          deleteLabel={t.deleteConfirm}
          action={deleteDebtAction}
          hidden={{ debtId: debt.id }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function DeletePayment({
  paymentId,
  label,
}: {
  paymentId: string;
  /** What the payment is, for screen readers and the confirmation: "RM 200.00 on 10 Nov 2026". */
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const t = useMessages().debts;
  return (
    <>
      <Button variant="quiet" onClick={() => setOpen(true)}>
        {t.remove}
        <span className="sr-only"> {fmt(t.paymentOf, { payment: label })}</span>
      </Button>
      {open && (
        <ConfirmDialog
          title={fmt(t.removeTitle, { payment: label })}
          body={t.removeBody}
          keepLabel={t.keep}
          deleteLabel={t.removeConfirm}
          action={deletePaymentAction}
          hidden={{ paymentId }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ConfirmDialog({
  title,
  body,
  keepLabel,
  deleteLabel,
  action: serverAction,
  hidden,
  onClose,
}: {
  title: string;
  body: string;
  keepLabel: string;
  deleteLabel: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  hidden: Record<string, string>;
  onClose: () => void;
}) {
  const [state, action] = useActionState(serverAction, initialFormState);
  const [shown, setShown] = useState(true);
  useCloseOnDone(state, () => setShown(false));
  return (
    <Dialog open={shown} onClose={onClose} title={title}>
      <form action={action} className="flex flex-col gap-4">
        <p className="text-muted">{body}</p>
        <FormAlert state={state} />
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => setShown(false)}>
            {keepLabel}
          </Button>
          <SubmitButton variant="danger">{deleteLabel}</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}
