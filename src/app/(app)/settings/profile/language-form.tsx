'use client';

import { useActionState } from 'react';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { useLocale, useMessages } from '@/i18n/client';
import type { Locale } from '@/i18n/locale';
import { initialFormState } from '@/lib/form-state';
import { setLanguageAction } from './actions';

export function LanguageForm() {
  const [state, action] = useActionState(setLanguageAction, initialFormState);
  const locale = useLocale();
  const t = useMessages().profile.language;
  const choices: { value: Locale; label: string }[] = [
    { value: 'ms', label: t.malay },
    { value: 'en', label: t.english },
  ];
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormAlert state={state} />
      <fieldset>
        <legend className="sr-only">{t.heading}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {choices.map((choice) => (
            <label
              key={choice.value}
              // Each language names itself in its own words, so either reader finds theirs.
              lang={choice.value}
              className="flex min-h-11 items-center gap-3 rounded-control border border-line-strong bg-surface px-3 py-2.5 transition-state hover:bg-sunken has-checked:border-ink has-checked:bg-sunken"
            >
              <input
                type="radio"
                name="locale"
                value={choice.value}
                defaultChecked={choice.value === locale}
                className="size-4 shrink-0 accent-ink"
              />
              <span className="font-medium text-ink">{choice.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SubmitButton>{t.save}</SubmitButton>
        <p role="status" className="text-sm text-muted">
          {state.done ? t.saved : ''}
        </p>
      </div>
    </form>
  );
}
