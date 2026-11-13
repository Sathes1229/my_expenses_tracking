import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ButtonLink } from '@/components/button-link';
import { cx } from '@/components/cx';
import { EmptyState } from '@/components/empty-state';
import { CameraIcon } from '@/components/icons';
import { Meter } from '@/components/meter';
import { Money } from '@/components/money';
import { PageHeader } from '@/components/page-header';
import { StateTag } from '@/components/state-tag';
import { requireViewer, type Viewer } from '@/lib/auth/viewer';
import type { BudgetSummary } from '@/lib/budgets';
import { getDashboard, type Dashboard } from '@/lib/dashboard';
import { monthKey, monthLabel, parseMonthParam, shiftMonth } from '@/lib/time';
import { TransactionList } from './transactions/transaction-list';

export const metadata: Metadata = { title: 'Home | My Expenses' };

// Blocks on the session read, like the (app) layout.
export const instant = false;

export default function HomePage({ searchParams }: PageProps<'/'>) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-muted">
          Loading this month…
        </p>
      }
    >
      <Home searchParams={searchParams} />
    </Suspense>
  );
}

// A link standing on its own line: 44px tall to tap, still styled as a link.
const standaloneLink = 'inline-flex min-h-11 items-center';

// Every page checks the session itself: the layout does not re-run on client navigation.
async function Home({ searchParams }: Pick<PageProps<'/'>, 'searchParams'>) {
  const viewer = await requireViewer();
  const raw = (await searchParams).month;
  const thisMonth = monthKey(new Date());
  const asked = parseMonthParam(typeof raw === 'string' ? raw : undefined);
  // Nothing has happened in a later month yet, so the switcher stops at this one.
  const month = asked > thisMonth ? thisMonth : asked;
  const data = await getDashboard(viewer, month);
  const isOwner = viewer.role === 'owner';
  const hasBudgets = data.budgets.length > 0;

  return (
    <>
      <PageHeader
        title={monthLabel(month)}
        action={
          <nav aria-label="Month" className="flex flex-wrap gap-2">
            <ButtonLink variant="secondary" href={`/?month=${shiftMonth(month, -1)}`}>
              Previous month
            </ButtonLink>
            {month < thisMonth && (
              <ButtonLink variant="secondary" href={`/?month=${shiftMonth(month, 1)}`}>
                Next month
              </ButtonLink>
            )}
          </nav>
        }
      />

      {/* Wide screens: the budget picture on the left, activity beside it. Phones: one column, in that order. */}
      <div className="mt-8 grid grid-cols-1 gap-x-12 gap-y-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {!hasBudgets ? (
            <NoBudgets isOwner={isOwner} />
          ) : (
            data.totals && <LeftThisMonth totals={data.totals} month={month} isCurrent={month === thisMonth} />
          )}
          {/* First in the column for a guest, who has no total above it. */}
          <div className="mt-6 flex flex-wrap gap-3 first:mt-0">
            <ButtonLink href="/transactions/scan" variant={isOwner && !hasBudgets ? 'secondary' : 'primary'} className="gap-2">
              <CameraIcon />
              Scan receipt
            </ButtonLink>
            <ButtonLink href="/transactions/new" variant="secondary">
              Add manually
            </ButtonLink>
          </div>
          <NeedsAttention budgets={data.budgets} />
          {hasBudgets && <Budgets budgets={data.budgets} role={viewer.role} />}
          {data.byBudget && data.byBudget.length > 0 && <SpendingByBudget rows={data.byBudget} />}
        </div>
        <div className="min-w-0">
          <Recent data={data} isGuest={viewer.role === 'guest'} />
          {data.debts && <OwedToYou debts={data.debts} />}
        </div>
      </div>
    </>
  );
}

/** A brand new household. Only the owner can add budgets, so only the owner gets the way there. */
function NoBudgets({ isOwner }: { isOwner: boolean }) {
  if (!isOwner) return <EmptyState title="The owner has not set up any budgets yet." />;
  return (
    <EmptyState title="No budgets yet" action={<ButtonLink href="/budgets">Set up budgets</ButtonLink>}>
      A budget is a monthly amount for one kind of spending, such as groceries. Once there is one, this page shows how
      much is left each month.
    </EmptyState>
  );
}

/** The focal figure for the owner and members: the whole household's allocation minus everything spent. */
function LeftThisMonth({
  totals,
  month,
  isCurrent,
}: {
  totals: NonNullable<Dashboard['totals']>;
  month: string;
  isCurrent: boolean;
}) {
  const left = totals.allocatedSen - totals.spentSen;
  const when = isCurrent ? 'this month' : `in ${monthLabel(month)}`;
  return (
    <section aria-labelledby="left-heading">
      <h2 id="left-heading" className="text-muted">
        {left < 0 ? `Over budget ${when}` : `Left ${when}`}
      </h2>
      <p className={cx('mt-1 text-focal font-semibold', left < 0 ? 'text-danger' : 'text-ink')}>
        <Money sen={Math.abs(left)} />
      </p>
      <p className="mt-2 text-muted">
        <Money sen={totals.spentSen} /> spent of <Money sen={totals.allocatedSen} /> budgeted
      </p>
    </section>
  );
}

