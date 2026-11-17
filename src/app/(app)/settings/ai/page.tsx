import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Meter } from '@/components/meter';
import { PageHeader } from '@/components/page-header';
import { fmt } from '@/i18n/format';
import { fmtNodes } from '@/i18n/format-nodes';
import { getLocale, getMessages } from '@/i18n/server';
import { getAiBudgetStatus, usageByPersonToday } from '@/lib/ai/budget';
import {
  MODELS,
  PRICE_SOURCES,
  PRICES_CHECKED_ON,
  PROVIDER_KEY_NAMES,
  PROVIDER_NAMES,
  type ModelInfo,
  type Provider,
} from '@/lib/ai/models';
import { configuredProviders } from '@/lib/ai/providers';
import { getAiSettings } from '@/lib/ai/settings';
import { requireViewer } from '@/lib/auth/viewer';
import { formatUsd } from '@/lib/money';
import { BudgetForm, ModelsForm, ResetUsage } from './ai-forms';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).ai.pageTitle };
}

// Blocks on the session read, like the (app) layout.
export const instant = false;

const PROVIDERS: Provider[] = ['anthropic', 'openai', 'deepseek'];

const ENV = <code>.env</code>;

export default async function AiSettingsPage() {
  const t = (await getMessages()).ai;
  return (
    <div className="max-w-3xl">
      <PageHeader
        title={t.title}
        action={
          <Link href="/settings" className="inline-flex min-h-11 items-center">
            {t.backToSettings}
          </Link>
        }
      />
      <Suspense
        fallback={
          <p role="status" className="mt-8 text-muted">
            {t.loading}
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
  const [current, today, byPerson, locale, messages] = await Promise.all([
    getAiSettings(),
    getAiBudgetStatus(),
    usageByPersonToday(viewer),
    getLocale(),
    getMessages(),
  ]);
  const t = messages.ai;
  const available = MODELS.filter((model) => configured.includes(model.provider));
  // The model's name stays as the provider writes it; its tier is said in the viewer's language.
  const toOption = ({ id, label, tier }: ModelInfo) => ({
    id,
    label: tier ? fmt(t.modelOption, { name: label, tier: t.tiers[tier] }) : label,
  });
  const usd = (microUsd: number) => formatUsd(microUsd, locale);
  const keyName = (provider: Provider) => <code>{PROVIDER_KEY_NAMES[provider]}=</code>;

  return (
    <>
      <section aria-labelledby="keys-heading" className="mt-8">
        <h2 id="keys-heading" className="text-lg font-semibold text-ink">
          {t.keysHeading}
        </h2>
        <p className="mt-1 text-muted">{fmtNodes(t.keysIntro, { env: ENV })}</p>
        <ul className="mt-4 divide-y divide-line rounded-surface border border-line bg-surface">
          {PROVIDERS.map((provider) => {
            const found = configured.includes(provider);
            return (
              <li key={provider} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
                <span className="font-medium text-ink">{PROVIDER_NAMES[provider]}</span>
                <span className={found ? 'font-medium text-ink' : 'text-muted'}>{found ? t.keyFound : t.noKey}</span>
              </li>
            );
          })}
        </ul>
        {configured.length === 0 ? (
          <div className="mt-4 rounded-surface border border-line bg-surface px-5 py-4">
            <p className="font-semibold text-ink">{t.noKeyTitle}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
              <li>{fmtNodes(t.stepOpen, { env: ENV })}</li>
              <li>
                {fmtNodes(t.stepKey, {
                  anthropic: keyName('anthropic'),
                  openai: keyName('openai'),
                  deepseek: keyName('deepseek'),
                })}
              </li>
              <li>{t.stepRestart}</li>
              <li>{t.stepChoose}</li>
            </ol>
          </div>
        ) : (
          <p className="mt-3 text-muted">{fmtNodes(t.addAnother, { env: ENV })}</p>
        )}
      </section>

      {configured.length > 0 && (
        <section aria-labelledby="models-heading" className="mt-12">
          <h2 id="models-heading" className="text-lg font-semibold text-ink">
            {t.modelsHeading}
          </h2>
          <p className="mt-1 text-muted">{t.modelsIntro}</p>
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
          {t.limitHeading}
        </h2>
        <p className="mt-1 text-muted">{t.limitIntro}</p>

        <div className="mt-6 max-w-md">
          <p className="text-ink">
            <span className="text-2xl font-semibold tabular-nums">{usd(today.usedMicroUsd)}</span>{' '}
            <span className="text-muted">{fmt(t.ofUsedToday, { budget: usd(today.budgetMicroUsd) })}</span>
          </p>
          {/* No label: the same amounts are written just above, so the meter is hidden from screen readers. */}
          <div className="mt-2">
            <Meter
              value={Math.min(today.usedMicroUsd, today.budgetMicroUsd)}
              max={today.budgetMicroUsd}
              state={!today.available ? 'over' : today.usedMicroUsd * 100 >= today.budgetMicroUsd * 80 ? 'tight' : 'fine'}
              locale={locale}
            />
          </div>
          {!today.available && <p className="mt-2 font-medium text-ink">{t.stopped}</p>}
          <p className="mt-2 text-sm text-muted">{t.estimate}</p>
        </div>

        <h3 className="mt-6 font-semibold text-ink">{t.byPerson}</h3>
        {byPerson.length === 0 ? (
          <p className="mt-1 text-muted">{t.nothingYet}</p>
        ) : (
          <ul className="mt-2 max-w-md divide-y divide-line rounded-surface border border-line bg-surface">
            {/* Two people may share a display name, so the position keeps the keys apart. */}
            {byPerson.map((person, index) => (
              <li key={`${index}-${person.name}`} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                <span className="min-w-0 break-words text-ink">{person.name}</span>
                <span className="tabular-nums whitespace-nowrap text-ink">{usd(person.usedMicroUsd)}</span>
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
        {fmtNodes(t.pricesChecked, {
          date: PRICES_CHECKED_ON,
          sources: PROVIDERS.map((provider, index) => (
            <span key={provider}>
              {index > 0 && ', '}
              <a href={PRICE_SOURCES[provider]} target="_blank" rel="noreferrer">
                {PROVIDER_NAMES[provider]}
              </a>
            </span>
          )),
        })}
      </p>
    </>
  );
}
