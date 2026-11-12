import { Meter } from '@/components/meter';
import { Money } from '@/components/money';
import { StateTag } from '@/components/state-tag';
import type { Role } from '@/lib/auth/viewer';
import type { BudgetSummary } from '@/lib/budgets';
import { BudgetActions } from './budget-forms';

/**
 * Owners and members see the amounts and the meter; guests get the name, what is left and the
 * state, because that is all the server sent them. The owner also gets Edit and Archive.
 */
export function BudgetList({ budgets, role }: { budgets: BudgetSummary[]; role: Role }) {
  return (
    <ul className="divide-y divide-line rounded-surface border border-line bg-surface">
      {budgets.map((budget) => (
        <li key={budget.id} className="px-4 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="min-w-0 text-base font-semibold break-words text-ink">{budget.name}</h2>
            <p className="text-lg font-semibold text-ink">
              <Money sen={Math.abs(budget.remainingSen)} />
              <span className="text-base font-normal text-muted">{budget.remainingSen < 0 ? ' over' : ' left'}</span>
            </p>
          </div>
          <div className="mt-1">
            <StateTag state={budget.state} />
          </div>
          {budget.allocationSen !== undefined && budget.spentSen !== undefined && budget.thresholdPct !== undefined && (
            <>
              <div className="mt-3">
                <Meter
                  value={budget.spentSen}
                  max={budget.allocationSen}
                  state={budget.state}
                  threshold={budget.thresholdPct}
                  label={`${budget.name} budget used`}
                />
              </div>
              <p className="mt-2 text-sm text-muted">
                <Money sen={budget.spentSen} /> spent of <Money sen={budget.allocationSen} />
                <span aria-hidden="true"> · </span>
                <span className="sr-only">. </span>
                Near limit from {budget.thresholdPct}%
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
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
