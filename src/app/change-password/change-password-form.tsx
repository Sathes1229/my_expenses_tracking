'use client';

import { useActionState } from 'react';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { useFocusFirstInvalid } from '@/components/use-focus-first-invalid';
import { initialFormState } from '@/lib/form-state';
import { changePasswordAction } from './actions';

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initialFormState);
  const formRef = useFocusFirstInvalid(state);

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      <FormAlert state={state} />
      <Field
        label="New password"
        hint="At least 8 characters, not the temporary one."
        name="password"
        type="password"
        autoComplete="new-password"
        error={state.fieldErrors?.password}
      />
      <Field
        label="Repeat new password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        error={state.fieldErrors?.confirm}
      />
      <SubmitButton className="mt-1 w-full">Save password</SubmitButton>
    </form>
  );
}
