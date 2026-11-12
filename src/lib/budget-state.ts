export type BudgetState = 'fine' | 'tight' | 'over';

/**
 * The one rule for a budget's state, shared by the state word and the meter colour.
 * Over means spent more than the allocation (so any spending against zero is over);
 * tight means spent has reached the threshold share of it. Whole sen in, no division,
 * so the boundary is exact. Nothing spent is always fine.
 */
export function budgetState(spentSen: number, allocationSen: number, thresholdPct: number): BudgetState {
  if (spentSen > allocationSen) return 'over';
  if (spentSen > 0 && spentSen * 100 >= allocationSen * thresholdPct) return 'tight';
  return 'fine';
}
