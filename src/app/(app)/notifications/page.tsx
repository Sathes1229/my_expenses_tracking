import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { requireViewer } from '@/lib/auth/viewer';
import { listNotifications } from '@/lib/notifications';
import { NotificationList } from './notification-list';

export const metadata: Metadata = { title: 'Notifications | My Expenses' };

// Blocks on the session read, like the (app) layout.
export const instant = false;

export default function NotificationsPage() {
  return (
    <div className="max-w-3xl">
      <Suspense
        fallback={
          <>
            <PageHeader title="Notifications" />
            <p role="status" className="mt-6 text-muted">
              Loading notifications…
            </p>
          </>
        }
      >
        <Notifications />
      </Suspense>
    </div>
  );
}

// Every page checks the session itself: the layout does not re-run on client navigation.
async function Notifications() {
  const viewer = await requireViewer();
  const items = await listNotifications(viewer);
  return (
    <>
      <PageHeader title="Notifications" />
      <p className="mt-1 text-muted">The last 60 days.</p>
      <div className="mt-6">
        {items.length === 0 ? (
          <EmptyState title="Nothing to report.">You&apos;ll see a note here when a budget passes its warning level.</EmptyState>
        ) : (
          <NotificationList
            rows={items.map((n) => ({ id: n.id, text: n.text, createdAt: n.createdAt.getTime(), read: n.read }))}
          />
        )}
      </div>
    </>
  );
}
