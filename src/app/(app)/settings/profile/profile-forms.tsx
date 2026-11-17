'use client';

import { useActionState } from 'react';
import { Field } from '@/components/field';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { useFocusFirstInvalid } from '@/components/use-focus-first-invalid';
import { useMessages } from '@/i18n/client';
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
  const t = useMessages().profile;
  const formRef = useFocusFirstInvalid(state);
  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      <Field
        label={t.displayName}
        hint={t.displayNameHint}
        name="displayName"
        autoComplete="name"
        defaultValue={state.values?.displayName ?? displayName}
        error={state.fieldErrors?.displayName}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SubmitButton>{t.saveName}</SubmitButton>
        <Saved state={state} text={t.nameSaved} />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initialFormState);
  const { auth, profile: t } = useMessages();
  const formRef = useFocusFirstInvalid(state);
  const errors = state.fieldErrors;
  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      <FormAlert state={state} />
      <Field
        label={t.currentPassword}
        name="current"
        type="password"
        autoComplete="current-password"
        error={errors?.current}
      />
      <Field
        label={auth.fields.newPassword}
        hint={auth.fields.passwordHint}
        name="password"
        type="password"
        autoComplete="new-password"
        error={errors?.password}
      />
      <Field
        label={auth.fields.repeatNewPassword}
        name="confirm"
        type="password"
        autoComplete="new-password"
        error={errors?.confirm}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SubmitButton>{t.changePassword}</SubmitButton>
        <Saved state={state} text={t.passwordChanged} />
      </div>
    </form>
  );
}
