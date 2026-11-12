import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AuthFrame } from '@/components/auth-frame';
import { SubmitButton } from '@/components/submit-button';
import { inviteStatus, type InviteStatus } from '@/lib/auth/invites';
import { getSessionState } from '@/lib/auth/viewer';
import { signOut } from '../../sign-out';
import { InviteForm } from './invite-form';

export const metadata: Metadata = {
  title: 'Join My Expenses | My Expenses',
  // The address holds the invite token; never send it to another site as a referrer.
  referrer: 'no-referrer',
};

const WHAT_YOU_SEE = {
  member: "As a member you see the household budgets and everyone's spending, and add your own.",
  guest: 'As a guest you see what is left in each budget and the entries you add yourself.',
} as const;

const PROBLEMS: Record<Exclude<InviteStatus, 'valid'>, { title: string; detail: string; signIn?: boolean }> = {
  used: {
    title: 'This invite was already used.',
    detail: 'Each link works once. If you made your account with it, sign in.',
    signIn: true,
  },
  expired: {
    title: 'This invite has expired.',
    detail: 'Invite links work for 7 days. Ask the person who sent it for a new one.',
  },
  revoked: {
    title: 'This invite was cancelled.',
    detail: 'Ask the person who sent it for a new link.',
  },
  unknown: {
    title: 'This invite link does not work.',
    detail: 'Check that you copied the whole link, or ask the person who sent it for a new one.',
  },
};

export default function InvitePage({ params }: PageProps<'/invite/[token]'>) {
  return (
    <AuthFrame title="Join My Expenses">
      <Suspense
        fallback={
          <p role="status" className="text-muted">
            Checking your invite…
          </p>
        }
      >
        <InviteContent params={params} />
      </Suspense>
    </AuthFrame>
  );
}

/** Open to anyone with the link; the token decides everything, so nothing here needs a session. */
async function InviteContent({ params }: { params: PageProps<'/invite/[token]'>['params'] }) {
  // Whether an invite is still valid depends on the time and the database, so it is read per request.
  await connection();
  const { token } = await params;
  const session = await getSessionState();
  if (session) {
    return (
      <div className="flex flex-col gap-3">
        <p className="font-medium text-ink">You are signed in as {session.viewer.displayName}.</p>
        <p className="text-muted">
          This link makes a new account. To use it, sign out first, then open the link again.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <form action={signOut}>
            <SubmitButton variant="secondary">Sign out</SubmitButton>
          </form>
          <Link href="/" className="inline-flex min-h-11 items-center">
            Stay signed in
          </Link>
        </div>
      </div>
    );
  }

  const { status, role } = await inviteStatus(token);
  if (status !== 'valid' || !role) {
    const problem = PROBLEMS[status === 'valid' ? 'unknown' : status];
    return (
      <div className="flex flex-col gap-3">
        <p className="font-medium text-ink">{problem.title}</p>
        <p className="text-muted">{problem.detail}</p>
        {problem.signIn && (
          <Link href="/login" className="inline-flex min-h-11 items-center">
            Sign in
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      <p className="mb-8 text-muted">
        You are invited as a {role}. {WHAT_YOU_SEE[role]} Pick your name and how you will sign in.
      </p>
      <InviteForm token={token} />
    </>
  );
}
