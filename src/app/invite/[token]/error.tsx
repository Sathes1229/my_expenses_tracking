'use client';

import { AuthFrame } from '@/components/auth-frame';
import { ErrorState } from '@/components/error-state';

/**
 * Shown when checking or using an invite fails unexpectedly (a validation problem is shown on the
 * form instead). Written for the person joining, who cannot fix the app; never shows the error or the link.
 */
export default function InviteError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <AuthFrame title="Join My Expenses">
      <ErrorState title="Your invite could not be checked or used just now." retry={retry}>
        Try again in a moment. If it keeps failing, tell the person who sent you the link.
      </ErrorState>
    </AuthFrame>
  );
}
