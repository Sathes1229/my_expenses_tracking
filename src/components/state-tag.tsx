import type { Locale } from '@/i18n/locale';
import { messages } from '@/i18n/messages';
import type { BudgetState } from '@/lib/budget-state';
import { cx } from './cx';

// "On track" stays neutral on purpose: only the states that need attention get colour,
// so a list of budgets shows its problems at a glance. The word always carries the meaning.
const TONES = {
  fine: 'text-muted',
  tight: 'text-warning',
  over: 'text-danger',
} as const;

/** A budget's state for the month, as colour plus word, the word in the viewer's language. */
export function StateTag({ state, locale }: { state: BudgetState; locale: Locale }) {
  const word = messages[locale].budgets.states[state];
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap', TONES[state])}>
      <span aria-hidden="true" className="size-2 shrink-0 bg-current" />
      {word}
    </span>
  );
}
