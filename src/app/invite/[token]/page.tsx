import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AuthFrame } from '@/components/auth-frame';
import { SubmitButton } from '@/components/submit-button';
import { fmt } from '@/i18n/format';
import { getMessages } from '@/i18n/server';
import { inviteStatus } from '@/lib/auth/invites';
import { getSessionState } from '@/lib/auth/viewer';
import { signOut } from '../../sign-out';
import { InviteForm } from './invite-form';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: (await getMessages()).auth.invite.pageTitle,
    // The address holds the invite token; never send it to another site as a referrer.
    referrer: 'no-referrer',
  };
}

// The copy follows the visitor's language, read from the request, so the page waits for it.
export const instant = false;

export default async function InvitePage({ params }: PageProps<'/invite/[token]'>) {
  const t = (await getMessages()).auth.invite;
  return (
    <AuthFrame title={t.title}>
      <Suspense
        fallback={
          <p role="status" className="text-muted">
            {t.checking}
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
  const { auth, common } = await getMessages();
  const t = auth.invite;
  const session = await getSessionState();
  if (session) {
    return (
      <div className="flex flex-col gap-3">
        <p className="font-medium text-ink">{fmt(t.signedInAs, { name: session.viewer.displayName })}</p>
        <p className="text-muted">{t.signOutFirst}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <form action={signOut}>
            <SubmitButton variant="secondary">{common.signOut}</SubmitButton>
          </form>
          <Link href="/" className="inline-flex min-h-11 items-center">
            {t.staySignedIn}
          </Link>
        </div>
      </div>
    );
  }

  const { status, role } = await inviteStatus(token);
  if (status !== 'valid' || !role) {
    const problem = status === 'valid' ? 'unknown' : status;
    return (
      <div className="flex flex-col gap-3">
        <p className="font-medium text-ink">{t.problems[problem].title}</p>
        <p className="text-muted">{t.problems[problem].detail}</p>
        {/* A used link most likely made this person's account already. */}
        {problem === 'used' && (
          <Link href="/login" className="inline-flex min-h-11 items-center">
            {common.signIn}
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      <p className="mb-8 text-muted">
        {t.invitedAs[role]} {t.whatYouSee[role]} {t.pickName}
      </p>
      <InviteForm token={token} />
    </>
  );
}
