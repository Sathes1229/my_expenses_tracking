'use client';

import { useId, type SelectHTMLAttributes } from 'react';
import { controlClass, controlProps, FieldShell } from './field';

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
};

/**
 * A native select with its label. Native, so phones show their own picker and the
 * keyboard works as people expect. Pass <option> elements as children.
 */
export function Select({ label, hint, error, id, className, children, ...select }: SelectProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={className}>
      {/* React applies a select's defaultValue only when it mounts, and a form reset after an action
          restores that first value. Keying on it remounts the select whenever the page sends a new one. */}
      <select
        key={String(select.defaultValue ?? '')}
        {...select}
        {...controlProps(fieldId, { hint, error })}
        className={controlClass(error)}
      >
        {children}
      </select>
    </FieldShell>
  );
}
