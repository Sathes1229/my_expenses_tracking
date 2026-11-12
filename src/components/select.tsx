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
      <select {...select} {...controlProps(fieldId, { hint, error })} className={controlClass(error)}>
        {children}
      </select>
    </FieldShell>
  );
}
