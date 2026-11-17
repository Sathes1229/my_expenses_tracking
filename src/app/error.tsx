'use client';

import { AuthFrame } from '@/components/auth-frame';
import { ErrorState } from '@/components/error-state';
import { useMessages } from '@/i18n/client';

/**
 * The fallback for any page without a closer error boundary: sign in, setup, password pages and
 * the signed-in shell itself. The error itself is never shown; it can hold details meant only for the server log.
 */
export default function RootError({ retry }: { error: unknown; retry: () => void }) {
  const t = useMessages().auth.error;
  return (
    <AuthFrame title={t.heading}>
      <ErrorState title={t.title} retry={retry}>
        {t.body}
      </ErrorState>
    </AuthFrame>
  );
}
