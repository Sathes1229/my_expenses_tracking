import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { requireViewer } from '@/lib/auth/viewer';
import type { Messages } from '@/i18n/messages';
import { getLocale, getMessages } from '@/i18n/server';
import { hasAnyBudget, listBudgetNames, listBudgetSummaries } from '@/lib/budgets';
import { monthLabel, parseMonthParam } from '@/lib/time';
import { AddBudget } from './budget-forms';
import { BudgetList } from './budget-list';
import { StarterBudgets } from './starter-budgets';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).budgets.pageTitle };
}

// Blocks on the session read, like the (app) layout.
export const instant = false;

export default async function BudgetsPage({ searchParams }: PageProps<'/budgets'>) {
  const t = (await getMessages()).budgets;
  return (
    <div className="max-w-3xl">
      <Suspense
        fallback={
          <>
            <PageHeader title={t.title} />
            <p role="status" className="mt-6 text-muted">
              {t.loading}
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
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.budgets;
  if (viewer.role === 'guest') return <GuestBudgets names={await listBudgetNames(viewer)} t={t} />;
  const raw = (await searchParams).month;
  const month = parseMonthParam(typeof raw === 'string' ? raw : undefined);
  const budgets = await listBudgetSummaries(viewer, month);
  const isOwner = viewer.role === 'owner';
  // A household that has never had a budget starts from the common ones; one with only archived
  // budgets gets the usual empty state.
  if (isOwner && budgets.length === 0 && !(await hasAnyBudget()))
    return <FirstBudgets month={monthLabel(month, locale)} messages={messages} />;

  return (
    <>
      <PageHeader title={t.title} action={isOwner && budgets.length > 0 ? <AddBudget /> : undefined} />
      <p className="mt-1 text-muted">{monthLabel(month, locale)}</p>
      <div className="mt-6">
        {budgets.length === 0 ? (
          <EmptyState title={isOwner ? t.emptyTitle : t.noneSetUp} action={isOwner ? <AddBudget /> : undefined}>
            {isOwner ? t.emptyBody : undefined}
          </EmptyState>
        ) : (
          <BudgetList budgets={budgets} role={viewer.role} />
        )}
      </div>
    </>
  );
}

/** A guest sees the names only: the budgets they can pick when they add an expense. */
function GuestBudgets({ names, t }: { names: { id: string; name: string }[]; t: Messages['budgets'] }) {
  return (
    <>
      <PageHeader title={t.title} />
      <p className="mt-1 text-muted">{t.guestIntro}</p>
      <div className="mt-6">
        {names.length === 0 ? (
          <EmptyState title={t.noneSetUp} />
        ) : (
          <ul className="divide-y divide-line rounded-surface border border-line bg-surface">
            {names.map((b) => (
              <li key={b.id} className="px-4 py-4 font-semibold break-words text-ink">
                {b.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/** The owner's first visit: common budgets to tick, and the usual way to add one of their own. */
function FirstBudgets({ month, messages }: { month: string; messages: Messages }) {
  return (
    <>
      <PageHeader title={messages.budgets.title} />
      <p className="mt-1 text-muted">{month}</p>
      <div className="mt-6">
        <StarterBudgets />
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-muted">{messages.starter.orAddOwn}</p>
        <AddBudget />
      </div>
    </>
  );
}
