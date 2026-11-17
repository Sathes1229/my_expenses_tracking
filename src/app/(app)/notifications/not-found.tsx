import { getMessages } from '@/i18n/server';

/** What a guest gets. Worded like Next's own 404, the same as Debts for anyone but the owner. */
export default async function NotificationsNotFound() {
  const { common } = await getMessages();
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-ink">{common.notFoundTitle}</h1>
      <p className="mt-2 text-muted">{common.notFoundBody}</p>
    </div>
  );
}
