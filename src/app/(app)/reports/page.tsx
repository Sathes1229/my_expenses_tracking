import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ButtonLink } from '@/components/button-link';
import { EmptyState } from '@/components/empty-state';
import { Money } from '@/components/money';
import { PageHeader } from '@/components/page-header';
import { fmt } from '@/i18n/format';
import type { Messages } from '@/i18n/messages';
import { getLocale, getMessages } from '@/i18n/server';
import { requireViewer } from '@/lib/auth/viewer';
import { formatRM } from '@/lib/money';
import { changeSummary } from '@/lib/report-text';
import { getMonthReport, type ReportRow } from '@/lib/reports';
import { dayMonthLabel, latestMonth, monthKey, monthLabel, parseMonthParam, shiftMonth } from '@/lib/time';
import { DailyLines, Legend, PairedBars } from './report-charts';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).reports.pageTitle };
}

// Blocks on the session read, like the (app) layout.
export const instant = false;

export default async function ReportsPage({ searchParams }: PageProps<'/reports'>) {
  const t = (await getMessages()).reports;
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
        <Report searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// Every page checks the session itself: the layout does not re-run on client navigation.
async function Report({ searchParams }: Pick<PageProps<'/reports'>, 'searchParams'>) {
  const viewer = await requireViewer();
  // The report is household figures, which a guest never sees.
  if (viewer.role === 'guest') notFound();
  const [locale, messages, query] = await Promise.all([getLocale(), getMessages(), searchParams]);
  const t = messages.reports;
  const asked = parseMonthParam(typeof query.month === 'string' ? query.month : undefined);
  const latest = latestMonth();
  const month = asked > latest ? latest : asked;
  const report = await getMonthReport(viewer, month);

  const thisLabel = monthLabel(report.month, locale);
  const lastLabel = monthLabel(report.previous, locale);
  const nameOf = (row: ReportRow) => {
    if (row.id === null) return t.uncategorised;
    return row.archived ? fmt(t.archived, { name: row.name }) : row.name;
  };

  return (
    <>
      <PageHeader title={t.title} />
      <nav aria-label={t.monthNav} className="mt-4 flex flex-wrap items-center gap-2">
        <div className="w-full">
          <p className="text-lg font-semibold text-ink">{thisLabel}</p>
          <p className="text-muted">{fmt(t.comparedWith, { month: lastLabel })}</p>
        </div>
        <ButtonLink variant="secondary" href={`/reports?month=${shiftMonth(month, -1)}`}>
          {t.previousMonth}
        </ButtonLink>
        {month < latest && (
          <ButtonLink variant="secondary" href={`/reports?month=${shiftMonth(month, 1)}`}>
            {t.nextMonth}
          </ButtonLink>
        )}
      </nav>

      {report.totalSen === 0 && report.previousTotalSen === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={fmt(t.emptyTitle, { month: thisLabel, previous: lastLabel })}
            action={<ButtonLink href="/transactions/new">{t.addTransaction}</ButtonLink>}
          >
            {t.emptyBody}
          </EmptyState>
        </div>
      ) : (
        <>
          <Summary total={report.totalSen} previousTotal={report.previousTotalSen} isCurrent={month === monthKey(new Date())} thisLabel={thisLabel} lastLabel={lastLabel} t={t} />

          <section aria-labelledby="by-budget-heading" className="mt-6 rounded-surface border border-line bg-surface px-4 py-4">
            <h2 id="by-budget-heading" className="font-semibold text-ink">
              {t.byBudget}
            </h2>
            <Legend labels={{ thisMonth: thisLabel, lastMonth: lastLabel }} />
            <PairedBars rows={report.byBudget} t={t} nameOf={nameOf} />
          </section>

          <section aria-labelledby="daily-heading" className="mt-6 rounded-surface border border-line bg-surface px-4 py-4">
            <h2 id="daily-heading" className="font-semibold text-ink">
              {t.dayByDay}
            </h2>
            <DailyLines
              daily={report.daily}
              label={fmt(t.chartLabel, {
                total: formatRM(report.totalSen),
                month: thisLabel,
                previousTotal: formatRM(report.previousTotalSen),
                previous: lastLabel,
              })}
            />
            <Legend labels={{ thisMonth: thisLabel, lastMonth: lastLabel }} />
            {report.sameDay && (
              <p className="mt-3 text-ink">
                {fmt(t.sameDay, {
                  thisDay: dayMonthLabel(report.month, report.sameDay.day, locale),
                  thisAmount: formatRM(report.sameDay.thisSen),
                  lastDay: dayMonthLabel(report.previous, report.sameDay.day, locale),
                  lastAmount: formatRM(report.sameDay.lastSen),
                })}
              </p>
            )}
          </section>
        </>
      )}
    </>
  );
}

function Summary({
  total,
  previousTotal,
  isCurrent,
  thisLabel,
  lastLabel,
  t,
}: {
  total: number;
  previousTotal: number;
  isCurrent: boolean;
  thisLabel: string;
  lastLabel: string;
  t: Messages['reports'];
}) {
  const change = changeSummary(total, previousTotal);
  const values = { amount: formatRM(change.diffSen), percent: change.percent ?? 0, month: lastLabel, previous: formatRM(previousTotal) };
  const sentence = {
    more: fmt(t.more, values),
    less: fmt(t.less, values),
    same: fmt(t.same, values),
    noPrevious: fmt(t.noPrevious, { month: lastLabel }),
  }[change.kind];
  return (
    <section aria-labelledby="summary-heading" className="mt-6 rounded-surface border border-line bg-surface px-4 py-4">
      <h2 id="summary-heading" className="text-muted">
        {isCurrent ? t.spentThisMonth : fmt(t.spentIn, { month: thisLabel })}
      </h2>
      <p className="mt-1 text-focal font-semibold text-ink">
        <Money sen={total} />
      </p>
      <p className={change.kind === 'more' ? 'mt-2 font-medium text-danger' : 'mt-2 text-muted'}>{sentence}</p>
    </section>
  );
}
