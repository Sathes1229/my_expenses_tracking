'use client';

import { ErrorState } from '@/components/error-state';

/** Shown when loading the notifications fails unexpectedly. */
export default function NotificationsError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="max-w-3xl">
      <ErrorState title="Could not load the notifications." retry={retry}>
        If trying again does not help, restart My Expenses on the computer it runs on.
      </ErrorState>
    </div>
  );
}
