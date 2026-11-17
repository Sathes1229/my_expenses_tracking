import Link from 'next/link';
import { fmt } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';
import { messages } from '@/i18n/messages';
import { BellIcon } from './icons';

/**
 * The link to /notifications. The count is written out as a number (never a dot or a colour
 * alone), and the accessible name carries the same count.
 */
export function NotificationBell({ unread, locale }: { unread: number; locale: Locale }) {
  const t = messages[locale].notifications;
  const label = unread > 0 ? fmt(t.unread, { count: unread }) : t.title;
  return (
    <Link
      href="/notifications"
      aria-label={label}
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-control px-2 text-ink no-underline transition-state hover:bg-sunken"
    >
      <BellIcon />
      {unread > 0 && (
        <span aria-hidden="true" className="rounded-control bg-ink px-1.5 text-sm font-semibold tabular-nums text-canvas">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}
