'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from './button';
import { cx } from './cx';
import { controlClass, controlProps, FieldShell } from './field';

type CopyFieldProps = {
  label: string;
  value: string;
  hint?: string;
  /** Monospace, for text people read out or type by hand, where 1 and l must not look alike. */
  mono?: boolean;
  /** Focus and select the value when it appears, so it can be copied straight away. */
  autoFocus?: boolean;
};

/**
 * A value shown once, with a Copy button. The clipboard API only exists on https and localhost,
 * and the app is often opened over plain http on the home network, so it falls back to selecting
 * the text and the older copy command, and says so when neither works.
 */
export function CopyField({ label, value, hint, mono = false, autoFocus = false }: CopyFieldProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [autoFocus, value]);

  async function copy() {
    if (window.isSecureContext && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(value);
        setStatus('Copied.');
        return;
      } catch {
        // Permission refused: try the fallback below.
      }
    }
    inputRef.current?.focus();
    inputRef.current?.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    setStatus(copied ? 'Copied.' : 'Could not copy here. The text is selected: copy it with your keyboard or a long press.');
  }

  return (
    <FieldShell id={id} label={label} hint={hint}>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          readOnly
          value={value}
          onFocus={(event) => event.currentTarget.select()}
          {...controlProps(id, { hint })}
          className={cx(controlClass(), 'flex-1', mono && 'font-mono tracking-wide')}
        />
        <Button variant="secondary" onClick={copy} className="shrink-0">
          Copy
        </Button>
      </div>
      <p aria-live="polite" className="min-h-5 text-sm text-muted">
        {status}
      </p>
    </FieldShell>
  );
}
