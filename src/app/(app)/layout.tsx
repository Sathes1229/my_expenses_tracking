import { Suspense, type ReactNode } from 'react';
import { SubmitButton } from '@/components/submit-button';
import { ThemeToggle } from '@/components/theme-toggle';
import { requireViewer } from '@/lib/auth/viewer';
import { signOut } from '../sign-out';

// Signed-in pages wait for a fresh session read on purpose: caching it ('use cache: private')
// would delay a role change or removal, so these routes opt out of instant-navigation checks.
export const instant = false;

/**
 * The guard for every page under (app): nothing renders until requireViewer passes. Pages still
 * call requireViewer themselves, since a layout does not re-run when navigating between them.
 */
export default function SignedInLayout({ children }: LayoutProps<'/'>) {
  return (
    <Suspense fallback={<ShellLoading />}>
      <SignedInShell>{children}</SignedInShell>
    </Suspense>
  );
}

const bar = 'mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2';

async function SignedInShell({ children }: { children: ReactNode }) {
  const viewer = await requireViewer();
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className={bar}>
          <div className="min-w-0 py-1">
            <p className="font-semibold text-ink">My Expenses</p>
            <p className="truncate text-sm text-muted">Signed in as {viewer.displayName}</p>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <form action={signOut}>
              <SubmitButton variant="quiet">Sign out</SubmitButton>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
    </>
  );
}

function ShellLoading() {
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className={bar}>
          <div className="py-1">
            <p className="font-semibold text-ink">My Expenses</p>
            {/* Holds the name line's height so the header does not jump when the shell loads. */}
            <p aria-hidden="true" className="text-sm">&nbsp;</p>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <p role="status" className="text-muted">
          Loading…
        </p>
      </main>
    </>
  );
}
