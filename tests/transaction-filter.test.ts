import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Viewer } from '@/lib/auth/viewer';
import { filterFromQuery } from '@/lib/transaction-filter';

const member: Viewer = { id: 'm', role: 'member', displayName: 'Siti' };
const guest: Viewer = { id: 'g', role: 'guest', displayName: 'Ali' };

beforeEach(() => vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-17T04:00:00Z') }));
afterEach(() => vi.useRealTimers());

describe('filterFromQuery', () => {
  it('falls back to the current month for a bad month', () => {
    expect(filterFromQuery(member, { month: 'abc' }).filter.month).toBe('2026-11');
    expect(filterFromQuery(member, {}).filter.month).toBe('2026-11');
  });

  it('stops at the latest month an entry can be in', () => {
    expect(filterFromQuery(member, { month: '2027-05' }).filter.month).toBe('2026-11');
    expect(filterFromQuery(member, { month: '2026-03' }).filter.month).toBe('2026-03');
  });

  it('drops a payment method the app does not have', () => {
    const { filter, choices } = filterFromQuery(member, { month: '2026-11', method: 'bitcoin' });
    expect(filter.paymentMethod).toBeUndefined();
    expect(choices.method).toBe('');
    expect(filterFromQuery(member, { method: 'card' }).filter.paymentMethod).toBe('card');
  });

  it('reads "none" as Uncategorised and an id as that budget', () => {
    expect(filterFromQuery(member, { budget: 'none' }).filter.budgetId).toBeNull();
    expect(filterFromQuery(member, { budget: 'b1' }).filter.budgetId).toBe('b1');
    expect('budgetId' in filterFromQuery(member, {}).filter).toBe(false);
  });

  it("ignores a person for a guest, whose list is always their own", () => {
    const { filter, choices } = filterFromQuery(guest, { person: 'someone-else' });
    expect(filter.personId).toBeUndefined();
    expect(choices.person).toBe('');
    expect(filterFromQuery(member, { person: 'p1' }).filter.personId).toBe('p1');
  });

  it('takes only single values from the address', () => {
    expect(filterFromQuery(member, { month: ['2026-03', '2026-04'], budget: ['a', 'b'] }).filter).toEqual({ month: '2026-11' });
  });
});
