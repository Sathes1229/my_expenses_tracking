import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AuthFrame } from '@/components/auth-frame';
import { getMessages } from '@/i18n/server';
import { hasAnyUser } from '@/lib/auth/accounts';
import { env } from '@/lib/env';
import { ResetOwnerForm } from './reset-owner-form';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).auth.resetOwner.pageTitle };
}

// The copy follows the visitor's language, read from the request, so the page waits for it.
export const instant = false;

export default async function ResetOwnerPage() {
  const { auth, common } = await getMessages();
  const t = auth.resetOwner;
  return (
    <AuthFrame title={t.title} intro={t.intro}>
      <Suspense fallback={<p className="text-muted">{common.loading}</p>}>
        <ResetOwnerContent />
      </Suspense>
      <Link href="/login" className="mt-6 inline-flex min-h-11 items-center text-sm">
        {t.backToSignIn}
      </Link>
    </AuthFrame>
  );
}

/** Reads .env at request time, so turning the token on or off needs only a restart. */
async function ResetOwnerContent() {
  await connection();
  if (!(await hasAnyUser())) redirect('/setup');

  if (!env.OWNER_RESET_TOKEN) {
    const t = (await getMessages()).auth.resetOwner;
    return (
      <div className="flex flex-col gap-3">
        <p className="font-medium text-ink">{t.offTitle}</p>
        <p className="text-muted">{t.offBody}</p>
      </div>
    );
  }
  return <ResetOwnerForm />;
}
