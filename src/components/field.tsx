'use client';

import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from './cx';

type LabelledProps = {
  /** Always shown above the control. Never replaced by a placeholder. */
  label: string;
  /** One line that helps fill the field in, shown under the label. */
  hint?: string;
  /** What is wrong and how to fix it. Shown above the control so the phone keyboard cannot cover it. */
  error?: string;
};

/** Label, hint and error around one control. Shared by Field and Select. */
export function FieldShell({
  id,
  label,
  hint,
  error,
  className,
  children,
}: LabelledProps & { id: string; className?: string; children: ReactNode }) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-danger">
          <span className="sr-only">Error: </span>
          {error}
        </p>
      )}
      {children}
    </div>
  );
}

/** Props every labelled control passes to its element. */
export function controlProps(id: string, { hint, error }: Pick<LabelledProps, 'hint' | 'error'>) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ');
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
  } as const;
}

/** Look shared by text inputs and selects: 44px tall, 16px text so phones do not zoom in. */
export function controlClass(error?: string) {
  return cx(
    'block min-h-11 w-full min-w-0 rounded-control border bg-surface px-3 text-base text-ink transition-state',
    'placeholder:text-muted enabled:hover:border-ink disabled:bg-sunken disabled:text-muted',
    error ? 'border-danger' : 'border-line-strong',
  );
}

export type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> &
  LabelledProps & { id?: string };

/** A text-like input with its label. `className` styles the wrapper, for layout. */
export function Field({ label, hint, error, id, className, ...input }: FieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={className}>
      <input {...input} {...controlProps(fieldId, { hint, error })} className={controlClass(error)} />
    </FieldShell>
  );
}
