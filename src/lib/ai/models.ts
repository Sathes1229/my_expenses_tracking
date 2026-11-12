import { ValidationError } from '@/lib/errors';

export type Provider = 'anthropic' | 'openai' | 'deepseek';

export type ModelInfo = {
  /** The exact string the provider's API accepts. */
  id: string;
  provider: Provider;
  /** What the owner sees in the picker. */
  label: string;
  /** Whether the model can read an image (needed for receipts). */
  vision: boolean;
  inputUsdPerMTok: number;
  outputUsdPerMTok: number;
};

/** When the prices below were last compared with the providers' own pages. */
export const PRICES_CHECKED_ON = '2026-11-12';

export const PRICE_SOURCES: Record<Provider, string> = {
  anthropic: 'https://platform.claude.com/docs/en/about-claude/pricing',
  openai: 'https://developers.openai.com/api/docs/pricing',
  deepseek: 'https://api-docs.deepseek.com/quick_start/pricing',
};

export const PROVIDER_NAMES: Record<Provider, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
};

/** The .env setting that holds each provider's key. */
export const PROVIDER_KEY_NAMES: Record<Provider, 'ANTHROPIC_API_KEY' | 'OPENAI_API_KEY' | 'DEEPSEEK_API_KEY'> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
};

// Standard prices for prompts of ordinary length. Where a provider charges a peak and an
// off-peak rate (DeepSeek), the peak rate is used, so the daily budget never undercounts.
export const MODELS: ModelInfo[] = [
  { id: 'claude-haiku-5-5', provider: 'anthropic', label: 'Claude Haiku 5.5 (cheapest)', vision: true, inputUsdPerMTok: 0.1, outputUsdPerMTok: 0.5 },
  { id: 'claude-sonnet-5-5', provider: 'anthropic', label: 'Claude Sonnet 5.5 (balanced)', vision: true, inputUsdPerMTok: 2, outputUsdPerMTok: 10 },
  { id: 'claude-opus-5-5', provider: 'anthropic', label: 'Claude Opus 5.5 (strongest)', vision: true, inputUsdPerMTok: 4, outputUsdPerMTok: 20 },
  { id: 'gpt-6-luna', provider: 'openai', label: 'GPT-6 Luna (cheapest)', vision: true, inputUsdPerMTok: 0.1, outputUsdPerMTok: 0.5 },
  { id: 'gpt-6.1-sol', provider: 'openai', label: 'GPT-6.1 Sol (stronger)', vision: true, inputUsdPerMTok: 2, outputUsdPerMTok: 10 },
  { id: 'deepseek-flash', provider: 'deepseek', label: 'DeepSeek Flash (cheapest)', vision: false, inputUsdPerMTok: 0.3, outputUsdPerMTok: 1.2 },
  { id: 'deepseek-v4-pro', provider: 'deepseek', label: 'DeepSeek V4 Pro (stronger)', vision: false, inputUsdPerMTok: 1.32, outputUsdPerMTok: 3.96 },
];

export function findModel(modelId: string): ModelInfo | undefined {
  return MODELS.find((m) => m.id === modelId);
}

/**
 * USD per million tokens times tokens is already micro-USD. Rounded to 6 places first so float
 * noise (1000 x 1.32 = 1320.0000000000002) cannot push a whole number up by one.
 */
export function costFor(model: ModelInfo, inputTokens: number, outputTokens: number): number {
  const exact = inputTokens * model.inputUsdPerMTok + outputTokens * model.outputUsdPerMTok;
  return Math.ceil(Number(exact.toFixed(6)));
}

export function costMicroUsd(modelId: string, inputTokens: number, outputTokens: number): number {
  const model = findModel(modelId);
  if (!model) throw new ValidationError('model', 'That model is not in the list.');
  return costFor(model, inputTokens, outputTokens);
}
