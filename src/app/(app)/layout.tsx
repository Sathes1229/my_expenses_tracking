import Link from 'next/link';
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

// Styled like a quiet button: these sit beside the theme and sign-out buttons.
const navLink =
  'inline-flex min-h-11 items-center rounded-control px-3 font-medium whitespace-nowrap text-ink no-underline transition-state hover:bg-sunken hover:underline';

async function SignedInShell({ children }: { children: ReactNode }) {
  const viewer = await requireViewer();
  // Only pages that exist: Settings holds People & invites for the owner; everyone else has Profile.
  const settings =
    viewer.role === 'owner' ? { href: '/settings', label: 'Settings' } : { href: '/settings/profile', label: 'Profile' };
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className={bar}>
          <div className="min-w-0 py-1">
            {/* 44px to tap, with the extra height taken from the margins so the header keeps its size. */}
            <Link href="/" className="-my-2.5 flex min-h-11 w-fit items-center font-semibold text-ink no-underline hover:underline">
              My Expenses
            </Link>
            <p className="truncate text-sm text-muted">Signed in as {viewer.displayName}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-1">
            <nav aria-label="Main" className="flex items-center">
              <Link href="/budgets" className={navLink}>
                Budgets
              </Link>
              <Link href={settings.href} className={navLink}>
                {settings.label}
              </Link>
            </nav>
            <ThemeToggle />
            <form action={signOut}>
              <SubmitButton variant="quiet" className="whitespace-nowrap">Sign out</SubmitButton>
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
