'use client';

import type { ButtonHTMLAttributes, MouseEvent } from 'react';
import { cx } from './cx';

type Variant = 'primary' | 'secondary' | 'danger' | 'quiet';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** primary: the one main action on a screen. danger: destructive confirmations. quiet: low-emphasis actions. */
  variant?: Variant;
  /**
   * The action is running. Presses are ignored and a busy mark shows, but the button stays
   * focusable (aria-disabled, not disabled) so keyboard users do not lose their place.
   */
  pending?: boolean;
};

// rest: always. live: hover and press, only while enabled and not pending. off: native disabled.
const look: Record<Variant, { rest: string; live: string; off: string }> = {
  primary: {
    rest: 'px-4 bg-accent text-on-accent',
    live: 'enabled:hover:bg-accent-hover enabled:active:bg-accent-hover',
    off: 'disabled:bg-sunken disabled:text-muted',
  },
  secondary: {
    rest: 'border border-line-strong bg-surface px-4 text-ink',
    live: 'enabled:hover:bg-sunken enabled:active:bg-sunken',
    off: 'disabled:border-line disabled:bg-sunken disabled:text-muted',
  },
  danger: {
    rest: 'bg-danger px-4 text-on-danger',
    live: 'enabled:hover:bg-danger-hover enabled:active:bg-danger-hover',
    off: 'disabled:bg-sunken disabled:text-muted',
  },
  quiet: {
    rest: 'px-3 text-ink underline-offset-4',
    live: 'enabled:hover:bg-sunken enabled:hover:underline enabled:active:bg-sunken',
    off: 'disabled:text-muted',
  },
};

export function Button({
  variant = 'primary',
  pending = false,
  type = 'button',
  className,
  onClick,
  children,
  ...rest
}: ButtonProps) {
  const v = look[variant];

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (pending) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      type={type}
      aria-disabled={pending || undefined}
      onClick={handleClick}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-control py-2 text-center text-base font-medium transition-state',
        v.rest,
        v.off,
        pending ? 'cursor-progress' : cx(v.live, 'enabled:active:translate-y-px'),
        className,
      )}
      {...rest}
    >
      {pending && (
        <span
          aria-hidden="true"
          className="size-4 shrink-0 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin"
        />
      )}
      {children}
    </button>
  );
}
