import type { Viewport } from 'next';
import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { cx } from '@/components/cx';
import { NotificationBell } from '@/components/notification-bell';
import { SubmitButton } from '@/components/submit-button';
import { ThemeToggle } from '@/components/theme-toggle';
import { getMessages } from '@/i18n/server';
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
// When the bar takes two 2.75rem rows (under 480px), the page ends 2rem higher still.
const mainTwoRowsClass = 'max-[30rem]:pb-[calc(7.5rem+env(safe-area-inset-bottom))]';

async function SignedInShell({ children }: { children: ReactNode }) {
  const viewer = await requireViewer();
  const unread = await unreadCount(viewer);
  // Only pages that exist for this role: Debts is the owner's; Settings holds People & invites
  // for the owner, everyone else has Profile.
  const nav = (await getMessages()).nav;
  // Reports shows household figures, so not to a guest.
  const items: NavItem[] = [
    { href: '/', label: nav.home },
    { href: '/transactions', label: nav.transactions },
    { href: '/budgets', label: nav.budgets },
    ...(viewer.role !== 'guest' ? [{ href: '/reports', label: nav.reports }] : []),
    ...(viewer.role === 'owner' ? [{ href: '/debts', label: nav.debts }] : []),
    { href: '/assistant', label: nav.assistant },
    viewer.role === 'owner' ? { href: '/settings', label: nav.settings } : { href: '/settings/profile', label: nav.profile },
  ];
  // Six or seven items (owner, member) take two rows of the bottom bar on a phone under 480px.
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
            <MainNav items={items} label={nav.label} variant="top" />
            {/* Guests get no budget alerts, so no bell. */}
            {viewer.role !== 'guest' && <NotificationBell unread={unread} />}
            <ThemeToggle />
            <form action={signOut}>
              <SubmitButton variant="quiet" className="whitespace-nowrap">Sign out</SubmitButton>
            </form>
          </div>
        </div>
      </header>
      <MainNav items={items} label={nav.label} variant="bottom" twoRows={twoRows} />
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
