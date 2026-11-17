import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ButtonLink } from '@/components/button-link';
import { cx } from '@/components/cx';
import { EmptyState } from '@/components/empty-state';
import { CameraIcon } from '@/components/icons';
import { Meter } from '@/components/meter';
import { Money, MoneySentence } from '@/components/money';
import { PageHeader } from '@/components/page-header';
import { StateTag } from '@/components/state-tag';
import { fmt } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';
import type { Messages } from '@/i18n/messages';
import { getLocale, getMessages } from '@/i18n/server';
import { requireViewer } from '@/lib/auth/viewer';
import type { BudgetSummary } from '@/lib/budgets';
import { getDashboard, type Dashboard } from '@/lib/dashboard';
import { monthKey, monthLabel, parseMonthParam, shiftMonth } from '@/lib/time';
import { TransactionList } from './transactions/transaction-list';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).home.pageTitle };
}

// Blocks on the session read, like the (app) layout.
export const instant = false;

export default async function HomePage({ searchParams }: PageProps<'/'>) {
  const t = (await getMessages()).home;
  return (
    <Suspense
      fallback={
        <p role="status" className="text-muted">
          {t.loading}
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
  const [locale, m, data] = await Promise.all([getLocale(), getMessages(), getDashboard(viewer, month)]);
  const t = m.home;
  const isOwner = viewer.role === 'owner';
  const isGuest = viewer.role === 'guest';
  const hasBudgets = data.budgets.length > 0;

  return (
    <>
      <PageHeader
        title={monthLabel(month, locale)}
        action={
          <nav aria-label={m.common.month} className="flex flex-wrap gap-2">
            <ButtonLink variant="secondary" href={`/?month=${shiftMonth(month, -1)}`}>
              {m.common.previousMonth}
            </ButtonLink>
            {month < thisMonth && (
              <ButtonLink variant="secondary" href={`/?month=${shiftMonth(month, 1)}`}>
                {m.common.nextMonth}
              </ButtonLink>
            )}
          </nav>
        }
      />

      {/* Wide screens: the budget picture on the left, activity beside it. Phones: one column, in that order. */}
      <div className="mt-8 grid grid-cols-1 gap-x-12 gap-y-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {/* A guest gets no budgets from the server, so nothing about them shows here. */}
          {!isGuest &&
            (!hasBudgets ? (
              <NoBudgets isOwner={isOwner} m={m} />
            ) : (
              data.totals && (
                <LeftThisMonth totals={data.totals} month={month} isCurrent={month === thisMonth} t={t} locale={locale} />
              )
            ))}
          {/* First in the column for a guest, who has no total above it. */}
          <div className="mt-6 flex flex-wrap gap-3 first:mt-0">
            <ButtonLink href="/transactions/scan" variant={isOwner && !hasBudgets ? 'secondary' : 'primary'} className="gap-2">
              <CameraIcon />
              {t.scanReceipt}
            </ButtonLink>
            <ButtonLink href="/transactions/new" variant="secondary">
              {t.addManually}
            </ButtonLink>
          </div>
          <NeedsAttention budgets={data.budgets} t={t} locale={locale} />
          {hasBudgets && <Budgets budgets={data.budgets} t={m.budgets} locale={locale} />}
          {data.byBudget && data.byBudget.length > 0 && <SpendingByBudget rows={data.byBudget} m={m} />}
        </div>
        <div className="min-w-0">
          <Recent data={data} isGuest={isGuest} t={t} locale={locale} />
          {data.debts && <OwedToYou debts={data.debts} t={t} />}
        </div>
      </div>
    </>
  );
}

/** A brand new household. Only the owner can add budgets, so only the owner gets the way there. */
function NoBudgets({ isOwner, m }: { isOwner: boolean; m: Messages }) {
  if (!isOwner) return <EmptyState title={m.home.ownerHasNoBudgets} />;
  return (
    <EmptyState title={m.budgets.emptyTitle} action={<ButtonLink href="/budgets">{m.home.setUpBudgets}</ButtonLink>}>
      {m.home.noBudgetsBody}
    </EmptyState>
  );
}

/** The focal figure for the owner and members: the whole household's allocation minus everything spent. */
function LeftThisMonth({
  totals,
  month,
  isCurrent,
  t,
  locale,
}: {
  totals: NonNullable<Dashboard['totals']>;
  month: string;
  isCurrent: boolean;
  t: Messages['home'];
  locale: Locale;
}) {
  const left = totals.allocatedSen - totals.spentSen;
  const values = { month: monthLabel(month, locale) };
  const heading = left < 0 ? (isCurrent ? t.overThisMonth : fmt(t.overIn, values)) : isCurrent ? t.leftThisMonth : fmt(t.leftIn, values);
  return (
    <section aria-labelledby="left-heading">
      <h2 id="left-heading" className="text-muted">
        {heading}
      </h2>
      <p className={cx('mt-1 text-focal font-semibold', left < 0 ? 'text-danger' : 'text-ink')}>
        <Money sen={Math.abs(left)} />
      </p>
      <p className="mt-2 text-muted">
        <MoneySentence text={t.spentOfBudgeted} amounts={{ spent: totals.spentSen, budgeted: totals.allocatedSen }} />
      </p>
    </section>
  );
}

/** Budgets past their near-limit level or over, worst first. Owners and members only: a guest's dashboard has no budgets. */
function NeedsAttention({ budgets, t, locale }: { budgets: BudgetSummary[]; t: Messages['home']; locale: Locale }) {
  const over = budgets.filter((b) => b.state === 'over');
  const tight = budgets.filter((b) => b.state === 'tight');
  const flagged = [...over, ...tight];
  if (flagged.length === 0) return null;
  const title = flagged.length === 1 ? t.oneFlagged : fmt(t.manyFlagged, { count: flagged.length });
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
            <StateTag state={b.state} locale={locale} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Each budget's state, what is left, the meter and the amounts. Owners and members only. */
function Budgets({ budgets, t, locale }: { budgets: BudgetSummary[]; t: Messages['budgets']; locale: Locale }) {
  return (
    <section aria-labelledby="budgets-heading" className="mt-10">
      <h2 id="budgets-heading" className="text-lg font-semibold text-ink">
        {t.title}
      </h2>
      <ul className="mt-3 divide-y divide-line rounded-surface border border-line bg-surface">
        {budgets.map((b) => (
          <li key={b.id} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="min-w-0 font-semibold break-words text-ink">{b.name}</h3>
              <p className="text-ink">
                <Money sen={Math.abs(b.remainingSen)} className="text-lg font-semibold" />
                <span className="text-muted">{` ${b.remainingSen < 0 ? t.over : t.left}`}</span>
              </p>
            </div>
            <div className="mt-1">
              <StateTag state={b.state} locale={locale} />
            </div>
            {/* No label: the same amounts are written just below, so the meter is hidden from screen readers. */}
            <div className="mt-2">
              <Meter value={b.spentSen} max={b.allocationSen} state={b.state} threshold={b.thresholdPct} />
            </div>
            <p className="mt-1 text-sm text-muted">
              <MoneySentence text={t.spentOf} amounts={{ spent: b.spentSen, allocation: b.allocationSen }} />
            </p>
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
function SpendingByBudget({ rows, m }: { rows: NonNullable<Dashboard['byBudget']>; m: Messages }) {
  const largest = rows[0].spentSen;
  const nameOf = (row: (typeof rows)[number]) => {
    if (row.id === null) return m.common.uncategorised;
    return row.archived ? fmt(m.common.archived, { name: row.name }) : row.name;
  };
  return (
    <section aria-labelledby="spending-heading" className="mt-10">
      <h2 id="spending-heading" className="text-lg font-semibold text-ink">
        {m.home.spendingByBudget}
      </h2>
      <ul className="mt-3 flex flex-col gap-3">
        {rows.map((row) => (
          <li
            key={row.id ?? 'uncategorised'}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]"
          >
            <span className="col-start-1 row-start-1 min-w-0 break-words text-ink">{nameOf(row)}</span>
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

function Recent({ data, isGuest, t, locale }: { data: Dashboard; isGuest: boolean; t: Messages['home']; locale: Locale }) {
  const values = { month: monthLabel(data.month, locale) };
  return (
    <section aria-labelledby="recent-heading">
      <h2 id="recent-heading" className="text-lg font-semibold text-ink">
        {isGuest ? t.yourLatestTransactions : t.latestTransactions}
      </h2>
      {data.recent.length === 0 ? (
        <p className="mt-2 text-muted">{fmt(isGuest ? t.youAddedNone : t.noTransactions, values)}</p>
      ) : (
        <>
          <div className="mt-3">
            <TransactionList rows={data.recent} locale={locale} />
          </div>
          <Link href={`/transactions?month=${data.month}`} className={cx(standaloneLink, 'mt-1')}>
            {fmt(t.allTransactionsIn, values)}
          </Link>
        </>
      )}
    </section>
  );
}

/** Owner only. Debts are not tied to a month, so this is what is owed today. */
function OwedToYou({ debts, t }: { debts: NonNullable<Dashboard['debts']>; t: Messages['home'] }) {
  return (
    <section aria-labelledby="debts-heading" className="mt-10">
      <h2 id="debts-heading" className="text-lg font-semibold text-ink">
        {t.owedToYou}
      </h2>
      {debts.people.length === 0 ? (
        <p className="mt-2 text-muted">{t.nobodyOwes}</p>
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
        {t.openDebts}
      </Link>
    </section>
  );
}
