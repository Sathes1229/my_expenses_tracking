import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AuthFrame } from '@/components/auth-frame';
import { SubmitButton } from '@/components/submit-button';
import { getSessionState } from '@/lib/auth/viewer';
import { signOut } from '../sign-out';
import { ChangePasswordForm } from './change-password-form';

export const metadata: Metadata = { title: 'Choose a new password | My Expenses' };

export default function ChangePasswordPage() {
  return (
    <AuthFrame
      title="Choose a new password"
      intro="You signed in with a temporary password from the owner. Choose your own before you continue."
    >
      <Suspense fallback={null}>
        <OnlyForTemporaryPasswords />
      </Suspense>
      <ChangePasswordForm />
      <form action={signOut} className="mt-6">
        <SubmitButton variant="quiet" className="-ml-3">
          Sign out instead
        </SubmitButton>
      </form>
    </AuthFrame>
  );
}

/** Signed-out visitors go to /login; anyone without a temporary password goes home. */
async function OnlyForTemporaryPasswords() {
  const state = await getSessionState();
  if (!state) redirect('/login');
  if (!state.mustChangePassword) redirect('/');
  return null;
}
