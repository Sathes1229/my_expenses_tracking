import { Meter } from '@/components/meter';
import { Money, MoneySentence } from '@/components/money';
import { StateTag } from '@/components/state-tag';
import { fmt } from '@/i18n/format';
import { getLocale, getMessages } from '@/i18n/server';
import type { Role } from '@/lib/auth/viewer';
import type { BudgetSummary } from '@/lib/budgets';
import { BudgetActions } from './budget-forms';

/** Owners and members see the amounts and the meter (guests get a names-only list). The owner also gets Edit and Archive. */
export async function BudgetList({ budgets, role }: { budgets: BudgetSummary[]; role: Role }) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  const t = messages.budgets;
  return (
    <ul className="divide-y divide-line rounded-surface border border-line bg-surface">
      {budgets.map((budget) => (
        <li key={budget.id} className="px-4 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="min-w-0 text-base font-semibold break-words text-ink">{budget.name}</h2>
            <p className="text-lg font-semibold text-ink">
              <Money sen={Math.abs(budget.remainingSen)} />
              <span className="text-base font-normal text-muted">{` ${budget.remainingSen < 0 ? t.over : t.left}`}</span>
            </p>
          </div>
          <div className="mt-1">
            <StateTag state={budget.state} locale={locale} />
          </div>
          <div className="mt-3">
            <Meter
              value={budget.spentSen}
              max={budget.allocationSen}
              state={budget.state}
              threshold={budget.thresholdPct}
              label={fmt(t.meterLabel, { name: budget.name })}
              locale={locale}
            />
          </div>
          <p className="mt-2 text-sm text-muted">
            <MoneySentence text={t.spentOf} amounts={{ spent: budget.spentSen, allocation: budget.allocationSen }} />
            <span aria-hidden="true"> · </span>
            <span className="sr-only">. </span>
            {fmt(t.nearLimitFrom, { percent: budget.thresholdPct })}
          </p>
          {role === 'owner' && (
            <div className="mt-2">
              <BudgetActions
                budget={{
                  id: budget.id,
                  name: budget.name,
                  allocationSen: budget.allocationSen,
                  thresholdPct: budget.thresholdPct,
                }}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
