import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { requireViewer } from '@/lib/auth/viewer';
import { listBudgetSummaries } from '@/lib/budgets';
import { monthLabel, parseMonthParam } from '@/lib/time';
import { AddBudget } from './budget-forms';
import { BudgetList } from './budget-list';

export const metadata: Metadata = { title: 'Budgets | My Expenses' };

// Blocks on the session read, like the (app) layout.
export const instant = false;

export default function BudgetsPage({ searchParams }: PageProps<'/budgets'>) {
  return (
    <div className="max-w-3xl">
      <Suspense
        fallback={
          <>
            <PageHeader title="Budgets" />
            <p role="status" className="mt-6 text-muted">
              Loading budgets…
            </p>
          </>
        }
      >
        <Budgets searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// Every page checks the session itself: the layout does not re-run on client navigation.
async function Budgets({ searchParams }: Pick<PageProps<'/budgets'>, 'searchParams'>) {
  const viewer = await requireViewer();
  const raw = (await searchParams).month;
  const month = parseMonthParam(typeof raw === 'string' ? raw : undefined);
  const budgets = await listBudgetSummaries(viewer, month);
  const isOwner = viewer.role === 'owner';

  return (
    <>
      <PageHeader title="Budgets" action={isOwner && budgets.length > 0 ? <AddBudget /> : undefined} />
      <p className="mt-1 text-muted">{monthLabel(month)}</p>
      <div className="mt-6">
        {budgets.length === 0 ? (
          <EmptyState title={isOwner ? 'No budgets yet' : 'No budgets have been set up yet.'} action={isOwner ? <AddBudget /> : undefined}>
            {isOwner ? 'A budget is a monthly amount for one kind of spending, such as groceries.' : undefined}
          </EmptyState>
        ) : (
          <BudgetList budgets={budgets} role={viewer.role} />
        )}
      </div>
    </>
  );
}
