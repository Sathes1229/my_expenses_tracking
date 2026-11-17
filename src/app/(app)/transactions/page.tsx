import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/button';
import { ButtonLink } from '@/components/button-link';
import { EmptyState } from '@/components/empty-state';
import { CameraIcon } from '@/components/icons';
import { Money } from '@/components/money';
import { PageHeader } from '@/components/page-header';
import { Select } from '@/components/select';
import { fmt } from '@/i18n/format';
import { fmtNodes } from '@/i18n/format-nodes';
import { getLocale, getMessages } from '@/i18n/server';
import { requireViewer } from '@/lib/auth/viewer';
import { listBudgetNames } from '@/lib/budgets';
import { latestMonth, monthLabel, shiftMonth } from '@/lib/time';
import { filterFromQuery, UNCATEGORISED_CHOICE, type FilterChoices } from '@/lib/transaction-filter';
import { listPeople, listTransactions, PAYMENT_METHODS } from '@/lib/transactions';
import { TransactionList } from './transaction-list';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).transactions.pageTitle };
}

// Blocks on the session read, like the (app) layout.
export const instant = false;

const NONE = UNCATEGORISED_CHOICE;

/** The month and filters as an address, for this page or (with `path`) for the export. */
function href(month: string, choices: FilterChoices, path = '/transactions'): string {
  const query = new URLSearchParams({ month });
  if (choices.budget) query.set('budget', choices.budget);
  if (choices.person) query.set('person', choices.person);
  if (choices.method) query.set('method', choices.method);
  return `${path}?${query}`;
}

export default async function TransactionsPage({ searchParams }: PageProps<'/transactions'>) {
  const t = (await getMessages()).transactions;
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
        <Transactions searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// Every page checks the session itself: the layout does not re-run on client navigation.
async function Transactions({ searchParams }: Pick<PageProps<'/transactions'>, 'searchParams'>) {
  const viewer = await requireViewer();
  const { filter, choices } = filterFromQuery(viewer, await searchParams);
  const { month } = filter;
  const latest = latestMonth();
  const isGuest = viewer.role === 'guest';

  const [locale, m, rows, budgets, people] = await Promise.all([
    getLocale(),
    getMessages(),
    listTransactions(viewer, filter),
    listBudgetNames(viewer),
    listPeople(viewer),
  ]);
  const t = m.transactions;
  const values = { month: monthLabel(month, locale) };
  const filtered = Boolean(choices.budget || choices.person || choices.method);
  const shownSen = rows.reduce((sum, row) => sum + row.totalSen, 0);
  const addButtons = (
    <>
      <ButtonLink href="/transactions/scan" className="gap-2">
        <CameraIcon />
        {m.home.scanReceipt}
      </ButtonLink>
      <ButtonLink href="/transactions/new" variant="secondary">
        {m.home.addManually}
      </ButtonLink>
    </>
  );

  return (
    <>
      <PageHeader title={t.title} action={rows.length > 0 ? addButtons : undefined} />

      <nav aria-label={m.common.month} className="mt-4 flex flex-wrap items-center gap-2">
        <p className="w-full text-lg font-semibold text-ink">
          {values.month}
        </p>
        <ButtonLink variant="secondary" href={href(shiftMonth(month, -1), choices)}>
          {m.common.previousMonth}
        </ButtonLink>
        {month < latest && (
          <ButtonLink variant="secondary" href={href(shiftMonth(month, 1), choices)}>
            {m.common.nextMonth}
          </ButtonLink>
        )}
      </nav>

      <form method="get" action="/transactions" className="mt-5 flex flex-col gap-4 min-[560px]:flex-row min-[560px]:flex-wrap min-[560px]:items-end">
        <input type="hidden" name="month" value={month} />
        <Select label={t.budget} name="budget" defaultValue={choices.budget} className="min-[560px]:w-48">
          <option value="">{t.allBudgets}</option>
          <option value={NONE}>{m.common.uncategorised}</option>
          {budgets.map((budget) => (
            <option key={budget.id} value={budget.id}>
              {budget.name}
            </option>
          ))}
        </Select>
        {!isGuest && (
          <Select label={t.person} name="person" defaultValue={choices.person} className="min-[560px]:w-44">
            <option value="">{t.everyone}</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
        )}
        <Select label={t.paidWith} name="method" defaultValue={choices.method} className="min-[560px]:w-40">
          <option value="">{t.anyPayment}</option>
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {m.common.payment[method]}
            </option>
          ))}
        </Select>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="secondary">
            {t.applyFilters}
          </Button>
          {filtered && (
            <Link
              href={href(month, { budget: '', person: '', method: '' })}
              className="inline-flex min-h-11 items-center rounded-control px-3 font-medium text-ink hover:bg-sunken hover:underline"
            >
              {t.clearFilters}
            </Link>
          )}
        </div>
      </form>

      <div className="mt-6">
        {rows.length === 0 ? (
          filtered ? (
            <EmptyState
              title={fmt(t.noneMatch, values)}
              action={
                <ButtonLink variant="secondary" href={href(month, { budget: '', person: '', method: '' })}>
                  {t.clearFilters}
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState title={fmt(t.none, values)} action={addButtons}>
              {isGuest ? t.guestOnlyOwn : undefined}
            </EmptyState>
          )
        ) : (
          <>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <p className="text-muted">
                {fmtNodes(rows.length === 1 ? t.countOne : t.countMany, {
                  count: rows.length,
                  total: <Money sen={shownSen} className="font-semibold text-ink" />,
                })}
              </p>
              {/* A plain link: the browser saves the file the route sends. */}
              <a href={href(month, choices, '/api/export')} download className="inline-flex min-h-11 items-center font-medium">
                {m.export.button}
              </a>
            </div>
            <TransactionList rows={rows} locale={locale} />
          </>
        )}
      </div>
    </>
  );
}
