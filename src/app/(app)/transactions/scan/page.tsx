import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/page-header';
import { requireViewer } from '@/lib/auth/viewer';
import { listBudgetNames } from '@/lib/budgets';
import { ReceiptScanner } from './receipt-scanner';

export const metadata: Metadata = { title: 'Scan a receipt | My Expenses' };

export const instant = false;

export default function ScanReceiptPage() {
  return (
    <>
      <PageHeader title="Scan a receipt" />
      <Suspense
        fallback={
          <p role="status" className="mt-6 text-muted">
            Loading…
          </p>
        }
      >
        <ScanReceipt />
      </Suspense>
    </>
  );
}

// Every page checks the session itself: the layout does not re-run on client navigation.
async function ScanReceipt() {
  const viewer = await requireViewer();
  const budgets = await listBudgetNames(viewer);
  return <ReceiptScanner budgets={budgets} isOwner={viewer.role === 'owner'} />;
}
