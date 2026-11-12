import type { ReactNode } from 'react';
import { Button } from './button';

type ErrorStateProps = {
  /** What failed, in plain words: "Could not load this month's budgets." */
  title: string;
  /** Called by the "Try again" button. Without it there is no button. */
  retry?: () => void;
  /** Optional second line: what the person can do if trying again does not help. */
  children?: ReactNode;
};

export function ErrorState({ title, retry, children }: ErrorStateProps) {
  return (
    <div role="alert" className="rounded-surface border border-danger bg-surface px-5 py-6">
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 text-muted">{children}</div>}
      {retry && (
        <Button variant="secondary" onClick={retry} className="mt-4">
          Try again
        </Button>
      )}
    </div>
  );
}
