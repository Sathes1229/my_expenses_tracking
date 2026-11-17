import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AuthFrame } from '@/components/auth-frame';
import { SubmitButton } from '@/components/submit-button';
import { getMessages } from '@/i18n/server';
import { getSessionState } from '@/lib/auth/viewer';
import { signOut } from '../sign-out';
import { ChangePasswordForm } from './change-password-form';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).auth.changePassword.pageTitle };
}

// The copy follows the visitor's language, read from the request, so the page waits for it.
export const instant = false;

export default async function ChangePasswordPage() {
  const t = (await getMessages()).auth.changePassword;
  return (
    <AuthFrame title={t.title} intro={t.intro}>
      <Suspense fallback={null}>
        <OnlyForTemporaryPasswords />
      </Suspense>
      <ChangePasswordForm />
      <form action={signOut} className="mt-6">
        <SubmitButton variant="quiet" className="-ml-3">
          {t.signOutInstead}
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
