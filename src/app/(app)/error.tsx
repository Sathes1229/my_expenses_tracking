'use client';

import { ErrorState } from '@/components/error-state';

/**
 * Shown inside the signed-in shell when the home page cannot load a month. The other sections
 * (budgets, transactions, debts, settings, notifications) have their own boundaries.
 */
export default function HomeError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="max-w-3xl">
      <ErrorState title="Could not load this month's summary." retry={retry}>
        If trying again does not help, restart My Expenses on the computer it runs on.
      </ErrorState>
    </div>
  );
}
