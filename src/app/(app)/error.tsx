'use client';

import { ErrorState } from '@/components/error-state';
import { useMessages } from '@/i18n/client';

/**
 * Shown inside the signed-in shell when the home page cannot load a month. The other sections
 * (budgets, transactions, debts, settings, notifications) have their own boundaries.
 */
export default function HomeError({ retry }: { error: unknown; retry: () => void }) {
  const { common, home: t } = useMessages();
  return (
    <div className="max-w-3xl">
      <ErrorState title={t.errorTitle} retry={retry}>
        {common.errorRestart}
      </ErrorState>
    </div>
  );
}
