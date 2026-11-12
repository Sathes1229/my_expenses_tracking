import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/page-header';
import { requireViewer } from '@/lib/auth/viewer';
import { NameForm, PasswordForm } from './profile-forms';

export const metadata: Metadata = { title: 'Profile | My Expenses' };

// Blocks on the session read, like the (app) layout.
export const instant = false;

export default function ProfilePage() {
  return (
    <div className="max-w-md">
      <PageHeader title="Profile" />
      <Suspense
        fallback={
          <p role="status" className="mt-8 text-muted">
            Loading your profile…
          </p>
        }
      >
        <Profile />
      </Suspense>
    </div>
  );
}

// Every page checks the session itself: the layout does not re-run on client navigation.
async function Profile() {
  const viewer = await requireViewer();
  return (
    <>
      <section aria-labelledby="name-heading" className="mt-8">
        <h2 id="name-heading" className="text-lg font-semibold text-ink">
          Your name
        </h2>
        <div className="mt-4">
          <NameForm displayName={viewer.displayName} />
        </div>
      </section>
      <section aria-labelledby="password-heading" className="mt-12">
        <h2 id="password-heading" className="text-lg font-semibold text-ink">
          Password
        </h2>
        <p className="mt-1 text-muted">Changing it signs you out on your other devices.</p>
        <div className="mt-4">
          <PasswordForm />
        </div>
      </section>
    </>
  );
}
