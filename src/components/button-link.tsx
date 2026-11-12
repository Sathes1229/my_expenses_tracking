import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cx } from './cx';

type Variant = 'primary' | 'secondary';

const look: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-hover',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-sunken active:bg-sunken',
};

/** A link that looks like a Button: for moving to another page, where a <button> would be wrong. */
export function ButtonLink({ variant = 'primary', className, ...rest }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link
      className={cx(
        'inline-flex min-h-11 items-center justify-center rounded-control px-4 py-2 text-center text-base font-medium no-underline transition-state',
        look[variant],
        className,
      )}
      {...rest}
    />
  );
}
