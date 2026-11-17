'use client';

import { AuthFrame } from '@/components/auth-frame';
import { ErrorState } from '@/components/error-state';
import { useMessages } from '@/i18n/client';

/**
 * Shown when checking or using an invite fails unexpectedly (a validation problem is shown on the
 * form instead). Written for the person joining, who cannot fix the app; never shows the error or the link.
 */
export default function InviteError({ retry }: { error: unknown; retry: () => void }) {
  const t = useMessages().auth.invite;
  return (
    <AuthFrame title={t.title}>
      <ErrorState title={t.errorTitle} retry={retry}>
        {t.errorBody}
      </ErrorState>
    </AuthFrame>
  );
}
