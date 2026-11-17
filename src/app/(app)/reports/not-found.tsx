import { getMessages } from '@/i18n/server';

/** What a guest gets: the report is household figures. Worded like Next's own 404, as for Notifications. */
export default async function ReportsNotFound() {
  const t = (await getMessages()).reports;
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-ink">{t.notFoundTitle}</h1>
      <p className="mt-2 text-muted">{t.notFoundBody}</p>
    </div>
  );
}
