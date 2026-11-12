import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { AuthFrame } from '@/components/auth-frame';
import { hasAnyUser } from '@/lib/auth/accounts';
import { SetupForm } from './setup-form';

export const metadata: Metadata = { title: 'Create the owner account | My Expenses' };

export default function SetupPage() {
  return (
    <AuthFrame
      title="Create the owner account"
      intro="This first account runs the app: it sets the budgets and invites everyone else."
    >
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
