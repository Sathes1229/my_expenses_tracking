import type { ReactNode } from 'react';

/**
 * The page's only h1, with an optional action beside it (the action wraps under the title
 * on narrow screens). Kept smaller than the focal amount, which is the real centre of a screen.
 */
export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <h1 className="text-2xl font-semibold text-ink">{title}</h1>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
