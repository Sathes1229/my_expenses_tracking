import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Money } from '@/components/money';
import { PageHeader } from '@/components/page-header';
import { requireViewer } from '@/lib/auth/viewer';
import { debtTotals, listDebts } from '@/lib/debts';
import { dayKey } from '@/lib/time';
import { RecordDebt } from './debt-forms';
import { DebtList } from './debt-list';

// No page title on purpose: the tab of a member who opens this address must not say the page exists.

// Blocks on the session read, like the (app) layout.
export const instant = false;

export default function DebtsPage() {
  return (
    <div className="max-w-3xl">
      {/* No "Debts" title here: this shows before the owner check, and a member must learn nothing from it. */}
      <Suspense
        fallback={
          <p role="status" className="text-muted">
            Loading…
          </p>
        }
      >
        <Debts />
      </Suspense>
    </div>
  );
}

// Every page checks the session itself: the layout does not re-run on client navigation.
// Anyone but the owner gets the ordinary 404, so the page does not reveal that it exists.
async function Debts() {
  const viewer = await requireViewer();
  if (viewer.role !== 'owner') notFound();
  const groups = await listDebts(viewer);
  const totals = await debtTotals(viewer);
  const today = dayKey(new Date());

  return (
    <>
      <PageHeader title="Debts" action={groups.length > 0 ? <RecordDebt today={today} variant="secondary" /> : undefined} />
      <div className="mt-6">
        {groups.length === 0 ? (
          <EmptyState title="Nobody owes you money right now." action={<RecordDebt today={today} />}>
            Money you lend to someone is recorded here, with each part payment they make. Only you can see this page.
          </EmptyState>
        ) : (
          <>
            <p className="text-muted">Total outstanding</p>
            <p className="mt-1 text-focal font-semibold text-ink">
              <Money sen={totals.outstandingSen} />
            </p>
            <p className="mt-1 text-muted">
              {totals.people.length === 0
                ? 'Everyone has repaid in full.'
                : `Owed by ${totals.people.length} ${totals.people.length === 1 ? 'person' : 'people'}.`}
            </p>
            <div className="mt-8">
              <DebtList groups={groups} today={today} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
