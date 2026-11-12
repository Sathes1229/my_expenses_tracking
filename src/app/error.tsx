'use client';

import { AuthFrame } from '@/components/auth-frame';
import { ErrorState } from '@/components/error-state';

/**
 * The fallback for any page without a closer error boundary: sign in, setup, password pages and
 * the home page. The error itself is never shown; it can hold details meant only for the server log.
 */
export default function RootError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <AuthFrame title="Something went wrong">
      <ErrorState title="My Expenses could not finish loading this page." retry={retry}>
        Try again in a moment. If it keeps failing, the app may need a restart on the computer it runs on.
      </ErrorState>
    </AuthFrame>
  );
}
