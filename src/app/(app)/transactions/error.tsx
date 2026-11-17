'use client';

import { ErrorState } from '@/components/error-state';
import { useMessages } from '@/i18n/client';

/** Shown when loading transactions or saving one fails unexpectedly. */
export default function TransactionsError({ retry }: { error: unknown; retry: () => void }) {
  const { common, transactions: t } = useMessages();
  return (
    <div className="max-w-3xl">
      <ErrorState title={t.errorTitle} retry={retry}>
        {common.errorRestart}
      </ErrorState>
    </div>
  );
}
