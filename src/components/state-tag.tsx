import type { BudgetState } from '@/lib/budget-state';
import { cx } from './cx';

// "On track" stays neutral on purpose: only the states that need attention get colour,
// so a list of budgets shows its problems at a glance. The word always carries the meaning.
const STATES = {
  fine: { word: 'On track', tone: 'text-muted' },
  tight: { word: 'Near limit', tone: 'text-warning' },
  over: { word: 'Over', tone: 'text-danger' },
} as const;

/** A budget's state for the month, as colour plus word. */
export function StateTag({ state }: { state: BudgetState }) {
  const { word, tone } = STATES[state];
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap', tone)}>
      <span aria-hidden="true" className="size-2 shrink-0 bg-current" />
      {word}
    </span>
  );
}
