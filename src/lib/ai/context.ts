import type { Viewer } from '@/lib/auth/viewer';
import { listBudgetSummaries, type BudgetSummary } from '@/lib/budgets';
import { debtTotals } from '@/lib/debts';
import { formatRM } from '@/lib/money';
import { dayKey, monthKey, monthLabel, shiftMonth } from '@/lib/time';
import { listTransactions, PAYMENT_LABELS, type TransactionRow } from '@/lib/transactions';

const MONTHS = 3;
const TOP_MERCHANTS = 5;
// A guest's own transactions are listed one by one; past this many only the count is given.
const GUEST_ROWS = 40;

const STATE_WORDS: Record<BudgetSummary['state'], string> = {
  fine: 'on track',
  tight: 'near its limit',
  over: 'over budget',
};

// Names people typed (budgets, shops, debtors) are quoted so the model can see where the data ends.
const quote = (name: string) => JSON.stringify(name);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const WHO: Record<Viewer['role'], string> = {
  owner: "The person asking is the owner of this household's account. They see every budget, all spending, and the money they lent.",
  member:
    'The person asking is a member of the household. They see every budget and all spending, but not money the owner lent.',
  guest:
    "The person asking is a guest of the household. They see each budget's name, what is left in it and its state, and only their own spending. Nothing else is shared with them, so it is not given here.",
};

function today(now: Date): string {
  const [y, m, d] = dayKey(now).split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `Today is ${d} ${monthLabel(monthKey(now))} in Malaysia, day ${d} of ${daysInMonth} this month.`;
}

function left(remainingSen: number): string {
  return remainingSen < 0 ? `${formatRM(-remainingSen)} over` : `${formatRM(remainingSen)} left`;
}

/** Sums by a key, largest first, keeping the first spelling seen as the label. */
function totalsBy(rows: TransactionRow[], key: (row: TransactionRow) => string, label: (row: TransactionRow) => string) {
  const groups = new Map<string, { label: string; totalSen: number; count: number }>();
  for (const row of rows) {
    const group = groups.get(key(row)) ?? { label: label(row), totalSen: 0, count: 0 };
    group.totalSen += row.totalSen;
    group.count += 1;
    groups.set(key(row), group);
  }
  return [...groups.values()].sort((a, b) => b.totalSen - a.totalSen || a.label.localeCompare(b.label));
}

function householdLines(budgets: BudgetSummary[], months: string[], rowsByMonth: TransactionRow[][], span: string): string[] {
  const month = months.at(-1)!;
  const lines: string[] = [];
  if (budgets.length === 0) {
    lines.push('There are no budgets yet.');
  } else {
    lines.push(`Budgets for ${monthLabel(month)}:`);
    for (const b of budgets) {
      lines.push(
        `- ${quote(b.name)}: ${formatRM(b.allocationSen ?? 0)} budgeted, ${formatRM(b.spentSen ?? 0)} spent, ${left(b.remainingSen)}, ${STATE_WORDS[b.state]}`,
      );
    }
    const spent = rowsByMonth.at(-1)!.reduce((sum, row) => sum + row.totalSen, 0);
    const allocated = budgets.reduce((sum, b) => sum + (b.allocationSen ?? 0), 0);
    lines.push(`Altogether this month: ${formatRM(spent)} spent of ${formatRM(allocated)} budgeted.`);
  }

  lines.push('', 'Spending by budget:');
  months.forEach((m, i) => {
    const byBudget = totalsBy(rowsByMonth[i], (row) => row.budgetName, (row) => row.budgetName);
    const text = byBudget.map((g) => `${quote(g.label)} ${formatRM(g.totalSen)}`).join(', ');
    lines.push(`- ${monthLabel(m)}: ${text || 'nothing spent'}`);
  });

  const rows = rowsByMonth.flat();
  if (rows.length === 0) return lines;
  const merchants = totalsBy(rows, (row) => row.merchant.toLowerCase(), (row) => row.merchant).slice(0, TOP_MERCHANTS);
  lines.push('', `Top ${merchants.length === 1 ? 'shop' : `${merchants.length} shops`}, ${span}:`);
  for (const g of merchants) lines.push(`- ${quote(g.label)}: ${formatRM(g.totalSen)} in ${plural(g.count, 'transaction')}`);

  const grand = rows.reduce((sum, row) => sum + row.totalSen, 0);
  lines.push('', `How it was paid, ${span}:`);
  for (const g of totalsBy(rows, (row) => row.paymentMethod, (row) => PAYMENT_LABELS[row.paymentMethod])) {
    lines.push(`- ${g.label}: ${formatRM(g.totalSen)}, ${Math.round((g.totalSen * 100) / grand)}% of spending, ${plural(g.count, 'transaction')}`);
  }
  return lines;
}

