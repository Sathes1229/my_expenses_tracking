/** What a form's server action returns to useActionState. Plain module: client forms import it too. */
export type FormState = {
  /** Counts submissions, so a repeated message is announced again. */
  attempt: number;
  /** One message for the whole form, shown above the fields. */
  message?: string;
  /** Per-field messages, keyed by the input's name. */
  fieldErrors?: Record<string, string>;
  /** Text fields to put back after a failed submit. Never passwords. */
  values?: Record<string, string>;
  done?: boolean;
};

export const initialFormState: FormState = { attempt: 0 };

export function nextFormState(prev: FormState, patch: Omit<FormState, 'attempt'>): FormState {
  return { attempt: prev.attempt + 1, ...patch };
}

export function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

/** For the "Repeat password" field; silent while the first password is still empty. */
export function repeatError(password: string, repeat: string): string | null {
  if (!password) return null;
  if (!repeat) return 'Type the password again.';
  return repeat === password ? null : 'The two passwords are not the same.';
}

/** "1 minute", "15 minutes": always rounded up, so people never come back too early. */
export function waitText(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}
