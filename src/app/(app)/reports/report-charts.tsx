import { Money } from '@/components/money';
import { fmt } from '@/i18n/format';
import type { Messages } from '@/i18n/messages';
import { formatRM } from '@/lib/money';
import type { DailyPoint, ReportRow } from '@/lib/reports';

type Labels = { thisMonth: string; lastMonth: string };

/** The two-key legend: solid for this month, lighter for last month (the line is dashed too). */
export function Legend({ labels }: { labels: Labels }) {
  return (
    <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="inline-block size-2.5 bg-meter-fill" />
        {labels.thisMonth}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="inline-block size-2.5 bg-line-strong" />
        {labels.lastMonth}
      </span>
    </p>
  );
}

/**
 * Each budget with two bars on one scale, this month over last month. Every amount is written out,
 * so the bars are only a picture of numbers already on screen and are hidden from screen readers.
 */
export function PairedBars({
  rows,
  t,
  nameOf,
  lastLabel,
}: {
  rows: ReportRow[];
  t: Messages['reports'];
  nameOf: (row: ReportRow) => string;
  /** Last month's name, for the amount written under each row. */
  lastLabel: string;
}) {
  const largest = Math.max(1, ...rows.flatMap((row) => [row.thisSen, row.lastSen]));
  return (
    <ul className="mt-3 flex flex-col gap-4">
      {rows.map((row) => {
        const diff = row.thisSen - row.lastSen;
        const change =
          diff === 0
            ? t.rowSame
            : fmt(diff > 0 ? t.rowMore : t.rowLess, { amount: formatRM(Math.abs(diff)) });
        return (
          <li key={row.id ?? 'uncategorised'}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <span className="min-w-0 break-words text-ink">{nameOf(row)}</span>
              <span className="text-right">
                <Money sen={row.thisSen} className="font-semibold text-ink" />
                <span className={diff > 0 ? 'ml-2 text-sm text-danger' : 'ml-2 text-sm text-muted'}>{change}</span>
              </span>
            </div>
            <p className="text-sm text-muted">{fmt(t.lastMonthAmount, { month: lastLabel, amount: formatRM(row.lastSen) })}</p>
            <span aria-hidden="true" className="mt-1.5 flex flex-col gap-1">
              <span className="block h-2.5">
                <span className="block h-full min-w-0.5 bg-meter-fill" style={{ width: `${(row.thisSen / largest) * 100}%` }} />
              </span>
              <span className="block h-2.5">
                <span className="block h-full min-w-0.5 bg-line-strong" style={{ width: `${(row.lastSen / largest) * 100}%` }} />
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const WIDTH = 320;
const HEIGHT = 160;
const PAD = { left: 8, right: 8, top: 10, bottom: 18 };

/** Running totals for this month and last month as two lines; last month dashed, so colour is not the only cue. */
export function DailyLines({ daily, label }: { daily: DailyPoint[]; label: string }) {
  const top = Math.max(1, ...daily.flatMap((p) => [p.thisSen ?? 0, p.lastSen ?? 0]));
  const x = (day: number) => PAD.left + ((day - 1) / Math.max(1, daily.length - 1)) * (WIDTH - PAD.left - PAD.right);
  const y = (sen: number) => HEIGHT - PAD.bottom - (sen / top) * (HEIGHT - PAD.top - PAD.bottom);
  const points = (key: 'thisSen' | 'lastSen') =>
    daily
      .filter((p) => p[key] !== null)
      .map((p) => `${x(p.day).toFixed(1)},${y(p[key] as number).toFixed(1)}`)
      .join(' ');
  const lastThis = [...daily].reverse().find((p) => p.thisSen !== null);
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} className="mt-3 h-auto w-full">
      <line x1={PAD.left} x2={WIDTH - PAD.right} y1={HEIGHT - PAD.bottom} y2={HEIGHT - PAD.bottom} className="stroke-line" />
      <polyline points={points('lastSen')} fill="none" strokeWidth="2.5" strokeDasharray="6 4" className="stroke-line-strong" />
      <polyline points={points('thisSen')} fill="none" strokeWidth="2.5" className="stroke-meter-fill" />
      {lastThis && <circle cx={x(lastThis.day)} cy={y(lastThis.thisSen as number)} r="3.5" className="fill-meter-fill" />}
      <text x={PAD.left} y={HEIGHT - 3} className="fill-muted text-[10px]">
        1
      </text>
      <text x={WIDTH - PAD.right} y={HEIGHT - 3} textAnchor="end" className="fill-muted text-[10px]">
        {daily.length}
      </text>
    </svg>
  );
}
