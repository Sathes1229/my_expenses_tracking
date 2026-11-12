import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Money } from '@/components/money';
import { PageHeader } from '@/components/page-header';
import { BesidePhoto, ReceiptPhoto } from '@/components/receipt-photo';
import { TransactionForm } from '@/components/transaction-form';
import { requireViewer } from '@/lib/auth/viewer';
import { listBudgetNames } from '@/lib/budgets';
import { formatWhenLong, monthKey } from '@/lib/time';
import { getTransaction, PAYMENT_LABELS, type TransactionDetail } from '@/lib/transactions';
import { updateTransactionAction } from '../actions';
import { DeleteTransaction } from '../delete-transaction';

export const metadata: Metadata = { title: 'Transaction | My Expenses' };

export const instant = false;

export default function TransactionPage({ params }: PageProps<'/transactions/[id]'>) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Transaction" />
          <p role="status" className="mt-6 text-muted">
            Loading the transaction…
          </p>
        </>
      }
    >
      <Transaction params={params} />
    </Suspense>
  );
}

async function Transaction({ params }: Pick<PageProps<'/transactions/[id]'>, 'params'>) {
  const viewer = await requireViewer();
  const { id } = await params;
  // Missing, or not one this person may see: the same page, so a guest cannot probe for ids.
  const transaction = await getTransaction(viewer, id);
  if (!transaction) notFound();
  const month = monthKey(transaction.occurredAt);

  if (!transaction.canEdit) return <ReadOnly transaction={transaction} />;

  const active = await listBudgetNames(viewer);
  // A budget archived since keeps showing on its own transactions, so saving an edit does not move it.
  const budgets =
    transaction.budgetId && !active.some((b) => b.id === transaction.budgetId)
      ? [...active, { id: transaction.budgetId, name: `${transaction.budgetName} (archived)` }]
      : active;

  const form = (
    <TransactionForm
      action={updateTransactionAction}
      budgets={budgets}
      initial={transaction}
      hidden={{ transactionId: id }}
      submitLabel="Save changes"
      cancelHref={`/transactions?month=${month}`}
    />
  );

  return (
    <>
      <PageHeader title="Edit transaction" action={<DeleteTransaction id={id} merchant={transaction.merchant} month={month} />} />
      <p className="mt-1 text-muted">Added by {transaction.createdByName}</p>
      <div className="mt-6">
        {transaction.receiptUploadId ? (
          <BesidePhoto photo={<Photo transaction={transaction} />}>{form}</BesidePhoto>
        ) : (
          form
        )}
      </div>
    </>
  );
}

/** Served by /api/receipts/[id], which checks again that this person may see it. */
function Photo({ transaction: t }: { transaction: TransactionDetail }) {
  return <ReceiptPhoto src={`/api/receipts/${t.receiptUploadId}`} alt={`Receipt from ${t.merchant}`} />;
}

function ReadOnly({ transaction: t }: { transaction: TransactionDetail }) {
  const facts: [string, string][] = [
    ['When', formatWhenLong(t.occurredAt)],
    ['Paid with', PAYMENT_LABELS[t.paymentMethod]],
    ['Budget', t.budgetName],
    ['Added by', t.createdByName],
  ];
  if (t.receiptNumber) facts.push(['Receipt number', t.receiptNumber]);
  if (t.note) facts.push(['Note', t.note]);
  return (
    <div className="max-w-xl">
      <PageHeader title={t.merchant} />
      <p className="mt-3 text-focal font-semibold text-ink">
        <Money sen={t.totalSen} />
      </p>
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
        {facts.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted">{term}</dt>
            <dd className="min-w-0 break-words text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      {t.items.length > 0 && (
        <section className="mt-6" aria-labelledby="items-heading">
          <h2 id="items-heading" className="text-lg font-semibold text-ink">
            Items
          </h2>
          <ul className="mt-2 divide-y divide-line rounded-surface border border-line bg-surface">
            {t.items.map((item, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 px-4 py-2">
                <span className="min-w-0 break-words text-ink">{item.name}</span>
                <span className="text-muted">
                  {item.quantity} × <Money sen={item.unitPriceSen} />
                  <span aria-hidden="true"> = </span>
                  <span className="sr-only">, </span>
                  <Money sen={item.lineTotalSen} className="text-ink" />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {t.receiptUploadId && (
        <section className="mt-6" aria-labelledby="receipt-heading">
          <h2 id="receipt-heading" className="text-lg font-semibold text-ink">
            Receipt
          </h2>
          <div className="mt-2 max-w-xs">
            <Photo transaction={t} />
          </div>
        </section>
      )}
      <p className="mt-6 text-muted">Only {t.createdByName} or the owner can change this transaction.</p>
    </div>
  );
}
