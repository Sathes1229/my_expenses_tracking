import type { ReactNode } from 'react';

type EmptyStateProps = {
  /** Why the view is empty, as a sentence: "No budgets yet." */
  title: string;
  /** The one action that fills it, usually a Button or a link. */
  action?: ReactNode;
  /** Optional second line: what will appear here once there is something. */
  children?: ReactNode;
};

export function EmptyState({ title, action, children }: EmptyStateProps) {
  return (
    <div className="rounded-surface border border-line bg-surface px-5 py-6">
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 text-muted">{children}</div>}
      {action && <div className="mt-4 flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}
