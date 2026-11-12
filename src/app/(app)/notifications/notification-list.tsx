'use client';

import { useEffect, useState } from 'react';
import { formatWhen } from '@/lib/time';
import { markNotificationsReadAction } from './actions';

export type NotificationRow = { id: string; text: string; createdAt: number; read: boolean };

/**
 * Shows the list as it was when the page opened, then marks everything read. Marking happens in an
 * effect, not during render, so a prefetch of this page never marks anything. The rows are kept in
 * state so the "New" marks stay for this visit after the refresh that updates the bell.
 */
export function NotificationList({ rows }: { rows: NotificationRow[] }) {
  const [shown] = useState(rows);
  const hasUnread = shown.some((n) => !n.read);

  useEffect(() => {
    if (hasUnread) void markNotificationsReadAction();
  }, [hasUnread]);

  return (
    <ul className="divide-y divide-line rounded-surface border border-line bg-surface">
      {shown.map((n) => (
        <li key={n.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
          <p className={n.read ? 'text-muted' : 'font-semibold text-ink'}>
            {!n.read && <span className="mr-2 font-semibold text-ink">New.</span>}
            {n.text}
          </p>
          <time dateTime={new Date(n.createdAt).toISOString()} className="text-sm text-muted">
            {formatWhen(new Date(n.createdAt))}
          </time>
        </li>
      ))}
    </ul>
  );
}
