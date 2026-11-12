'use client';

import { ErrorState } from '@/components/error-state';

/** Shown when the conversation cannot be loaded or cleared. */
export default function AssistantError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="max-w-3xl">
      <ErrorState title="Could not load the assistant." retry={retry}>
        If trying again does not help, restart My Expenses on the computer it runs on.
      </ErrorState>
    </div>
  );
}
