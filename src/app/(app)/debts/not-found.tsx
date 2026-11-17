import { getMessages } from '@/i18n/server';

/** What anyone but the owner gets. Worded like Next's own 404, so it says nothing about debts. */
export default async function DebtsNotFound() {
  const { common } = await getMessages();
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-ink">{common.notFoundTitle}</h1>
      <p className="mt-2 text-muted">{common.notFoundBody}</p>
    </div>
  );
}
