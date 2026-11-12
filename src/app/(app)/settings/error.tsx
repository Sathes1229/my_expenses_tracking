'use client';

import { ErrorState } from '@/components/error-state';

/** Shown when loading the settings or saving a change fails unexpectedly. */
export default function SettingsError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="max-w-3xl">
      <ErrorState title="Something went wrong in Settings." retry={retry}>
        If trying again does not help, restart My Expenses on the computer it runs on.
      </ErrorState>
    </div>
  );
}
