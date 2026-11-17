'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { useFocusFirstInvalid } from '@/components/use-focus-first-invalid';
import { useMessages } from '@/i18n/client';
import { initialFormState } from '@/lib/form-state';
import { resetOwnerAction } from './actions';

export function ResetOwnerForm() {
  const [state, action] = useActionState(resetOwnerAction, initialFormState);
  const formRef = useFocusFirstInvalid(state);
  const t = useMessages().auth;

  if (state.done) {
    return (
      <div role="status" className="flex flex-col gap-4">
        <p className="text-ink">{t.resetOwner.done}</p>
        <Link href="/login" className="inline-flex min-h-11 items-center self-start">
          {t.resetOwner.signInWithNew}
        </Link>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      <FormAlert state={state} />
      <Field
        label={t.resetOwner.token}
        hint={t.resetOwner.tokenHint}
        name="token"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        error={state.fieldErrors?.token}
      />
      <Field
        label={t.fields.newPassword}
        hint={t.fields.passwordHint}
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
      <SubmitButton className="mt-1 w-full">{t.resetOwner.submit}</SubmitButton>
    </form>
  );
}
