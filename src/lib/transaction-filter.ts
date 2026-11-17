import type { Viewer } from '@/lib/auth/viewer';
import { latestMonth, parseMonthParam } from './time';
import { PAYMENT_METHODS, type PaymentMethod } from './transaction-types';
import type { TransactionFilter } from './transactions';

/** The filter choices as they sit in the address: empty means all, "none" is Uncategorised. */
export type FilterChoices = { budget: string; person: string; method: string };

export const UNCATEGORISED_CHOICE = 'none';

type Query = Record<string, string | string[] | undefined>;

function text(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

/**
 * The Transactions filter from the address, for the page and for the export alike. The month stops
 * at the latest one an entry can be in; a guest's list is always their own, so a person is ignored.
 */
export function filterFromQuery(viewer: Viewer, query: Query): { filter: TransactionFilter; choices: FilterChoices } {
  const asked = parseMonthParam(text(query.month) || undefined);
  const latest = latestMonth();
  const month = asked > latest ? latest : asked;
  const method = PAYMENT_METHODS.includes(text(query.method) as PaymentMethod) ? text(query.method) : '';
  const choices: FilterChoices = {
    budget: text(query.budget),
    person: viewer.role === 'guest' ? '' : text(query.person),
    method,
  };

  const filter: TransactionFilter = { month };
  if (choices.budget) filter.budgetId = choices.budget === UNCATEGORISED_CHOICE ? null : choices.budget;
  if (choices.person) filter.personId = choices.person;
  if (method) filter.paymentMethod = method as PaymentMethod;
  return { filter, choices };
}
