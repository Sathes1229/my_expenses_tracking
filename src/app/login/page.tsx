import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AuthFrame } from '@/components/auth-frame';
import { hasAnyUser } from '@/lib/auth/accounts';
import { getViewer } from '@/lib/auth/viewer';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in | My Expenses' };

export default function LoginPage() {
  return (
    <AuthFrame title="Sign in">
      <Suspense fallback={null}>
        <SendElsewhere />
      </Suspense>
      <LoginForm />
      <p className="mt-8 text-sm text-muted">Forgot your password? Ask the owner to reset it.</p>
      <Link href="/reset-owner" className="inline-flex min-h-11 items-center text-sm">
        Reset the owner password
      </Link>
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
