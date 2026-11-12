import { useEffect, useRef } from 'react';
import type { FormState } from '@/lib/form-state';

/**
 * After a failed submit, moves focus to the first field marked invalid, so its label and error
 * are read out. Attach the returned ref to the <form>.
 */
export function useFocusFirstInvalid(state: FormState) {
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state.fieldErrors) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);
  return formRef;
}
