import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Meter } from '@/components/meter';
import { PageHeader } from '@/components/page-header';
import { fmt } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';
import type { Messages } from '@/i18n/messages';
import { getLocale, getMessages } from '@/i18n/server';
import { getAiBudgetStatus } from '@/lib/ai/budget';
import { listChat, MESSAGE_MAX_CHARS } from '@/lib/ai/chat';
import { getAiSettings } from '@/lib/ai/settings';
import { requireViewer } from '@/lib/auth/viewer';
import type { BudgetState } from '@/lib/budget-state';
import { formatUsd } from '@/lib/money';
import type { Availability } from './availability';
import { Chat } from './chat';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).assistant.pageTitle };
}

// Blocks on the session read, like the (app) layout.
export const instant = false;

export default async function AssistantPage() {
  const t = (await getMessages()).assistant;
  return (
    <div className="max-w-3xl">
      <PageHeader title={t.title} />
      <Suspense
        fallback={
          <p role="status" className="mt-6 text-muted">
            {t.loading}
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
function shareLeftText({ budgetMicroUsd: budget, usedMicroUsd: used }: Status, t: Messages['assistant']): string {
  if (used <= 0) return t.shareAll;
  if (used >= budget) return t.shareNone;
  const tens = Math.floor(((budget - used) * 10) / budget) * 10;
  return tens === 0 ? t.shareUnderTen : fmt(t.shareAbout, { percent: tens });
}

/** The same meter as the budgets: amber from 80% used (the budgets' default alert level), red once used up. */
function BudgetLeft({
  status,
  isOwner,
  locale,
  t,
}: {
  status: Status;
  isOwner: boolean;
  locale: Locale;
  t: Messages['assistant'];
}) {
  const { budgetMicroUsd: budget, usedMicroUsd: used, available } = status;
  const state: BudgetState = !available ? 'over' : used * 100 >= budget * 80 ? 'tight' : 'fine';
  return (
    <div className="mt-6 max-w-sm">
      {/* No label: the same reading is written just below, so the meter is hidden from screen readers. */}
      <Meter value={Math.min(used, budget)} max={budget} state={state} locale={locale} />
      <p className="mt-1 text-sm text-muted">
        {isOwner
          ? fmt(t.usedToday, { used: formatUsd(used, locale), budget: formatUsd(budget, locale) })
          : shareLeftText(status, t)}
      </p>
    </div>
  );
}

// Every page checks the session itself: the layout does not re-run on client navigation.
async function Assistant() {
  const viewer = await requireViewer();
  const [{ chatModel }, status, messages, locale, catalog] = await Promise.all([
    getAiSettings(),
    getAiBudgetStatus(),
    listChat(viewer),
    getLocale(),
    getMessages(),
  ]);
  const t = catalog.assistant;
  const isOwner = viewer.role === 'owner';
  const availability: Availability = !chatModel ? 'not_configured' : status.available ? 'ready' : 'used_up';
  return (
    <>
      <p className="mt-2 text-muted">{t.intro}</p>
      {chatModel && <BudgetLeft status={status} isOwner={isOwner} locale={locale} t={t} />}
      <Chat
        initialMessages={messages.map(({ id, role, content }) => ({ id, role, content }))}
        availability={availability}
        isOwner={isOwner}
        maxChars={MESSAGE_MAX_CHARS}
        hint={
          // A guest's assistant knows budget names and their own spending, not what is left.
          viewer.role === 'guest' ? t.hintGuest : t.hintMember
        }
      />
    </>
  );
}
