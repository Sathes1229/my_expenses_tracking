'use client';

import { ErrorState } from '@/components/error-state';

/** Shown when loading the debts or saving a change fails unexpectedly. */
export default function DebtsError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="max-w-3xl">
      <ErrorState title="Could not load the debts." retry={retry}>
        If trying again does not help, restart My Expenses on the computer it runs on.
      </ErrorState>
    </div>
  );
}
