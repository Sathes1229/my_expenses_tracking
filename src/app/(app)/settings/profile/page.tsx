import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/page-header';
import { getMessages } from '@/i18n/server';
import { requireViewer } from '@/lib/auth/viewer';
import { LanguageForm } from './language-form';
import { NameForm, PasswordForm } from './profile-forms';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).profile.pageTitle };
}

// Blocks on the session read, like the (app) layout.
export const instant = false;

export default async function ProfilePage() {
  const t = (await getMessages()).profile;
  return (
    <div className="max-w-md">
      <PageHeader title={t.title} />
      <Suspense
        fallback={
          <p role="status" className="mt-8 text-muted">
            {t.loading}
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
  const t = (await getMessages()).profile;
  return (
    <>
      <section aria-labelledby="name-heading" className="mt-8">
        <h2 id="name-heading" className="text-lg font-semibold text-ink">
          {t.nameHeading}
        </h2>
        <div className="mt-4">
          <NameForm displayName={viewer.displayName} />
        </div>
      </section>
      <section aria-labelledby="language-heading" className="mt-12">
        <h2 id="language-heading" className="text-lg font-semibold text-ink">
          {t.language.heading}
        </h2>
        <p className="mt-1 text-muted">{t.language.hint}</p>
        <div className="mt-4">
          <LanguageForm />
        </div>
      </section>
      <section aria-labelledby="password-heading" className="mt-12">
        <h2 id="password-heading" className="text-lg font-semibold text-ink">
          {t.passwordHeading}
        </h2>
        <p className="mt-1 text-muted">{t.passwordHint}</p>
        <div className="mt-4">
          <PasswordForm />
        </div>
      </section>
    </>
  );
}
