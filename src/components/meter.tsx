import type { BudgetState } from '@/lib/budget-state';
import { cx } from './cx';
import { meterParts } from './meter-parts';

type MeterProps = {
  value: number;
  max: number;
  /** From budgetState(), the same value the StateTag shows, so colour and word always agree. */
  state: BudgetState;
  /** Threshold as a percentage of max (a budget's alert level). Draws the tick. */
  threshold?: number;
  /**
   * Names the meter for screen readers, for example "Groceries budget used". Leave it out
   * only when the same amounts are already written as text beside the meter; it is then
   * hidden from assistive technology as a duplicate.
   */
  label?: string;
};

/**
 * The app's one identity motif: a thin bar with a tick at the threshold. Used for budgets,
 * the dashboard and the AI budget, nowhere else. The fill is ink until the threshold,
 * amber when the state is tight, red when over (the colour comes from the state, never recomputed here).
 */
export function Meter({ value, max, state, threshold, label }: MeterProps) {
  const { fillPct, thresholdPct } = meterParts(value, max, threshold);
  const usedPct = max > 0 ? Math.round((value / max) * 100) : 0;

  const a11y = label
    ? {
        role: 'meter',
        'aria-label': label,
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': Math.round(fillPct),
        'aria-valuetext': `${usedPct}% used`,
      }
    : { 'aria-hidden': true };

  return (
    <div {...a11y} className="relative h-3.5 w-full">
      <div className="absolute inset-x-0 top-1 h-1.5 bg-meter-track">
        <div
          className={cx(
            'h-full transition-state',
            state === 'over' ? 'bg-danger' : state === 'tight' ? 'bg-warning' : 'bg-meter-fill',
          )}
          style={{ width: `${fillPct}%` }}
        />
      </div>
      {thresholdPct !== null && (
        <div
          className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-ink"
          style={{ left: `${thresholdPct}%` }}
        />
      )}
    </div>
  );
}
