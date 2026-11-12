'use client';

import { useActionState } from 'react';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { Select } from '@/components/select';
import { SubmitButton } from '@/components/submit-button';
import { useFocusFirstInvalid } from '@/components/use-focus-first-invalid';
import { initialFormState, type FormState } from '@/lib/form-state';
import { saveBudgetAction, saveModelsAction } from './actions';

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
  const formRef = useFocusFirstInvalid(state);
  const errors = state.fieldErrors;
  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      <FormAlert state={state} />
      <Select
        label="Assistant"
        hint="Answers questions about your spending."
        name="chatModel"
        defaultValue={state.values?.chatModel ?? chatModel ?? ''}
        error={errors?.chatModel}
      >
        <option value="">Not chosen</option>
        {chatOptions.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label}
          </option>
        ))}
      </Select>
      <Select
        label="Receipt reading"
        hint="Reads a photo of a receipt. Only models that can read images are listed. DeepSeek cannot read images."
        name="receiptModel"
        defaultValue={state.values?.receiptModel ?? receiptModel ?? ''}
        error={errors?.receiptModel}
      >
        <option value="">Not chosen</option>
        {receiptOptions.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label}
          </option>
        ))}
      </Select>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SubmitButton>Save models</SubmitButton>
        <Saved state={state} text="Models saved." />
      </div>
    </form>
  );
}

export function BudgetForm({ dailyBudget }: { dailyBudget: string }) {
  const [state, action] = useActionState(saveBudgetAction, initialFormState);
  const formRef = useFocusFirstInvalid(state);
  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      <Field
        label="Daily limit in US dollars"
        hint="From 0.01 to 1000, for example 2.50."
        name="dailyBudget"
        inputMode="decimal"
        autoComplete="off"
        className="max-w-48"
        defaultValue={state.values?.dailyBudget ?? dailyBudget}
        error={state.fieldErrors?.dailyBudget}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SubmitButton>Save limit</SubmitButton>
        <Saved state={state} text="Limit saved." />
      </div>
    </form>
  );
}
