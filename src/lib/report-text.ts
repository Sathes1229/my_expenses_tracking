/** How this month's total compares with last month's. No percent when last month had no spending. */
export function changeSummary(
  totalSen: number,
  previousTotalSen: number,
): { kind: 'more' | 'less' | 'same' | 'noPrevious'; diffSen: number; percent: number | null } {
  const diffSen = Math.abs(totalSen - previousTotalSen);
  if (previousTotalSen === 0) return { kind: 'noPrevious', diffSen, percent: null };
  const percent = Math.round((diffSen / previousTotalSen) * 100);
  if (totalSen === previousTotalSen) return { kind: 'same', diffSen: 0, percent: 0 };
  return { kind: totalSen > previousTotalSen ? 'more' : 'less', diffSen, percent };
}
