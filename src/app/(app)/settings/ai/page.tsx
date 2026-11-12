import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Meter } from '@/components/meter';
import { PageHeader } from '@/components/page-header';
import { getAiBudgetStatus, usageByPersonToday } from '@/lib/ai/budget';
import { MODELS, PRICE_SOURCES, PRICES_CHECKED_ON, PROVIDER_KEY_NAMES, PROVIDER_NAMES, type Provider } from '@/lib/ai/models';
import { configuredProviders } from '@/lib/ai/providers';
import { getAiSettings } from '@/lib/ai/settings';
import { requireViewer } from '@/lib/auth/viewer';
import { formatUsd } from '@/lib/money';
import { BudgetForm, ModelsForm, ResetUsage } from './ai-forms';

export const metadata: Metadata = { title: 'AI | My Expenses' };

// Blocks on the session read, like the (app) layout.
export const instant = false;

const PROVIDERS: Provider[] = ['anthropic', 'openai', 'deepseek'];

export default function AiSettingsPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="AI"
        action={
          <Link href="/settings" className="inline-flex min-h-11 items-center">
            Back to Settings
          </Link>
        }
      />
      <Suspense
        fallback={
          <p role="status" className="mt-8 text-muted">
            Loading AI settings…
          </p>
        }
      >
        <AiSettings />
      </Suspense>
    </div>
  );
}

/** US dollars and cents from micro-USD, with integer arithmetic only. */
function dollarsText(microUsd: number): string {
  const cents = Math.round(microUsd / 10_000);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

// Every page checks the session itself: the layout does not re-run on client navigation.
async function AiSettings() {
  const viewer = await requireViewer();
  // Members and guests have only their profile in Settings.
  if (viewer.role !== 'owner') redirect('/settings/profile');

  const configured = configuredProviders();
  const [current, today, byPerson] = await Promise.all([getAiSettings(), getAiBudgetStatus(), usageByPersonToday(viewer)]);
  const available = MODELS.filter((model) => configured.includes(model.provider));
  const toOption = ({ id, label }: { id: string; label: string }) => ({ id, label });

  return (
    <>
      <section aria-labelledby="keys-heading" className="mt-8">
        <h2 id="keys-heading" className="text-lg font-semibold text-ink">
          Keys
        </h2>
        <p className="mt-1 text-muted">
          Keys are kept in the <code>.env</code> file on the computer that runs My Expenses. They are never shown here.
        </p>
        <ul className="mt-4 divide-y divide-line rounded-surface border border-line bg-surface">
          {PROVIDERS.map((provider) => {
            const found = configured.includes(provider);
            return (
              <li key={provider} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
                <span className="font-medium text-ink">{PROVIDER_NAMES[provider]}</span>
                <span className={found ? 'font-medium text-ink' : 'text-muted'}>
                  {found ? 'Key found in .env' : 'No key in .env'}
                </span>
              </li>
            );
          })}
        </ul>
        {configured.length === 0 ? (
          <div className="mt-4 rounded-surface border border-line bg-surface px-5 py-4">
            <p className="font-semibold text-ink">No key yet, so the assistant and receipt reading are off.</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
              <li>
                Open the <code>.env</code> file in the My Expenses project folder.
              </li>
              <li>
                Put your key after <code>{PROVIDER_KEY_NAMES.anthropic}=</code>, <code>{PROVIDER_KEY_NAMES.openai}=</code> or{' '}
                <code>{PROVIDER_KEY_NAMES.deepseek}=</code>. One is enough.
              </li>
              <li>Save the file and restart the app.</li>
              <li>Come back to this page and choose a model.</li>
            </ol>
          </div>
        ) : (
          <p className="mt-3 text-muted">
            To add another provider, put its key in the <code>.env</code> file, save it and restart the app.
          </p>
        )}
      </section>

      {configured.length > 0 && (
        <section aria-labelledby="models-heading" className="mt-12">
          <h2 id="models-heading" className="text-lg font-semibold text-ink">
            Models
          </h2>
          <p className="mt-1 text-muted">
            Only models from providers with a key are listed. A cheaper model costs less per question; a stronger one
            usually reads and answers better.
          </p>
          <div className="mt-4 max-w-md">
            <ModelsForm
              chatOptions={available.map(toOption)}
              receiptOptions={available.filter((model) => model.vision).map(toOption)}
              chatModel={current.chatModel}
              receiptModel={current.receiptModel}
            />
          </div>
        </section>
      )}

      <section aria-labelledby="limit-heading" className="mt-12">
        <h2 id="limit-heading" className="text-lg font-semibold text-ink">
          Daily limit
        </h2>
        <p className="mt-1 text-muted">
          The most the assistant may cost in one day, for everyone together, in US dollars. Receipt reading does not
          count toward it. The count starts again at midnight, Malaysia time.
        </p>

        <div className="mt-6 max-w-md">
          <p className="text-ink">
            <span className="text-2xl font-semibold tabular-nums">{formatUsd(today.usedMicroUsd)}</span>{' '}
            <span className="text-muted">of {formatUsd(today.budgetMicroUsd)} used today</span>
          </p>
          {/* No label: the same amounts are written just above, so the meter is hidden from screen readers. */}
          <div className="mt-2">
            <Meter
              value={Math.min(today.usedMicroUsd, today.budgetMicroUsd)}
              max={today.budgetMicroUsd}
              state={!today.available ? 'over' : today.usedMicroUsd * 100 >= today.budgetMicroUsd * 80 ? 'tight' : 'fine'}
            />
          </div>
          {!today.available && (
            <p className="mt-2 font-medium text-ink">
              The assistant has stopped for everyone until midnight. Reset today&apos;s usage or raise the limit to turn
              it back on.
            </p>
          )}
          <p className="mt-2 text-sm text-muted">This is an estimate. Your provider&apos;s bill is the real figure.</p>
        </div>

        <h3 className="mt-6 font-semibold text-ink">Used today by person</h3>
        {byPerson.length === 0 ? (
          <p className="mt-1 text-muted">Nothing has counted toward today&apos;s limit yet.</p>
        ) : (
          <ul className="mt-2 max-w-md divide-y divide-line rounded-surface border border-line bg-surface">
            {/* Two people may share a display name, so the position keeps the keys apart. */}
            {byPerson.map((person, index) => (
              <li key={`${index}-${person.name}`} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                <span className="min-w-0 break-words text-ink">{person.name}</span>
                <span className="tabular-nums whitespace-nowrap text-ink">{formatUsd(person.usedMicroUsd)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <ResetUsage canReset={today.usedMicroUsd > 0} />
        </div>

        <div className="mt-8">
          <BudgetForm dailyBudget={dollarsText(current.dailyBudgetMicroUsd)} />
        </div>
      </section>

      <p className="mt-12 text-sm text-muted">
        Prices were checked on {PRICES_CHECKED_ON}:{' '}
        {PROVIDERS.map((provider, index) => (
          <span key={provider}>
            {index > 0 && ', '}
            <a href={PRICE_SOURCES[provider]} target="_blank" rel="noreferrer">
              {PROVIDER_NAMES[provider]}
            </a>
          </span>
        ))}
        .
      </p>
    </>
  );
}
