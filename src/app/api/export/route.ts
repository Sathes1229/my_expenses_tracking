import { localeFromRequest } from '@/i18n/request';
import { stateFromHeaders } from '@/lib/auth/viewer';
import { say } from '@/lib/errors';
import { buildTransactionsWorkbook } from '@/lib/export';
import { filterFromQuery } from '@/lib/transaction-filter';

/**
 * The transactions in view on the Transactions page (same month and filters in the address) as an
 * .xlsx download, in the person's language. What it holds follows listTransactions: a guest's file
 * has only their own entries.
 */
export async function GET(request: Request): Promise<Response> {
  const state = await stateFromHeaders(request.headers);
  if (!state) return new Response(say(localeFromRequest(request, null), 'signInToExport'), { status: 401 });
  const locale = localeFromRequest(request, state.locale);
  if (state.mustChangePassword) return new Response(say(locale, 'newPasswordFirstExport'), { status: 403 });

  const params = new URL(request.url).searchParams;
  const query: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    query[key] = values.length === 1 ? values[0] : values;
  }
  const { filter } = filterFromQuery(state.viewer, query);
  const file = await buildTransactionsWorkbook(state.viewer, filter, locale);
  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="my-expenses-${filter.month}.xlsx"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
