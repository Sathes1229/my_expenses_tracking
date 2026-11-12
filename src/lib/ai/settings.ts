import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { settings } from '@/db/schema';
import { assertOwner, type Viewer } from '@/lib/auth/viewer';
import { ValidationError } from '@/lib/errors';
import { findModel } from './models';
import { configuredProviders } from './providers';

const CHAT_KEY = 'ai.chatModel';
const RECEIPT_KEY = 'ai.receiptModel';
const BUDGET_KEY = 'ai.dailyBudgetMicroUsd';

export const DEFAULT_DAILY_BUDGET_MICRO_USD = 1_000_000;
const MIN_BUDGET_MICRO_USD = 10_000; // 0.01 USD
const MAX_BUDGET_MICRO_USD = 1_000_000_000; // 1000 USD

// Digits with at most two decimals, an optional "$" or "US$" in front. No floats anywhere.
const USD_AMOUNT = /^(?:us)?\$?\s*(\d+)(?:\.(\d{1,2}))?$/;

/** One stored setting, parsed; undefined when it was never written or is not valid JSON. */
export function readSetting(key: string): unknown {
  const row = db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).get();
  if (!row) return undefined;
  try {
    return JSON.parse(row.value);
  } catch {
    return undefined;
  }
}

export function writeSetting(key: string, value: unknown) {
  const json = JSON.stringify(value);
  db.insert(settings).values({ key, value: json }).onConflictDoUpdate({ target: settings.key, set: { value: json } }).run();
}

/** A stored model counts only while it is still in the list and its provider still has a key. */
function usableModel(stored: unknown): string | null {
  if (typeof stored !== 'string') return null;
  const model = findModel(stored);
  if (!model || !configuredProviders().includes(model.provider)) return null;
  return model.id;
}

export async function getAiSettings(): Promise<{
  chatModel: string | null;
  receiptModel: string | null;
  dailyBudgetMicroUsd: number;
}> {
  const budget = readSetting(BUDGET_KEY);
  return {
    chatModel: usableModel(readSetting(CHAT_KEY)),
    receiptModel: usableModel(readSetting(RECEIPT_KEY)),
    dailyBudgetMicroUsd:
      typeof budget === 'number' && Number.isSafeInteger(budget) ? budget : DEFAULT_DAILY_BUDGET_MICRO_USD,
  };
}

function checkModel(modelId: string, field: string, needsVision: boolean) {
  const model = findModel(modelId);
  if (!model) throw new ValidationError(field, 'Choose a model from the list.');
  if (!configuredProviders().includes(model.provider)) {
    throw new ValidationError(field, 'That model needs a key in the .env file first.');
  }
  if (needsVision && !model.vision) throw new ValidationError(field, 'That model cannot read images. Choose another.');
}

export async function setChatModel(owner: Viewer, modelId: string): Promise<void> {
  assertOwner(owner);
  checkModel(modelId, 'chatModel', false);
  writeSetting(CHAT_KEY, modelId);
}

export async function setReceiptModel(owner: Viewer, modelId: string): Promise<void> {
  assertOwner(owner);
  checkModel(modelId, 'receiptModel', true);
  writeSetting(RECEIPT_KEY, modelId);
}

/** "2.50", "$2.5" or "US$2" in US dollars, from 0.01 to 1000. Stored as whole micro-USD. */
export async function setDailyBudget(owner: Viewer, usd: string): Promise<void> {
  assertOwner(owner);
  const match = USD_AMOUNT.exec(usd.trim().toLowerCase());
  const invalid = new ValidationError('dailyBudget', 'Enter an amount from 0.01 to 1000 US dollars, for example 2.50.');
  if (!match) throw invalid;
  const dollars = Number(match[1]);
  if (!Number.isSafeInteger(dollars) || dollars > 1000) throw invalid;
  const cents = Number((match[2] ?? '').padEnd(2, '0'));
  const micro = dollars * 1_000_000 + cents * 10_000;
  if (micro < MIN_BUDGET_MICRO_USD || micro > MAX_BUDGET_MICRO_USD) throw invalid;
  writeSetting(BUDGET_KEY, micro);
}
