'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/button';
import { Dialog } from '@/components/dialog';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { useFocusFirstInvalid } from '@/components/use-focus-first-invalid';
import { initialFormState, type FormState } from '@/lib/form-state';
import { formatRM, parseRM } from '@/lib/money';
import { archiveBudgetAction, createBudgetAction, updateBudgetAction } from './actions';

/** What the owner can change on one budget, as the page read it from the server. */
export type EditableBudget = { id: string; name: string; allocationSen: number; thresholdPct: number };

const input = (sen: number) => (sen / 100).toFixed(2);

/** Whole sen at which a budget turns "Near limit": the smallest amount whose share reaches the threshold. */
function nearLimitSen(allocationSen: number, thresholdPct: number): number {
  return Math.floor((allocationSen * thresholdPct + 99) / 100);
}

/** Closes the dialog (so the browser puts focus back on its button) once the action reports success. */
function useCloseOnDone(state: FormState, close: () => void) {
  useEffect(() => {
    if (state.done) close();
    // close only flips local state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

function BudgetFields({ state, initial }: { state: FormState; initial?: EditableBudget }) {
  const errors = state.fieldErrors;
  const [allocation, setAllocation] = useState(state.values?.allocation ?? (initial ? input(initial.allocationSen) : ''));
  const [threshold, setThreshold] = useState(state.values?.threshold ?? String(initial?.thresholdPct ?? 80));

  const sen = allocation.trim() ? parseRM(allocation) : null;
  const pct = /^\d{1,3}$/.test(threshold.trim()) ? Number(threshold) : NaN;
  const worth =
    sen !== null && pct >= 1 && pct <= 100
      ? `${pct}% of ${formatRM(sen)} is ${formatRM(nearLimitSen(sen, pct))}. It shows Near limit from there.`
      : 'Enter the amount and a level from 1 to 100 to see what it comes to.';

  return (
    <>
      <Field
        label="Name"
        name="name"
        defaultValue={state.values?.name ?? initial?.name ?? ''}
        error={errors?.name}
        maxLength={60}
        autoComplete="off"
      />
      <Field
        label="Amount per month (RM)"
        hint={initial ? 'A new amount applies from this month. Earlier months keep theirs.' : 'Applies from this month.'}
        name="allocation"
        inputMode="decimal"
        autoComplete="off"
        value={allocation}
        onChange={(event) => setAllocation(event.target.value)}
        error={errors?.allocation}
      />
      <Field
        label="Near-limit level (%)"
        hint={worth}
        name="threshold"
        inputMode="numeric"
        autoComplete="off"
        value={threshold}
        onChange={(event) => setThreshold(event.target.value)}
        error={errors?.threshold}
      />
    </>
  );
}

function BudgetForm({
  title,
  submitLabel,
  initial,
  onClose,
}: {
  title: string;
  submitLabel: string;
  initial?: EditableBudget;
  onClose: () => void;
}) {
  const [state, action] = useActionState(initial ? updateBudgetAction : createBudgetAction, initialFormState);
  const formRef = useFocusFirstInvalid(state);
  const [shown, setShown] = useState(true);
  useCloseOnDone(state, () => setShown(false));
  return (
    <Dialog open={shown} onClose={onClose} title={title}>
      <form ref={formRef} action={action} noValidate className="flex flex-col gap-4">
        <FormAlert state={state} />
        {initial && <input type="hidden" name="budgetId" value={initial.id} />}
        <BudgetFields state={state} initial={initial} />
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
export function AddBudget({ variant = 'primary' }: { variant?: 'primary' | 'secondary' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        Add a budget
      </Button>
      {open && <BudgetForm title="Add a budget" submitLabel="Add budget" onClose={() => setOpen(false)} />}
    </>
  );
}

export function BudgetActions({ budget }: { budget: EditableBudget }) {
  return (
    <div className="-mx-3 flex flex-wrap gap-1">
      <EditBudget budget={budget} />
      <ArchiveBudget budget={budget} />
    </div>
  );
}

function EditBudget({ budget }: { budget: EditableBudget }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="quiet" onClick={() => setOpen(true)}>
        Edit
        <span className="sr-only"> {budget.name}</span>
      </Button>
      {open && (
        <BudgetForm
          title={`Edit ${budget.name}`}
          submitLabel="Save changes"
          initial={budget}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ArchiveBudget({ budget }: { budget: EditableBudget }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="quiet" onClick={() => setOpen(true)}>
        Archive
        <span className="sr-only"> {budget.name}</span>
      </Button>
      {open && <ArchiveDialog budget={budget} onClose={() => setOpen(false)} />}
    </>
  );
}

function ArchiveDialog({ budget, onClose }: { budget: EditableBudget; onClose: () => void }) {
  const [state, action] = useActionState(archiveBudgetAction, initialFormState);
  const [shown, setShown] = useState(true);
  useCloseOnDone(state, () => setShown(false));
  return (
    <Dialog open={shown} onClose={onClose} title={`Archive ${budget.name}?`}>
      <form action={action} className="flex flex-col gap-4">
        <p className="text-muted">
          It leaves this list and the budget pickers. Transactions already filed under it keep the name, so
          past months do not change. You can add a budget with the same name again later.
        </p>
        <FormAlert state={state} />
        <input type="hidden" name="budgetId" value={budget.id} />
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => setShown(false)}>
            Keep {budget.name}
          </Button>
          <SubmitButton variant="danger">Archive {budget.name}</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}