function guestLines(budgets: BudgetSummary[], months: string[], rowsByMonth: TransactionRow[][], span: string): string[] {
  const lines: string[] = [];
  if (budgets.length === 0) {
    lines.push('There are no budgets yet.');
  } else {
    lines.push(`Budgets for ${monthLabel(months.at(-1)!)}, with what is left and the state:`);
    for (const b of budgets) lines.push(`- ${quote(b.name)}: ${left(b.remainingSen)}, ${STATE_WORDS[b.state]}`);
  }

  lines.push('', 'Their own spending per month:');
  months.forEach((m, i) => {
    const total = rowsByMonth[i].reduce((sum, row) => sum + row.totalSen, 0);
    lines.push(`- ${monthLabel(m)}: ${total > 0 ? formatRM(total) : 'nothing spent'}`);
  });

  const rows = rowsByMonth.flat().sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  if (rows.length === 0) return lines;
  lines.push('', `Their own transactions, ${span}, newest first:`);
  for (const row of rows.slice(0, GUEST_ROWS)) {
    lines.push(
      `- ${dayKey(row.occurredAt)} ${quote(row.merchant)} ${formatRM(row.totalSen)}, ${PAYMENT_LABELS[row.paymentMethod]}, ${quote(row.budgetName)}`,
    );
  }
  if (rows.length > GUEST_ROWS) lines.push(`- and ${plural(rows.length - GUEST_ROWS, 'earlier transaction')} not listed`);
  return lines;
}

function debtLines(debts: Awaited<ReturnType<typeof debtTotals>>): string[] {
  if (debts.people.length === 0) return ['', 'Nobody owes the owner money right now.'];
  return [
    '',
    `Money the owner lent that is still owed: ${formatRM(debts.outstandingSen)} in total.`,
    ...debts.people.map((p) => `- ${quote(p.name)}: ${formatRM(p.outstandingSen)}`),
  ];
}

/**
 * The figures the assistant is given with each question: this month and the two before it.
 * Built only from the reads that already apply each role's visibility (a guest's budget summaries
 * carry no amounts and their transaction list holds only their own rows; debts are owner only), so
 * nothing reaches the model that the person could not open in the app. Transaction rows carry no
 * notes or items, and who made each one is never written here.
 */
export async function buildAssistantContext(viewer: Viewer): Promise<string> {
  const now = new Date();
  const month = monthKey(now);
  const months = Array.from({ length: MONTHS }, (_, i) => shiftMonth(month, i - (MONTHS - 1)));
  const [budgets, rowsByMonth, debts] = await Promise.all([
    listBudgetSummaries(viewer, month),
    Promise.all(months.map((m) => listTransactions(viewer, { month: m }))),
    viewer.role === 'owner' ? debtTotals(viewer) : null,
  ]);
  const span = `${monthLabel(months[0])} to ${monthLabel(month)}`;
  const body =
    viewer.role === 'guest'
      ? guestLines(budgets, months, rowsByMonth, span)
      : householdLines(budgets, months, rowsByMonth, span);
  return [today(now), WHO[viewer.role], '', ...body, ...(debts ? debtLines(debts) : [])].join('\n');
}
