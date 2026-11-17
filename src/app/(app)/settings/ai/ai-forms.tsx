'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/button';
import { Dialog } from '@/components/dialog';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { Select } from '@/components/select';
import { SubmitButton } from '@/components/submit-button';
import { useFocusFirstInvalid } from '@/components/use-focus-first-invalid';
import { useMessages } from '@/i18n/client';
import { initialFormState, type FormState } from '@/lib/form-state';
import { resetUsageAction, saveBudgetAction, saveModelsAction } from './actions';

/** A model as the picker needs it: no prices, no keys. */
export type ModelOption = { id: string; label: string };

function Saved({ state, text }: { state: FormState; text: string }) {
  return (
    <p role="status" className="text-sm text-muted">
      {state.done ? text : ''}
    </p>
  );
}

export function ModelsForm({
  chatOptions,
  receiptOptions,
  chatModel,
  receiptModel,
}: {
  chatOptions: ModelOption[];
  receiptOptions: ModelOption[];
  chatModel: string | null;
  receiptModel: string | null;
}) {
  const [state, action] = useActionState(saveModelsAction, initialFormState);
  const t = useMessages().ai;
  const formRef = useFocusFirstInvalid(state);
  const errors = state.fieldErrors;
  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      <FormAlert state={state} />
      <Select
        label={t.assistantModel}
        hint={t.assistantHint}
        name="chatModel"
        defaultValue={state.values?.chatModel ?? chatModel ?? ''}
        error={errors?.chatModel}
      >
        <option value="">{t.notChosen}</option>
        {chatOptions.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label}
          </option>
        ))}
      </Select>
      <Select
        label={t.receiptModel}
        hint={t.receiptHint}
        name="receiptModel"
        defaultValue={state.values?.receiptModel ?? receiptModel ?? ''}
        error={errors?.receiptModel}
      >
        <option value="">{t.notChosen}</option>
        {receiptOptions.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label}
          </option>
        ))}
      </Select>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SubmitButton>{t.saveModels}</SubmitButton>
        <Saved state={state} text={t.modelsSaved} />
      </div>
    </form>
  );
}

export function BudgetForm({ dailyBudget }: { dailyBudget: string }) {
  const [state, action] = useActionState(saveBudgetAction, initialFormState);
  const t = useMessages().ai;
  const formRef = useFocusFirstInvalid(state);
  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      <Field
        label={t.limitLabel}
        hint={t.limitHint}
        name="dailyBudget"
        inputMode="decimal"
        autoComplete="off"
        className="max-w-48"
        defaultValue={state.values?.dailyBudget ?? dailyBudget}
        error={state.fieldErrors?.dailyBudget}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SubmitButton>{t.saveLimit}</SubmitButton>
        <Saved state={state} text={t.limitSaved} />
      </div>
    </form>
  );
}

/**
 * Resets today's assistant usage after a confirmation. The button only shows while something has
 * been used; once the reset is done it goes, so focus moves to the line saying it worked.
 */
export function ResetUsage({ canReset }: { canReset: boolean }) {
  const [state, action] = useActionState(resetUsageAction, initialFormState);
  const t = useMessages().ai;
  // The dialog stays open until the action answers: each answer moves `attempt` on, which closes it.
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const open = openedAt === state.attempt;
  const setOpen = (value: boolean) => setOpenedAt(value ? state.attempt : null);
  const doneRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.done) doneRef.current?.focus();
  }, [state]);
  return (
    <div className="flex flex-col items-start gap-2">
      {canReset && (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          {t.resetUsage}
        </Button>
      )}
      <p ref={doneRef} tabIndex={-1} role="status" className="text-sm text-muted">
        {state.done ? t.resetDone : ''}
      </p>
      {open && (
        <Dialog open onClose={() => setOpen(false)} title={t.resetTitle}>
          <form action={action} className="flex flex-col gap-4">
            <p className="text-muted">{t.resetBody}</p>
            <div className="mt-2 flex flex-wrap justify-end gap-3">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {t.keep}
              </Button>
              <SubmitButton>{t.resetConfirm}</SubmitButton>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
