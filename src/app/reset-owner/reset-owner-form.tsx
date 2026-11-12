'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { useFocusFirstInvalid } from '@/components/use-focus-first-invalid';
import { initialFormState } from '@/lib/form-state';
import { resetOwnerAction } from './actions';

export function ResetOwnerForm() {
  const [state, action] = useActionState(resetOwnerAction, initialFormState);
  const formRef = useFocusFirstInvalid(state);

  if (state.done) {
    return (
      <div role="status" className="flex flex-col gap-4">
        <p className="text-ink">
          The owner password is changed and the owner is signed out everywhere. You can remove
          OWNER_RESET_TOKEN from the .env file now.
        </p>
        <Link href="/login" className="inline-flex min-h-11 items-center self-start">
          Sign in with the new password
        </Link>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      <FormAlert state={state} />
      <Field
        label="Reset token"
        hint="Each token works once, and using it signs the owner out on every device."
        name="token"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        error={state.fieldErrors?.token}
      />
      <Field
        label="New password"
        hint="At least 8 characters."
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
      <SubmitButton className="mt-1 w-full">Reset owner password</SubmitButton>
    </form>
  );
}
