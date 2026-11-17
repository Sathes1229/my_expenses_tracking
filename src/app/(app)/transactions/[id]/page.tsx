import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Money } from '@/components/money';
import { PageHeader } from '@/components/page-header';
import { BesidePhoto, ReceiptPhoto } from '@/components/receipt-photo';
import { TransactionForm } from '@/components/transaction-form';
import { fmt } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';
import { messages } from '@/i18n/messages';
import { getLocale, getMessages } from '@/i18n/server';
import { requireViewer } from '@/lib/auth/viewer';
import { listBudgetNames } from '@/lib/budgets';
import { formatWhenLong, monthKey } from '@/lib/time';
import { getTransaction, type TransactionDetail } from '@/lib/transactions';
import { updateTransactionAction } from '../actions';
import { DeleteTransaction } from '../delete-transaction';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).transactions.detailPageTitle };
}

export const instant = false;

export default async function TransactionPage({ params }: PageProps<'/transactions/[id]'>) {
  const t = (await getMessages()).transactions;
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title={t.detailTitle} />
          <p role="status" className="mt-6 text-muted">
            {t.loadingOne}
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
  const locale = await getLocale();
  const m = messages[locale];

  if (!transaction.canEdit) return <ReadOnly transaction={transaction} locale={locale} />;

  const active = await listBudgetNames(viewer);
  // A budget archived since keeps showing on its own transactions, so saving an edit does not move it.
  const budgets =
    transaction.budgetId && !active.some((b) => b.id === transaction.budgetId)
      ? [...active, { id: transaction.budgetId, name: fmt(m.common.archived, { name: transaction.budgetName }) }]
      : active;

  const form = (
    <TransactionForm
      action={updateTransactionAction}
      budgets={budgets}
      initial={transaction}
      hidden={{ transactionId: id }}
      submitLabel={m.transactions.saveChanges}
      cancelHref={`/transactions?month=${month}`}
    />
  );

  return (
    <>
      <PageHeader
        title={m.transactions.editTitle}
        action={<DeleteTransaction id={id} merchant={transaction.merchant} month={month} />}
      />
      <p className="mt-1 text-muted">{fmt(m.transactions.addedByName, { name: transaction.createdByName })}</p>
      <div className="mt-6">
        {transaction.receiptUploadId ? (
          <BesidePhoto photo={<Photo transaction={transaction} locale={locale} />}>{form}</BesidePhoto>
        ) : (
          form
        )}
      </div>
    </>
  );
}

/** Served by /api/receipts/[id], which checks again that this person may see it. */
function Photo({ transaction: t, locale }: { transaction: TransactionDetail; locale: Locale }) {
  return (
    <ReceiptPhoto
      src={`/api/receipts/${t.receiptUploadId}`}
      alt={fmt(messages[locale].transactions.receiptFrom, { merchant: t.merchant })}
      locale={locale}
    />
  );
}

function ReadOnly({ transaction: t, locale }: { transaction: TransactionDetail; locale: Locale }) {
  const { common, transactions: copy } = messages[locale];
  const facts: [string, string][] = [
    [copy.when, formatWhenLong(t.occurredAt, locale)],
    [copy.paidWith, common.payment[t.paymentMethod]],
    [copy.budget, t.budgetId === null ? common.uncategorised : t.budgetName],
    [copy.addedBy, t.createdByName],
  ];
  if (t.receiptNumber) facts.push([copy.receiptNumber, t.receiptNumber]);
  if (t.note) facts.push([copy.note, t.note]);
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
            {copy.items}
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
            {copy.receipt}
          </h2>
          <div className="mt-2 max-w-xs">
            <Photo transaction={t} locale={locale} />
          </div>
        </section>
      )}
      <p className="mt-6 text-muted">{fmt(copy.onlyTheyCanChange, { name: t.createdByName })}</p>
    </div>
  );
}
