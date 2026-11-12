import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import type { Viewer } from '@/lib/auth/viewer';
import { MODELS } from '@/lib/ai/models';
import { getAiSettings, setChatModel, setDailyBudget, setReceiptModel } from '@/lib/ai/settings';
import { resetDb } from '../helpers/db';

const owner: Viewer = { id: 'o1', role: 'owner', displayName: 'Owner' };
const member: Viewer = { id: 'm1', role: 'member', displayName: 'Member' };

const anthropic = MODELS.find((m) => m.provider === 'anthropic' && m.vision)!.id;
const openai = MODELS.find((m) => m.provider === 'openai')!.id;
const deepseek = MODELS.find((m) => m.provider === 'deepseek')!.id;

function keys(values: { a?: string; o?: string; d?: string }) {
  vi.stubEnv('ANTHROPIC_API_KEY', values.a ?? '');
  vi.stubEnv('OPENAI_API_KEY', values.o ?? '');
  vi.stubEnv('DEEPSEEK_API_KEY', values.d ?? '');
}

beforeEach(async () => {
  await resetDb();
  keys({ a: 'dummy' });
});
afterEach(() => vi.unstubAllEnvs());

describe('models', () => {
  it('starts with nothing chosen and the default budget', async () => {
    expect(await getAiSettings()).toEqual({ chatModel: null, receiptModel: null, dailyBudgetMicroUsd: 1_000_000 });
  });

  it('saves the choices of a configured provider', async () => {
    await setChatModel(owner, anthropic);
    await setReceiptModel(owner, anthropic);
    expect(await getAiSettings()).toMatchObject({ chatModel: anthropic, receiptModel: anthropic });
  });

  it('rejects an unconfigured provider, an unknown model, and a receipt model without vision', async () => {
    await expect(setChatModel(owner, openai)).rejects.toThrow(ValidationError);
    await expect(setChatModel(owner, 'nope')).rejects.toThrow(ValidationError);
    keys({ a: 'dummy', d: 'dummy' });
    await expect(setReceiptModel(owner, deepseek)).rejects.toThrow(ValidationError);
    await setChatModel(owner, deepseek);
    expect((await getAiSettings()).chatModel).toBe(deepseek);
  });

  it('returns null for a stored model whose key was removed or that left the list', async () => {
    await setChatModel(owner, anthropic);
    keys({ o: 'dummy' });
    expect((await getAiSettings()).chatModel).toBeNull();
    keys({ a: 'dummy' });
    expect((await getAiSettings()).chatModel).toBe(anthropic);
  });

  it('is owner only, before anything else is checked', async () => {
    await expect(setChatModel(member, anthropic)).rejects.toThrow(ForbiddenError);
    await expect(setReceiptModel(member, anthropic)).rejects.toThrow(ForbiddenError);
    await expect(setDailyBudget(member, '2.50')).rejects.toThrow(ForbiddenError);
  });
});

describe('daily budget', () => {
  it('stores dollars as integer micro-USD', async () => {
    await setDailyBudget(owner, '2.50');
    expect((await getAiSettings()).dailyBudgetMicroUsd).toBe(2_500_000);
    await setDailyBudget(owner, 'US$0.01');
    expect((await getAiSettings()).dailyBudgetMicroUsd).toBe(10_000);
    await setDailyBudget(owner, ' $1000 ');
    expect((await getAiSettings()).dailyBudgetMicroUsd).toBe(1_000_000_000);
    await setDailyBudget(owner, '3.5');
    expect((await getAiSettings()).dailyBudgetMicroUsd).toBe(3_500_000);
  });

  it('rejects anything outside 0.01 to 1000 with at most two decimals', async () => {
    for (const bad of ['0', '0.00', '0.009', '1000.01', '1,5', '1.234', '-1', '', 'abc', '1e3', 'RM 2', '$$2', '2.']) {
      await expect(setDailyBudget(owner, bad)).rejects.toThrow(ValidationError);
    }
    expect((await getAiSettings()).dailyBudgetMicroUsd).toBe(1_000_000);
  });
});
