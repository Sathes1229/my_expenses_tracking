import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Meter } from '@/components/meter';
import { PageHeader } from '@/components/page-header';
import { getAiBudgetStatus } from '@/lib/ai/budget';
import { listChat, MESSAGE_MAX_CHARS } from '@/lib/ai/chat';
import { getAiSettings } from '@/lib/ai/settings';
import { requireViewer } from '@/lib/auth/viewer';
import type { BudgetState } from '@/lib/budget-state';
import { formatUsd } from '@/lib/money';
import { Chat, type Availability } from './chat';

export const metadata: Metadata = { title: 'Assistant | My Expenses' };

// Blocks on the session read, like the (app) layout.
export const instant = false;

export default function AssistantPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Assistant" />
      <Suspense
        fallback={
          <p role="status" className="mt-6 text-muted">
            Loading the assistant…
          </p>
        }
      >
        <Assistant />
      </Suspense>
    </div>
  );
}

type Status = Awaited<ReturnType<typeof getAiBudgetStatus>>;

/** Members and guests get a rough share in tens, rounded down, never the dollar amounts. */
function shareLeftText({ budgetMicroUsd: budget, usedMicroUsd: used }: Status): string {
  if (used <= 0) return "All of today's assistant budget left";
  if (used >= budget) return "None of today's assistant budget left";
  const tens = Math.floor(((budget - used) * 10) / budget) * 10;
  return tens === 0 ? "Less than 10% of today's assistant budget left" : `About ${tens}% of today's assistant budget left`;
}

/** The same meter as the budgets: amber from 80% used (the budgets' default alert level), red once used up. */
function BudgetLeft({ status, isOwner }: { status: Status; isOwner: boolean }) {
  const { budgetMicroUsd: budget, usedMicroUsd: used, available } = status;
  const state: BudgetState = !available ? 'over' : used * 100 >= budget * 80 ? 'tight' : 'fine';
  return (
    <div className="mt-6 max-w-sm">
      {/* No label: the same reading is written just below, so the meter is hidden from screen readers. */}
      <Meter value={Math.min(used, budget)} max={budget} state={state} />
      <p className="mt-1 text-sm text-muted">
        {isOwner ? `Used today: ${formatUsd(used)} of ${formatUsd(budget)}` : shareLeftText(status)}
      </p>
    </div>
  );
}

// Every page checks the session itself: the layout does not re-run on client navigation.
async function Assistant() {
  const viewer = await requireViewer();
  const [{ chatModel }, status, messages] = await Promise.all([getAiSettings(), getAiBudgetStatus(), listChat(viewer)]);
  const isOwner = viewer.role === 'owner';
  const availability: Availability = !chatModel ? 'not_configured' : status.available ? 'ready' : 'used_up';
  return (
    <>
      <p className="mt-2 text-muted">
        Ask about your budgets and spending, in English or Malay. The assistant works from the figures you can see in My
        Expenses, for this month and the two before.
      </p>
      {chatModel && <BudgetLeft status={status} isOwner={isOwner} />}
      <Chat
        initialMessages={messages.map(({ id, role, content }) => ({ id, role, content }))}
        availability={availability}
        isOwner={isOwner}
        maxChars={MESSAGE_MAX_CHARS}
      />
    </>
  );
}
