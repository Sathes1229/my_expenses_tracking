'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/button';
import { Dialog } from '@/components/dialog';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { useFocusFirstInvalid } from '@/components/use-focus-first-invalid';
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
          label="Who you lent it to"
          name="personName"
          defaultValue={v('personName', initial?.personName ?? '')}
          error={errors?.personName}
          maxLength={60}
          autoComplete="off"
        />
        <Field
          label="Amount lent (RM)"
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={v('amount', initial ? input(initial.amountSen) : '')}
          error={errors?.amount}
        />
        <Field
          label="Date lent"
          name="lentOn"
          type="date"
          defaultValue={v('lentOn', initial?.lentOn ?? today)}
          error={errors?.lentOn}
        />
        <Field
          label="Due date (optional)"
          name="dueOn"
          type="date"
          defaultValue={v('dueOn', initial?.dueOn ?? '')}
          error={errors?.dueOn}
        />
        <Field
          label="Note (optional)"
          name="note"
          defaultValue={v('note', initial?.note ?? '')}
          error={errors?.note}
          maxLength={500}
          autoComplete="off"
        />
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => setShown(false)}>
            Cancel
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
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        Record a debt
      </Button>
      {open && <DebtForm title="Record a debt" submitLabel="Save debt" today={today} onClose={() => setOpen(false)} />}
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
  return (
    <>
      <Button variant="quiet" onClick={() => setOpen(true)}>
        Record a payment
        <span className="sr-only"> from {debt.personName}</span>
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
  const formRef = useFocusFirstInvalid(state);
  const [shown, setShown] = useState(true);
  useCloseOnDone(state, () => setShown(false));
  const errors = state.fieldErrors;
  return (
    <Dialog open={shown} onClose={onClose} title={`Payment from ${debt.personName}`}>
      <form ref={formRef} action={action} noValidate className="flex flex-col gap-4">
        <FormAlert state={state} />
        <input type="hidden" name="debtId" value={debt.id} />
        <Field
          label="Amount paid (RM)"
          hint={`Still owed: ${formatRM(outstandingSen)}`}
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          defaultValue={state.values?.amount ?? ''}
          error={errors?.amount}
        />
        <Field
          label="Date paid"
          name="paidOn"
          type="date"
          defaultValue={state.values?.paidOn ?? today}
          error={errors?.paidOn}
        />
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => setShown(false)}>
            Cancel
          </Button>
          <SubmitButton>Save payment</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}

function EditDebt({ debt, today }: { debt: EditableDebt; today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="quiet" onClick={() => setOpen(true)}>
        Edit
        <span className="sr-only"> debt of {debt.personName}</span>
      </Button>
      {open && (
        <DebtForm
          title={`Edit debt of ${debt.personName}`}
          submitLabel="Save changes"
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
  return (
    <>
      <Button variant="quiet" onClick={() => setOpen(true)}>
        Delete
        <span className="sr-only"> debt of {debt.personName}</span>
      </Button>
      {open && (
        <ConfirmDialog
          title={`Delete this debt of ${formatRM(debt.amountSen)}?`}
          body="This removes the debt and every payment recorded against it. This cannot be undone."
          keepLabel="Keep it"
          deleteLabel="Delete debt"
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
  return (
    <>
      <Button variant="quiet" onClick={() => setOpen(true)}>
        Remove
        <span className="sr-only"> payment of {label}</span>
      </Button>
      {open && (
        <ConfirmDialog
          title={`Remove the payment of ${label}?`}
          body="The amount counts as owed again. This cannot be undone."
          keepLabel="Keep it"
          deleteLabel="Remove payment"
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
