import { APICallError, RetryError } from 'ai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from '@/lib/errors';
import { costFor, costMicroUsd, MODELS, type ModelInfo } from '@/lib/ai/models';
import { configuredProviders, describeProviderError, languageModel } from '@/lib/ai/providers';

const fixture: ModelInfo = {
  id: 'fixture',
  provider: 'anthropic',
  label: 'Fixture',
  vision: true,
  inputUsdPerMTok: 3,
  outputUsdPerMTok: 15,
};

afterEach(() => vi.unstubAllEnvs());

describe('cost', () => {
  it('prices tokens at USD per million, as whole micro-USD', () => {
    expect(costFor(fixture, 1000, 500)).toBe(10500);
  });

  it('rounds a fraction of a micro-USD up, and ignores float noise', () => {
    expect(costFor({ ...fixture, inputUsdPerMTok: 1.32, outputUsdPerMTok: 0 }, 1000, 0)).toBe(1320);
    expect(costFor(fixture, 1, 0)).toBe(3);
    expect(costFor({ ...fixture, inputUsdPerMTok: 0.1, outputUsdPerMTok: 0.5 }, 1, 1)).toBe(1);
  });

  it('looks a model up by id, and rejects an unknown one', () => {
    const sonnet = MODELS.find((m) => m.id === 'claude-sonnet-5-5')!;
    expect(costMicroUsd(sonnet.id, 1000, 500)).toBe(costFor(sonnet, 1000, 500));
    expect(() => costMicroUsd('nope', 1, 1)).toThrow(ValidationError);
  });
});

describe('model list', () => {
  it('has no vision on DeepSeek, and positive prices everywhere', () => {
    expect(MODELS.filter((m) => m.provider === 'deepseek').every((m) => !m.vision)).toBe(true);
    expect(MODELS.every((m) => m.inputUsdPerMTok > 0 && m.outputUsdPerMTok > 0)).toBe(true);
  });

  it('has unique ids and every provider represented', () => {
    expect(new Set(MODELS.map((m) => m.id)).size).toBe(MODELS.length);
    expect(new Set(MODELS.map((m) => m.provider))).toEqual(new Set(['anthropic', 'openai', 'deepseek']));
  });
});

describe('providers', () => {
  function keys(values: { a?: string; o?: string; d?: string }) {
    vi.stubEnv('ANTHROPIC_API_KEY', values.a ?? '');
    vi.stubEnv('OPENAI_API_KEY', values.o ?? '');
    vi.stubEnv('DEEPSEEK_API_KEY', values.d ?? '');
  }

  it('lists the providers whose key is set; empty counts as unset', () => {
    keys({});
    expect(configuredProviders()).toEqual([]);
    keys({ a: 'dummy' });
    expect(configuredProviders()).toEqual(['anthropic']);
    keys({ a: 'dummy', d: 'dummy' });
    expect(configuredProviders()).toEqual(['anthropic', 'deepseek']);
  });

  it('builds a model without a network call, and refuses unknown or unconfigured ones', () => {
    keys({ a: 'dummy' });
    expect(languageModel('claude-sonnet-5-5')).toMatchObject({ modelId: 'claude-sonnet-5-5' });
    expect(() => languageModel('nope')).toThrow(ValidationError);
    expect(() => languageModel('gpt-6-luna')).toThrow(ValidationError);
  });

  it('describes a provider error by name and HTTP status only, never its text', () => {
    const refused = new APICallError({
      message: 'Incorrect API key provided: sk-proj-abc1***************wxyz.',
      url: 'https://api.openai.com/v1/chat/completions',
      requestBodyValues: { messages: [] },
      statusCode: 401,
      responseBody: '{"error":{"message":"Incorrect API key provided: sk-proj-abc1***************wxyz."}}',
      isRetryable: false,
    });
    expect(describeProviderError(refused)).toBe('AI_APICallError (HTTP 401)');

    const retried = new RetryError({
      message: `Failed after 3 attempts. Last error: ${refused.message}`,
      reason: 'maxRetriesExceeded',
      errors: [refused, refused, refused],
    });
    expect(describeProviderError(retried)).toBe('AI_RetryError (HTTP 401)');
    expect(describeProviderError(new Error('sk-proj-abc1 was refused'))).toBe('Error');
    expect(describeProviderError('sk-proj-abc1')).toBe('unknown error');
  });
});
