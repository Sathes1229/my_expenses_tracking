import { db } from '@/db/client';
import { assertOwner, type Viewer } from '@/lib/auth/viewer';
import { insertBudget, type NewBudget } from './budgets';
import { ValidationError } from './errors';

export { isStarterKey, STARTER_KEYS, type StarterKey } from './starter-keys';

/** Creates the picked budgets together: if one breaks a budget rule, none are created. Owner only. */
export async function createStarterBudgets(owner: Viewer, picks: NewBudget[]): Promise<void> {
  assertOwner(owner);
  if (picks.length === 0) throw new ValidationError('pick', 'starterNoneChosen');
  db.transaction((tx) => {
    for (const pick of picks) insertBudget(tx, pick);
  });
}
