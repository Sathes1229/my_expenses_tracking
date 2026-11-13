import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader } from '@/components/page-header';
import { listInvites } from '@/lib/auth/invites';
import { listPeople } from '@/lib/auth/people';
import { requireViewer } from '@/lib/auth/viewer';
import { TZ } from '@/lib/time';
import { InviteSection, type InviteRow } from './invite-section';
import { PeopleList } from './people-list';

export const metadata: Metadata = { title: 'Settings | My Expenses' };

// Blocks on the session read, like the (app) layout.
export const instant = false;

const when = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export default function SettingsPage() {
  return (
    <div className="max-w-3xl">
      <Suspense
        fallback={
          <p role="status" className="text-muted">
            Loading people and invites…
          </p>
        }
      >
        <OwnerSettings />
      </Suspense>
    </div>
  );
}

// Every page checks the session itself: the layout does not re-run on client navigation.
async function OwnerSettings() {
  const viewer = await requireViewer();
  // Members and guests have only their profile here.
  if (viewer.role !== 'owner') redirect('/settings/profile');

  const [people, invites] = await Promise.all([listPeople(viewer), listInvites(viewer)]);
  const rows: InviteRow[] = invites.map((invite) => ({
    id: invite.id,
    role: invite.role,
    status: invite.status,
    created: when.format(invite.createdAt),
    expires: when.format(invite.expiresAt),
  }));

  return (
    <>
      <PageHeader
        title="Settings"
        action={
          <>
            {/* A two-letter label: the minimum width keeps it a 44px target. */}
            <Link href="/settings/ai" className="inline-flex min-h-11 min-w-11 items-center justify-center px-2">
              AI
            </Link>
            <Link href="/settings/profile" className="inline-flex min-h-11 items-center px-2">
              Your profile
            </Link>
          </>
        }
      />
      <section aria-labelledby="people-heading" className="mt-8">
        <PeopleList people={people} />
      </section>
      <section aria-labelledby="invites-heading" className="mt-12">
        <h2 id="invites-heading" className="text-lg font-semibold text-ink">
          Invites
        </h2>
        <p className="mt-1 text-muted">
          An invite is a link that creates one account. No message is sent: you share the link yourself, for
          example on WhatsApp.
        </p>
        <InviteSection invites={rows} />
      </section>
    </>
  );
}
