import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/page-header';
import { TransactionForm } from '@/components/transaction-form';
import { getMessages } from '@/i18n/server';
import { requireViewer } from '@/lib/auth/viewer';
import { listBudgetNames } from '@/lib/budgets';
import { createTransactionAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).transactions.addPageTitle };
}

export const instant = false;

export default async function NewTransactionPage() {
  const t = (await getMessages()).transactions;
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title={t.addTitle} />
          <p role="status" className="mt-6 text-muted">
            {t.loadingForm}
          </p>
        </>
      }
    >
      <NewTransaction />
    </Suspense>
  );
}

async function NewTransaction() {
  const viewer = await requireViewer();
  const [messages, budgets] = await Promise.all([getMessages(), listBudgetNames(viewer)]);
  const t = messages.transactions;
  return (
    <>
      <PageHeader title={t.addTitle} />
      <div className="mt-6">
        <TransactionForm
          action={createTransactionAction}
          budgets={budgets}
          initial={{ occurredAt: new Date() }}
          submitLabel={t.save}
          cancelHref="/transactions"
        />
      </div>
    </>
  );
}
