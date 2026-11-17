import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { getLocale, getMessages } from '@/i18n/server';
import { requireViewer } from '@/lib/auth/viewer';
import { listNotifications } from '@/lib/notifications';
import { NotificationList } from './notification-list';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).notifications.pageTitle };
}

// Blocks on the session read, like the (app) layout.
export const instant = false;

export default async function NotificationsPage() {
  const t = (await getMessages()).notifications;
  return (
    <div className="max-w-3xl">
      <Suspense
        fallback={
          <>
            <PageHeader title={t.title} />
            <p role="status" className="mt-6 text-muted">
              {t.loading}
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
  // Budget alerts tell a budget's state, which guests do not see.
  if (viewer.role === 'guest') notFound();
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.notifications;
  const items = await listNotifications(viewer, locale);
  return (
    <>
      <PageHeader title={t.title} />
      <p className="mt-1 text-muted">{t.window}</p>
      <div className="mt-6">
        {items.length === 0 ? (
          <EmptyState title={t.emptyTitle}>{t.emptyBody}</EmptyState>
        ) : (
          <NotificationList
            rows={items.map((n) => ({ id: n.id, text: n.text, createdAt: n.createdAt.getTime(), read: n.read }))}
          />
        )}
      </div>
    </>
  );
}
