'use client';

import { useActionState } from 'react';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { useFocusFirstInvalid } from '@/components/use-focus-first-invalid';
import { initialFormState } from '@/lib/form-state';
import { signInAction } from './actions';

export function LoginForm() {
  const [state, action] = useActionState(signInAction, initialFormState);
  const formRef = useFocusFirstInvalid(state);

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      <FormAlert state={state} />
      <Field
        label="Username"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        defaultValue={state.values?.username}
        error={state.fieldErrors?.username}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        error={state.fieldErrors?.password}
      />
      <SubmitButton className="mt-1 w-full">Sign in</SubmitButton>
    </form>
  );
}
