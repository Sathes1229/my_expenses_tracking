import { Suspense } from 'react';
import { PageHeader } from '@/components/page-header';
import { requireViewer } from '@/lib/auth/viewer';

// Blocks on the session read, like the (app) layout.
export const instant = false;

// Placeholder until the dashboard (Task 9).
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <Home />
    </Suspense>
  );
}

// Every page checks the session itself: the layout does not re-run on client navigation.
async function Home() {
  await requireViewer();
  return (
    <>
      <PageHeader title="Home" />
      <p className="mt-2 text-muted">Budgets and spending will show here. This part is not built yet.</p>
    </>
  );
}
