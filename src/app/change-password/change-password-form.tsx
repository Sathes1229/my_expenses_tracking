'use client';

import { useActionState } from 'react';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { useFocusFirstInvalid } from '@/components/use-focus-first-invalid';
import { useMessages } from '@/i18n/client';
import { initialFormState } from '@/lib/form-state';
import { changePasswordAction } from './actions';

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initialFormState);
  const formRef = useFocusFirstInvalid(state);
  const t = useMessages().auth;

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      <FormAlert state={state} />
      <Field
        label={t.fields.newPassword}
        hint={t.changePassword.passwordHint}
        name="password"
        type="password"
        autoComplete="new-password"
        error={state.fieldErrors?.password}
      />
      <Field
        label={t.fields.repeatNewPassword}
        name="confirm"
        type="password"
        autoComplete="new-password"
        error={state.fieldErrors?.confirm}
      />
      <SubmitButton className="mt-1 w-full">{t.changePassword.submit}</SubmitButton>
    </form>
  );
}
