'use client';

import { useActionState } from 'react';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { useFocusFirstInvalid } from '@/components/use-focus-first-invalid';
import { useMessages } from '@/i18n/client';
import { fmt } from '@/i18n/format';
import { initialFormState } from '@/lib/form-state';
import { STARTER_KEYS } from '@/lib/starter-keys';
import { createStarterBudgetsAction } from './actions';

/**
 * For a household with no budgets at all: common Malaysian budgets to tick, each with a monthly
 * amount. The names go in the owner's language and are stored as written, like any budget name.
 */
export function StarterBudgets() {
  const [state, action] = useActionState(createStarterBudgetsAction, initialFormState);
  const formRef = useFocusFirstInvalid(state);
  const t = useMessages().starter;
  const picked = new Set((state.values?.pick ?? '').split(',').filter(Boolean));
  const pickError = state.fieldErrors?.pick;
  return (
    <section aria-labelledby="starter-heading" className="rounded-surface border border-line bg-surface px-4 py-5">
      <h2 id="starter-heading" className="text-lg font-semibold text-ink">
        {t.title}
      </h2>
      <p className="mt-1 text-muted">{t.intro}</p>
      <form ref={formRef} action={action} noValidate className="mt-4 flex flex-col gap-4">
        <FormAlert state={state} />
        <fieldset aria-describedby={pickError ? 'starter-pick-error' : undefined}>
          <legend className="sr-only">{t.choose}</legend>
          {pickError && (
            <p id="starter-pick-error" className="mb-2 text-sm font-medium text-danger">
              {pickError}
            </p>
          )}
          <ul className="flex flex-col divide-y divide-line">
            {STARTER_KEYS.map((key) => {
              const name = t.names[key];
              return (
                <li key={key} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-end">
                  <label className="flex min-h-11 items-center gap-3">
                    <input
                      type="checkbox"
                      name="pick"
                      value={key}
                      defaultChecked={picked.has(key)}
                      aria-invalid={pickError ? true : undefined}
                      className="size-5 shrink-0 accent-ink"
                    />
                    <span className="font-medium break-words text-ink">{name}</span>
                  </label>
                  <input type="hidden" name={`name_${key}`} value={name} />
                  <Field
                    label={fmt(t.amountFor, { name })}
                    name={`amount_${key}`}
                    inputMode="decimal"
                    autoComplete="off"
                    defaultValue={state.values?.[`amount_${key}`] ?? ''}
                    error={state.fieldErrors?.[`amount_${key}`]}
                  />
                </li>
              );
            })}
          </ul>
        </fieldset>
        <SubmitButton className="self-start">{t.create}</SubmitButton>
      </form>
    </section>
  );
}