/** Budgets past their near-limit level or over, worst first. Names and state only, so it reads the same for every role. */
function NeedsAttention({ budgets }: { budgets: BudgetSummary[] }) {
  const over = budgets.filter((b) => b.state === 'over');
  const tight = budgets.filter((b) => b.state === 'tight');
  const flagged = [...over, ...tight];
  if (flagged.length === 0) return null;
  const title =
    flagged.length === 1 ? '1 budget is near or over its limit' : `${flagged.length} budgets are near or over their limit`;
  return (
    <section
      aria-labelledby="attention-heading"
      className={cx('mt-8 rounded-surface border bg-surface px-4 py-3', over.length > 0 ? 'border-danger' : 'border-warning')}
    >
      <h2 id="attention-heading" className="font-semibold text-ink">
        {title}
      </h2>
      <ul className="mt-1">
        {flagged.map((b) => (
          <li key={b.id} className="flex flex-wrap items-baseline gap-x-3 py-0.5">
            <span className="min-w-0 break-words text-ink">{b.name}</span>
            <StateTag state={b.state} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Each budget's state and what is left. Owners and members also get the meter and the amounts; a
 * guest's list has neither (the server never sent them), so for a guest it is the page's focal point
 * and the amounts left are set larger.
 */
function Budgets({ budgets, role }: { budgets: BudgetSummary[]; role: Viewer['role'] }) {
  const isGuest = role === 'guest';
  return (
    <section aria-labelledby="budgets-heading" className="mt-10">
      <h2 id="budgets-heading" className="text-lg font-semibold text-ink">
        {isGuest ? 'Left in each budget' : 'Budgets'}
      </h2>
      <ul className="mt-3 divide-y divide-line rounded-surface border border-line bg-surface">
        {budgets.map((b) => (
          <li key={b.id} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="min-w-0 font-semibold break-words text-ink">{b.name}</h3>
              <p className="text-ink">
                <Money sen={Math.abs(b.remainingSen)} className={cx('font-semibold', isGuest ? 'text-3xl' : 'text-lg')} />
                <span className="text-muted">{b.remainingSen < 0 ? ' over' : ' left'}</span>
              </p>
            </div>
            <div className="mt-1">
              <StateTag state={b.state} />
            </div>
            {b.allocationSen !== undefined && b.spentSen !== undefined && (
              <>
                {/* No label: the same amounts are written just below, so the meter is hidden from screen readers. */}
                <div className="mt-2">
                  <Meter value={b.spentSen} max={b.allocationSen} state={b.state} threshold={b.thresholdPct} />
                </div>
                <p className="mt-1 text-sm text-muted">
                  <Money sen={b.spentSen} /> spent of <Money sen={b.allocationSen} />
                </p>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Plain bars scaled to the largest amount, each with its amount written beside it, so the bar is
 * only a picture of a number already on screen. Phones: name and amount on one line, bar below.
 */
function SpendingByBudget({ rows }: { rows: NonNullable<Dashboard['byBudget']> }) {
  const largest = rows[0].spentSen;
  return (
    <section aria-labelledby="spending-heading" className="mt-10">
      <h2 id="spending-heading" className="text-lg font-semibold text-ink">
        Spending by budget
      </h2>
      <ul className="mt-3 flex flex-col gap-3">
        {rows.map((row) => (
          <li
            key={row.id ?? 'uncategorised'}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]"
          >
            <span className="col-start-1 row-start-1 min-w-0 break-words text-ink">{row.name}</span>
            <span aria-hidden="true" className="col-span-2 row-start-2 h-2.5 sm:col-span-1 sm:col-start-2 sm:row-start-1">
              <span className="block h-full min-w-0.5 bg-meter-fill" style={{ width: `${(row.spentSen / largest) * 100}%` }} />
            </span>
            <Money sen={row.spentSen} className="col-start-2 row-start-1 text-right text-ink sm:col-start-3" />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Recent({ data, isGuest }: { data: Dashboard; isGuest: boolean }) {
  const label = monthLabel(data.month);
  return (
    <section aria-labelledby="recent-heading">
      <h2 id="recent-heading" className="text-lg font-semibold text-ink">
        {isGuest ? 'Your latest transactions' : 'Latest transactions'}
      </h2>
      {data.recent.length === 0 ? (
        <p className="mt-2 text-muted">
          {isGuest ? `You have not added any transactions in ${label}.` : `No transactions in ${label}.`}
        </p>
      ) : (
        <>
          <div className="mt-3">
            <TransactionList rows={data.recent} />
          </div>
          <Link href={`/transactions?month=${data.month}`} className={cx(standaloneLink, 'mt-1')}>
            All transactions in {label}
          </Link>
        </>
      )}
    </section>
  );
}

/** Owner only. Debts are not tied to a month, so this is what is owed today. */
function OwedToYou({ debts }: { debts: NonNullable<Dashboard['debts']> }) {
  return (
    <section aria-labelledby="debts-heading" className="mt-10">
      <h2 id="debts-heading" className="text-lg font-semibold text-ink">
        Owed to you
      </h2>
      {debts.people.length === 0 ? (
        <p className="mt-2 text-muted">Nobody owes you money right now.</p>
      ) : (
        <>
          <p className="mt-1 text-2xl font-semibold text-ink">
            <Money sen={debts.outstandingSen} />
          </p>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {debts.people.map((p) => (
              <li key={p.name} className="flex items-baseline justify-between gap-4 py-2">
                <span className="min-w-0 break-words text-ink">{p.name}</span>
                <Money sen={p.outstandingSen} className="text-ink" />
              </li>
            ))}
          </ul>
        </>
      )}
      <Link href="/debts" className={cx(standaloneLink, 'mt-1')}>
        Open Debts
      </Link>
    </section>
  );
}
