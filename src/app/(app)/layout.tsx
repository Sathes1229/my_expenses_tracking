import type { Viewport } from 'next';
import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { cx } from '@/components/cx';
import { NotificationBell } from '@/components/notification-bell';
import { SubmitButton } from '@/components/submit-button';
import { ThemeToggle } from '@/components/theme-toggle';
import { requireViewer } from '@/lib/auth/viewer';
import { unreadCount } from '@/lib/notifications';
import { signOut } from '../sign-out';
import { MainNav, type NavItem } from './main-nav';

// Signed-in pages wait for a fresh session read on purpose: caching it ('use cache: private')
// would delay a role change or removal, so these routes opt out of instant-navigation checks.
export const instant = false;

// Lets the bottom bar and the page edges read the safe-area insets (the home indicator, a notch
// when the phone is turned sideways); without it browsers report them as zero.
export const viewport: Viewport = { viewportFit: 'cover' };

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

const bar = 'mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-page py-2';

// Below the lg breakpoint the bottom bar (3.5rem and its border) sits over the end of the page,
// so the page ends that much higher, plus the home indicator.
const mainClass = 'mx-auto w-full max-w-5xl px-page pt-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-8';
// When the bar takes two 2.75rem rows (under 360px), the page ends 2rem higher still.
const mainTwoRowsClass = 'max-[22.5rem]:pb-[calc(7.5rem+env(safe-area-inset-bottom))]';

async function SignedInShell({ children }: { children: ReactNode }) {
  const viewer = await requireViewer();
  const unread = await unreadCount(viewer);
  // Only pages that exist for this role: Debts is the owner's; Settings holds People & invites
  // for the owner, everyone else has Profile.
  const items: NavItem[] = [
    { href: '/', label: 'Home' },
    { href: '/transactions', label: 'Transactions' },
    { href: '/budgets', label: 'Budgets' },
    ...(viewer.role === 'owner' ? [{ href: '/debts', label: 'Debts' }] : []),
    { href: '/assistant', label: 'Assistant' },
    viewer.role === 'owner' ? { href: '/settings', label: 'Settings' } : { href: '/settings/profile', label: 'Profile' },
  ];
  // Six items (the owner's) do not fit one row of the bottom bar on a phone under 360px wide.
  const twoRows = items.length > 5;
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
            <MainNav items={items} variant="top" />
            <NotificationBell unread={unread} />
            <ThemeToggle />
            <form action={signOut}>
              <SubmitButton variant="quiet" className="whitespace-nowrap">Sign out</SubmitButton>
            </form>
          </div>
        </div>
      </header>
      <MainNav items={items} variant="bottom" twoRows={twoRows} />
      <main className={cx(mainClass, twoRows && mainTwoRowsClass)}>{children}</main>
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
      <main className="mx-auto w-full max-w-5xl px-page py-8">
        <p role="status" className="text-muted">
          Loading…
        </p>
      </main>
    </>
  );
}
