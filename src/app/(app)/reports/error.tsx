'use client';

import { ErrorState } from '@/components/error-state';
import { useMessages } from '@/i18n/client';

/** Shown when loading the report fails unexpectedly. */
export default function ReportsError({ retry }: { error: unknown; retry: () => void }) {
  const t = useMessages().reports;
  return (
    <div className="max-w-3xl">
      <ErrorState title={t.errorTitle} retry={retry}>
        {t.errorBody}
      </ErrorState>
    </div>
  );
}
