import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/page-header';
import { getMessages } from '@/i18n/server';
import { requireViewer } from '@/lib/auth/viewer';
import { listBudgetNames } from '@/lib/budgets';
import { ReceiptScanner } from './receipt-scanner';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).scan.pageTitle };
}

export const instant = false;

export default async function ScanReceiptPage() {
  const m = await getMessages();
  return (
    <>
      <PageHeader title={m.scan.title} />
      <Suspense
        fallback={
          <p role="status" className="mt-6 text-muted">
            {m.common.loading}
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
