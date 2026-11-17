'use client';

import { useActionState } from 'react';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { useFocusFirstInvalid } from '@/components/use-focus-first-invalid';
import { useMessages } from '@/i18n/client';
import { initialFormState } from '@/lib/form-state';
import { createOwnerAction } from './actions';

export function SetupForm() {
  const [state, action] = useActionState(createOwnerAction, initialFormState);
  const formRef = useFocusFirstInvalid(state);
  const errors = state.fieldErrors;
  const t = useMessages().auth;

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      <FormAlert state={state} />
      <Field
        label={t.fields.yourName}
        hint={t.fields.yourNameHint}
        name="displayName"
        autoComplete="name"
        defaultValue={state.values?.displayName}
        error={errors?.displayName}
      />
      <Field
        label={t.fields.username}
        hint={t.fields.usernameHint}
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        defaultValue={state.values?.username}
        error={errors?.username}
      />
      <Field
        label={t.fields.password}
        hint={t.fields.passwordHint}
        name="password"
        type="password"
        autoComplete="new-password"
        error={errors?.password}
      />
      <Field
        label={t.fields.repeatPassword}
        name="confirm"
        type="password"
        autoComplete="new-password"
        error={errors?.confirm}
      />
      <SubmitButton className="mt-1 w-full">{t.setup.submit}</SubmitButton>
    </form>
  );
}
