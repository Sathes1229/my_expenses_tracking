'use client';

import { ErrorState } from '@/components/error-state';
import { useMessages } from '@/i18n/client';

/** Shown when the conversation cannot be loaded or cleared. */
export default function AssistantError({ retry }: { error: unknown; retry: () => void }) {
  const { common, assistant: t } = useMessages();
  return (
    <div className="max-w-3xl">
      <ErrorState title={t.errorTitle} retry={retry}>
        {common.errorRestart}
      </ErrorState>
    </div>
  );
}
