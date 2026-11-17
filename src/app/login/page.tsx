import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AuthFrame } from '@/components/auth-frame';
import { getMessages } from '@/i18n/server';
import { hasAnyUser } from '@/lib/auth/accounts';
import { getViewer } from '@/lib/auth/viewer';
import { LoginForm } from './login-form';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).auth.login.pageTitle };
}

// The copy follows the visitor's language, read from the request, so the page waits for it.
export const instant = false;

export default async function LoginPage() {
  const { auth: t, common } = await getMessages();
  return (
    <AuthFrame title={common.signIn}>
      <Suspense fallback={null}>
        <SendElsewhere />
      </Suspense>
      <LoginForm />
      <p className="mt-8 text-sm text-muted">{t.login.forgotPassword}</p>
      <Link href="/reset-owner" className="inline-flex min-h-11 items-center text-sm">
        {t.resetOwner.title}
      </Link>
      <p className="mt-12 text-sm text-muted">Developed by Sathes</p>
    </AuthFrame>
  );
}

/** A fresh install goes to setup; someone already signed in goes home. Renders nothing. */
async function SendElsewhere() {
  await connection();
  if (!(await hasAnyUser())) redirect('/setup');
  if (await getViewer()) redirect('/');
  return null;
}
