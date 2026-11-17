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
import { getMessages } from '@/i18n/server';
import { requireViewer } from '@/lib/auth/viewer';
import { listBudgetNames } from '@/lib/budgets';
import { latestMonth, monthLabel, shiftMonth } from '@/lib/time';
import { filterFromQuery, UNCATEGORISED_CHOICE, type FilterChoices } from '@/lib/transaction-filter';
import { listPeople, listTransactions, PAYMENT_LABELS, PAYMENT_METHODS, UNCATEGORISED } from '@/lib/transactions';
import { TransactionList } from './transaction-list';

export const metadata: Metadata = { title: 'Transactions | My Expenses' };

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

export default function TransactionsPage({ searchParams }: PageProps<'/transactions'>) {
  return (
    <div className="max-w-3xl">
      <Suspense
        fallback={
          <>
            <PageHeader title="Transactions" />
            <p role="status" className="mt-6 text-muted">
              Loading transactions…
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

  const [rows, budgets, people] = await Promise.all([
    listTransactions(viewer, filter),
    listBudgetNames(viewer),
    listPeople(viewer),
  ]);
  const filtered = Boolean(choices.budget || choices.person || choices.method);
  const shownSen = rows.reduce((sum, row) => sum + row.totalSen, 0);
  const addButtons = (
    <>
      <ButtonLink href="/transactions/scan" className="gap-2">
        <CameraIcon />
        Scan receipt
      </ButtonLink>
      <ButtonLink href="/transactions/new" variant="secondary">
        Add manually
      </ButtonLink>
    </>
  );

  return (
    <>
      <PageHeader title="Transactions" action={rows.length > 0 ? addButtons : undefined} />

      <nav aria-label="Month" className="mt-4 flex flex-wrap items-center gap-2">
        <p className="w-full text-lg font-semibold text-ink">
          {monthLabel(month)}
        </p>
        <ButtonLink variant="secondary" href={href(shiftMonth(month, -1), choices)}>
          Previous month
        </ButtonLink>
        {month < latest && (
          <ButtonLink variant="secondary" href={href(shiftMonth(month, 1), choices)}>
            Next month
          </ButtonLink>
        )}
      </nav>

      <form method="get" action="/transactions" className="mt-5 flex flex-col gap-4 min-[560px]:flex-row min-[560px]:flex-wrap min-[560px]:items-end">
        <input type="hidden" name="month" value={month} />
        <Select label="Budget" name="budget" defaultValue={choices.budget} className="min-[560px]:w-48">
          <option value="">All budgets</option>
          <option value={NONE}>{UNCATEGORISED}</option>
          {budgets.map((budget) => (
            <option key={budget.id} value={budget.id}>
              {budget.name}
            </option>
          ))}
        </Select>
        {!isGuest && (
          <Select label="Person" name="person" defaultValue={choices.person} className="min-[560px]:w-44">
            <option value="">Everyone</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
        )}
        <Select label="Paid with" name="method" defaultValue={choices.method} className="min-[560px]:w-40">
          <option value="">Any</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_LABELS[m]}
            </option>
          ))}
        </Select>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="secondary">
            Apply filters
          </Button>
          {filtered && (
            <Link
              href={href(month, { budget: '', person: '', method: '' })}
              className="inline-flex min-h-11 items-center rounded-control px-3 font-medium text-ink hover:bg-sunken hover:underline"
            >
              Clear filters
            </Link>
          )}
        </div>
      </form>

      <div className="mt-6">
        {rows.length === 0 ? (
          filtered ? (
            <EmptyState
              title={`No transactions in ${monthLabel(month)} match these filters`}
              action={
                <ButtonLink variant="secondary" href={href(month, { budget: '', person: '', method: '' })}>
                  Clear filters
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              title={`No transactions in ${monthLabel(month)}`}
              action={addButtons}
            >
              {isGuest ? 'Only the ones you add show here.' : undefined}
            </EmptyState>
          )
        ) : (
          <>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <p className="text-muted">
                {rows.length} {rows.length === 1 ? 'transaction' : 'transactions'}, <Money sen={shownSen} className="font-semibold text-ink" /> in total
              </p>
              {/* A plain link: the browser saves the file the route sends. */}
              <a href={href(month, choices, '/api/export')} download className="inline-flex min-h-11 items-center font-medium">
                {(await getMessages()).export.button}
              </a>
            </div>
            <TransactionList rows={rows} />
          </>
        )}
      </div>
    </>
  );
}
