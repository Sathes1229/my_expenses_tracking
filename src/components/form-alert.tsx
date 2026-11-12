import type { FormState } from '@/lib/form-state';

/** The form-wide message. Keyed by attempt so a screen reader announces a repeat failure too. */
export function FormAlert({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p
      key={state.attempt}
      role="alert"
      className="rounded-control border border-danger bg-surface px-3 py-2.5 text-sm font-medium text-danger"
    >
      {state.message}
    </p>
  );
}
