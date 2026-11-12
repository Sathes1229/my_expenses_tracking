'use client';

import { useActionState } from 'react';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { useFocusFirstInvalid } from '@/components/use-focus-first-invalid';
import { initialFormState, type FormState } from '@/lib/form-state';
import { changePasswordAction, updateNameAction } from './actions';

/** "Saved." beside the button after a successful submit, announced to screen readers. */
function Saved({ state, text }: { state: FormState; text: string }) {
  return (
    <p role="status" className="text-sm text-muted">
      {state.done ? text : ''}
    </p>
  );
}

export function NameForm({ displayName }: { displayName: string }) {
  const [state, action] = useActionState(updateNameAction, initialFormState);
  const formRef = useFocusFirstInvalid(state);
  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      <Field
        label="Display name"
        hint="Shown to everyone in the household. Up to 40 characters."
        name="displayName"
        autoComplete="name"
        defaultValue={state.values?.displayName ?? displayName}
        error={state.fieldErrors?.displayName}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SubmitButton>Save name</SubmitButton>
        <Saved state={state} text="Name saved." />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initialFormState);
  const formRef = useFocusFirstInvalid(state);
  const errors = state.fieldErrors;
  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      <FormAlert state={state} />
      <Field
        label="Current password"
        name="current"
        type="password"
        autoComplete="current-password"
        error={errors?.current}
      />
      <Field
        label="New password"
        hint="At least 8 characters."
        name="password"
        type="password"
        autoComplete="new-password"
        error={errors?.password}
      />
      <Field
        label="Repeat new password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        error={errors?.confirm}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SubmitButton>Change password</SubmitButton>
        <Saved state={state} text="Password changed. Your other devices are signed out." />
      </div>
    </form>
  );
}
