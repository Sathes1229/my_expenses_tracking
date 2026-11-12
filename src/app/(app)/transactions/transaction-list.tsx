import Link from 'next/link';
import { Money } from '@/components/money';
import { formatWhen } from '@/lib/time';
import { PAYMENT_LABELS, type TransactionRow } from '@/lib/transactions';

/** Newest first. Each row opens the transaction, to read it or, for its owner and the household owner, to change it. */
export function TransactionList({ rows }: { rows: TransactionRow[] }) {
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
              {formatWhen(row.occurredAt)}
              <span aria-hidden="true"> · </span>
              <span className="sr-only">. </span>
              {row.budgetName}
              <span aria-hidden="true"> · </span>
              <span className="sr-only">. </span>
              {PAYMENT_LABELS[row.paymentMethod]}
              <span aria-hidden="true"> · </span>
              <span className="sr-only">. </span>
              Added by {row.createdByName}
              {row.hasReceipt && (
                <>
                  <span aria-hidden="true"> · </span>
                  <span className="sr-only">. </span>
                  Receipt attached
                </>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
