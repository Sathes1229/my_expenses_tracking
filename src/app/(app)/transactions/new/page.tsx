import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/page-header';
import { TransactionForm } from '@/components/transaction-form';
import { requireViewer } from '@/lib/auth/viewer';
import { listBudgetNames } from '@/lib/budgets';
import { createTransactionAction } from '../actions';

export const metadata: Metadata = { title: 'Add a transaction | My Expenses' };

export const instant = false;

export default function NewTransactionPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Add a transaction" />
          <p role="status" className="mt-6 text-muted">
            Loading the form…
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
  const budgets = await listBudgetNames(viewer);
  return (
    <>
      <PageHeader title="Add a transaction" />
      <div className="mt-6">
        <TransactionForm
          action={createTransactionAction}
          budgets={budgets}
          initial={{ occurredAt: new Date() }}
          submitLabel="Save transaction"
          cancelHref="/transactions"
        />
      </div>
    </>
  );
}
