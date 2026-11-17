import Link from 'next/link';
import { Money } from '@/components/money';
import { fmt } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';
import { messages } from '@/i18n/messages';
import { formatWhen } from '@/lib/time';
import type { TransactionRow } from '@/lib/transactions';

/** Newest first. Each row opens the transaction, to read it or, for its owner and the household owner, to change it. */
export function TransactionList({ rows, locale }: { rows: TransactionRow[]; locale: Locale }) {
  const { common, transactions: t } = messages[locale];
  return (
    <ul className="divide-y divide-line rounded-surface border border-line bg-surface">
      {rows.map((row) => (
        <li key={row.id}>
          <Link href={`/transactions/${row.id}`} className="block px-4 py-3 text-ink no-underline transition-state hover:bg-sunken">
            <span className="flex flex-wrap items-baseline justify-between gap-x-4">
              <span className="min-w-0 text-base font-semibold break-words">{row.merchant}</span>
              <Money sen={row.totalSen} className="text-lg font-semibold" />
            </span>
            <span className="mt-0.5 block text-sm text-muted">
              {formatWhen(row.occurredAt, locale)}
              <span aria-hidden="true"> · </span>
              <span className="sr-only">. </span>
              {row.budgetId === null ? common.uncategorised : row.budgetName}
              <span aria-hidden="true"> · </span>
              <span className="sr-only">. </span>
              {common.payment[row.paymentMethod]}
              <span aria-hidden="true"> · </span>
              <span className="sr-only">. </span>
              {fmt(t.addedByName, { name: row.createdByName })}
              {row.hasReceipt && (
                <>
                  <span aria-hidden="true"> · </span>
                  <span className="sr-only">. </span>
                  {t.receiptAttached}
                </>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
