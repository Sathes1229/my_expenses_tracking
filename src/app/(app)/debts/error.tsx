'use client';

import { ErrorState } from '@/components/error-state';
import { useMessages } from '@/i18n/client';

/** Shown when loading the debts or saving a change fails unexpectedly. */
export default function DebtsError({ retry }: { error: unknown; retry: () => void }) {
  const { common, debts: t } = useMessages();
  return (
    <div className="max-w-3xl">
      <ErrorState title={t.errorTitle} retry={retry}>
        {common.errorRestart}
      </ErrorState>
    </div>
  );
}
