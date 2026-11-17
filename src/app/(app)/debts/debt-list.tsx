import { cx } from '@/components/cx';
import { Money, MoneySentence } from '@/components/money';
import { fmt } from '@/i18n/format';
import { fmtNodes } from '@/i18n/format-nodes';
import type { Locale } from '@/i18n/locale';
import type { Messages } from '@/i18n/messages';
import { getLocale, getMessages } from '@/i18n/server';
import type { DebtEntry, DebtGroup, DebtStatus } from '@/lib/debts';
import { formatRM } from '@/lib/money';
import { DebtActions, DeletePayment } from './debt-forms';

const dayOptions = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' } satisfies Intl.DateTimeFormatOptions;
const day: Record<Locale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat('en-GB', dayOptions),
  ms: new Intl.DateTimeFormat('ms-MY', dayOptions),
};

/** "2026-11-01" as "1 Nov 2026". The string is a calendar date, so no time zone shifts it. */
function formatDay(value: string, locale: Locale): string {
  const [y, m, d] = value.split('-').map(Number);
  return day[locale].format(new Date(Date.UTC(y, m - 1, d)));
}

type DebtsText = Messages['debts'];

// Only a debt still being repaid gets colour; paid ones go quiet. The word carries the meaning.
const STATUS_TONE: Record<DebtStatus, string> = {
  unpaid: 'text-ink',
  'partly paid': 'text-warning',
  paid: 'text-muted',
};

// Sentence case, like the budget states ("Near limit").
const STATUS_WORD: Record<DebtStatus, keyof DebtsText['status']> = {
  unpaid: 'unpaid',
  'partly paid': 'partlyPaid',
  paid: 'paid',
};

function StatusWord({ status, t }: { status: DebtStatus; t: DebtsText }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap', STATUS_TONE[status])}>
      <span aria-hidden="true" className="size-2 shrink-0 bg-current" />
      {t.status[STATUS_WORD[status]]}
    </span>
  );
}

function Debt({
  debt,
  personName,
  today,
  locale,
  t,
}: {
  debt: DebtEntry;
  personName: string;
  today: string;
  locale: Locale;
  t: DebtsText;
}) {
  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-lg font-semibold text-ink">
          <Money sen={debt.amountSen} />
          <span className="text-base font-normal text-muted">{` ${t.lent}`}</span>
        </p>
        <StatusWord status={debt.status} t={t} />
      </div>
      <p className="mt-1 text-sm text-muted">
        {fmt(t.lentOn, { date: formatDay(debt.lentOn, locale) })}
        {debt.dueOn && (
          <>
            <span aria-hidden="true"> · </span>
            <span className="sr-only">. </span>
            {fmt(t.dueOn, { date: formatDay(debt.dueOn, locale) })}
          </>
        )}
      </p>
      {debt.note && <p className="mt-1 break-words text-ink">{debt.note}</p>}
      {debt.repaidSen > 0 && (
        <p className="mt-2 text-ink">
          <MoneySentence text={t.repaid} amounts={{ amount: debt.repaidSen }} />
          <span aria-hidden="true"> · </span>
          <span className="sr-only">. </span>
          <MoneySentence text={t.stillOwed} amounts={{ amount: debt.outstandingSen }} />
        </p>
      )}
      {debt.payments.length > 0 && (
        <ul className="mt-2 divide-y divide-line rounded-control border border-line">
          {debt.payments.map((payment) => {
            const paidOn = formatDay(payment.paidOn, locale);
            return (
              <li key={payment.id} className="flex flex-wrap items-center justify-between gap-x-3 pl-3 text-sm">
                <span className="py-2 text-muted">
                  {fmtNodes(t.paidOn, { amount: <Money sen={payment.amountSen} className="text-ink" />, date: paidOn })}
                </span>
                <DeletePayment
                  paymentId={payment.id}
                  label={fmt(t.payment, { amount: formatRM(payment.amountSen), date: paidOn })}
                />
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-2">
        <DebtActions
          debt={{
            id: debt.id,
            personName,
            amountSen: debt.amountSen,
            lentOn: debt.lentOn,
            dueOn: debt.dueOn,
            note: debt.note,
          }}
          outstandingSen={debt.outstandingSen}
          today={today}
        />
      </div>
    </li>
  );
}

/** People with their debts. A person's name is shown as written on their newest debt. */
export async function DebtList({ groups, today }: { groups: DebtGroup[]; today: string }) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.debts;
  return (
    <div className="flex flex-col gap-8">
      {groups.map((group, index) => (
        <section key={group.personName.toLowerCase()} aria-labelledby={`person-${index}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id={`person-${index}`} className="min-w-0 text-lg font-semibold break-words text-ink">
              {group.personName}
            </h2>
            <p className="text-ink">
              {group.outstandingSen > 0 ? (
                fmtNodes(t.owed, { amount: <Money sen={group.outstandingSen} className="font-semibold" /> })
              ) : (
                <span className="text-muted">{t.nothingOwed}</span>
              )}
            </p>
          </div>
          <ul className="mt-2 divide-y divide-line rounded-surface border border-line bg-surface">
            {group.debts.map((debt) => (
              <Debt key={debt.id} debt={debt} personName={group.personName} today={today} locale={locale} t={t} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
