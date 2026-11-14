import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenAI } from '@ai-sdk/openai';
import { APICallError, RetryError, type LanguageModel } from 'ai';
import { loadEnv, type Env } from '@/lib/env';
import { ValidationError } from '@/lib/errors';
import { findModel, PROVIDER_KEY_NAMES, type Provider } from './models';

const ORDER: Provider[] = ['anthropic', 'openai', 'deepseek'];

/**
 * Providers whose key is set. Reads the environment on each call, so it matches what the
 * running app was started with. Only yes or no leaves this module, never the key.
 */
export function configuredProviders(source: Env = loadEnv()): Provider[] {
  return ORDER.filter((provider) => Boolean(source[PROVIDER_KEY_NAMES[provider]]));
}

/**
 * A provider failure as it may be logged: the error's name and, when the provider answered, the
 * HTTP status. Never the message or the response body: the SDK copies the provider's own text into
 * both, and OpenAI and DeepSeek quote part of a refused key in it. Never the whole error either: it
 * carries the request body, household figures or the receipt image included.
 */
export function describeProviderError(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown error';
  const last = RetryError.isInstance(error) ? error.lastError : error;
  const status = APICallError.isInstance(last) && last.statusCode !== undefined ? ` (HTTP ${last.statusCode})` : '';
  return `${error.name}${status}`;
}

/**
 * The AI SDK model for a model id. The key is handed over explicitly from `.env`: the SDK's own
 * fallback to environment variables is never relied on.
 */
export function languageModel(modelId: string, source: Env = loadEnv()): LanguageModel {
  const model = findModel(modelId);
  if (!model) throw new ValidationError('model', 'That model is not in the list.');
  const apiKey = source[PROVIDER_KEY_NAMES[model.provider]];
  if (!apiKey) {
    throw new ValidationError('model', `Add ${PROVIDER_KEY_NAMES[model.provider]} to the .env file to use this model.`);
  }
  switch (model.provider) {
    case 'anthropic':
      return createAnthropic({ apiKey }).languageModel(model.id);
    case 'openai':
      return createOpenAI({ apiKey }).languageModel(model.id);
    case 'deepseek':
      return createDeepSeek({ apiKey }).languageModel(model.id);
  }
}
