import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AuthFrame } from '@/components/auth-frame';
import { getMessages } from '@/i18n/server';
import { hasAnyUser } from '@/lib/auth/accounts';
import { SetupForm } from './setup-form';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).auth.setup.pageTitle };
}

// The copy follows the visitor's language, read from the request, so the page waits for it.
export const instant = false;

export default async function SetupPage() {
  const t = (await getMessages()).auth.setup;
  return (
    <AuthFrame title={t.title} intro={t.intro}>
      <Suspense fallback={null}>
        <ClosedOnceSetUp />
      </Suspense>
      <SetupForm />
    </AuthFrame>
  );
}

/** Setup works only on an empty install; afterwards this page sends people to sign in. */
async function ClosedOnceSetUp() {
  await connection();
  if (await hasAnyUser()) redirect('/login');
  return null;
}
