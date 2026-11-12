import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AuthFrame } from '@/components/auth-frame';
import { hasAnyUser } from '@/lib/auth/accounts';
import { env } from '@/lib/env';
import { ResetOwnerForm } from './reset-owner-form';

export const metadata: Metadata = { title: 'Reset the owner password | My Expenses' };

export default function ResetOwnerPage() {
  return (
    <AuthFrame
      title="Reset the owner password"
      intro="For the owner, when the password is lost. It needs the OWNER_RESET_TOKEN value from the app's .env file."
    >
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <ResetOwnerContent />
      </Suspense>
      <Link href="/login" className="mt-6 inline-flex min-h-11 items-center text-sm">
        Back to sign in
      </Link>
    </AuthFrame>
  );
}

/** Reads .env at request time, so turning the token on or off needs only a restart. */
async function ResetOwnerContent() {
  await connection();
  if (!(await hasAnyUser())) redirect('/setup');

  if (!env.OWNER_RESET_TOKEN) {
    return (
      <div className="flex flex-col gap-3">
        <p className="font-medium text-ink">Owner reset is switched off.</p>
        <p className="text-muted">
          To turn it on, put a token of your choice in OWNER_RESET_TOKEN in the .env file and restart
          the app. Then come back here. Each token works once.
        </p>
      </div>
    );
  }
  return <ResetOwnerForm />;
}
