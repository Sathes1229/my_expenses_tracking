'use client';

import { useActionState } from 'react';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { useFocusFirstInvalid } from '@/components/use-focus-first-invalid';
import { initialFormState } from '@/lib/form-state';
import { acceptInviteAction } from './actions';

export function InviteForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInviteAction, initialFormState);
  const formRef = useFocusFirstInvalid(state);
  const errors = state.fieldErrors;

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      <FormAlert state={state} />
      <input type="hidden" name="token" value={token} />
      <Field
        label="Your name"
        hint="Shown to everyone in the household."
        name="displayName"
        autoComplete="name"
        defaultValue={state.values?.displayName}
        error={errors?.displayName}
      />
      <Field
        label="Username"
        hint="You sign in with this. 3 to 30 characters: letters, numbers, dots or underscores."
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        defaultValue={state.values?.username}
        error={errors?.username}
      />
      <Field
        label="Password"
        hint="At least 8 characters."
        name="password"
        type="password"
        autoComplete="new-password"
        error={errors?.password}
      />
      <Field
        label="Repeat password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        error={errors?.confirm}
      />
      <SubmitButton className="mt-1 w-full">Create my account</SubmitButton>
    </form>
  );
}
