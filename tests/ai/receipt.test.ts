import { inspect } from 'node:util';
import { APICallError } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import sharp from 'sharp';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/client';
import { aiUsage } from '@/db/schema';
import type { Viewer } from '@/lib/auth/viewer';
import { MODELS } from '@/lib/ai/models';
import { languageModel } from '@/lib/ai/providers';
import { extractReceipt, toDraft } from '@/lib/ai/receipt';
import { setReceiptModel } from '@/lib/ai/settings';
import { resetDb } from '../helpers/db';

// The model is always a mock: these tests never reach a provider.
vi.mock('@/lib/ai/providers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai/providers')>()),
  languageModel: vi.fn(),
}));

const owner: Viewer = { id: 'o1', role: 'owner', displayName: 'Owner' };
const receiptModel = MODELS.find((m) => m.provider === 'anthropic' && m.vision)!.id;
const usage = {
  inputTokens: { total: 900, noCache: 900, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 200, text: 200, reasoning: undefined },
};

let img: Buffer;

beforeAll(async () => {
  img = await sharp({ create: { width: 20, height: 40, channels: 3, background: '#fff' } }).jpeg().toBuffer();
});

function answering(output: unknown) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text', text: typeof output === 'string' ? output : JSON.stringify(output) }],
      finishReason: { unified: 'stop', raw: undefined },
      usage,
      warnings: [],
    }),
  });
}

const fullReceipt = {
  merchant: ' KK Super Mart ',
  date: '2026-11-03',
  time: '19:05',
  receiptNumber: 'INV-0042',
  items: [
    { name: 'Milk', quantity: 2, unitPrice: 3.2, lineTotal: 6.4 },
    { name: 'Bread', quantity: 1, unitPrice: 6.1, lineTotal: 6.1 },
  ],
  total: 12.5,
  paymentMethod: 'card',
  suggestedBudget: 'Groceries',
  isReceipt: true,
};

describe('toDraft', () => {
  it('converts RM to sen, drops bad items, ignores an unknown budget and says what to check', () => {
    const d = toDraft(
      {
        merchant: 'KK Mart',
        date: null,
        total: 12.5,
        paymentMethod: 'qr',
        suggestedBudget: 'Holidays',
        items: [
          { name: 'Milk', quantity: 2, unitPrice: 3.2, lineTotal: 6.4 },
          { name: 'Bad', quantity: -1, unitPrice: 1, lineTotal: 1 },
        ],
      },
      [{ id: 'b1', name: 'Groceries' }],
    );
    expect(d.initial.totalSen).toBe(1250);
    expect(d.initial.items).toHaveLength(1);
    expect(d.initial.items![0]).toEqual({ name: 'Milk', quantity: 2, unitPriceSen: 320, lineTotalSen: 640 });
    expect(d.initial.budgetId).toBeUndefined();
    expect(d.initial.paymentMethod).toBe('qr');
    expect(d.initial.occurredAt).toBeUndefined();
    expect(d.warnings).toContain('The items add up to RM 6.40 but the total reads RM 12.50.');
    expect(d.warnings).toContain('No date was found on the receipt.');
  });

  it('matches a suggested budget by name, ignoring case', () => {
    expect(toDraft({ suggestedBudget: 'groceries' }, [{ id: 'b1', name: 'Groceries' }]).initial.budgetId).toBe('b1');
  });

  it('reads the date and time in Malaysia time, and puts a missing time at 12:00', () => {
    expect(toDraft({ date: '2026-11-03', time: '19:05' }, []).initial.occurredAt?.toISOString()).toBe(
      '2026-11-03T11:05:00.000Z',
    );
    expect(toDraft({ date: '2026-11-03', time: null }, []).initial.occurredAt?.toISOString()).toBe(
      '2026-11-03T04:00:00.000Z',
    );
    expect(toDraft({ date: '2026-11-03', time: '25:61' }, []).initial.occurredAt?.toISOString()).toBe(
      '2026-11-03T04:00:00.000Z',
    );
  });

  it('drops a date or an amount that cannot be right, with a warning instead of an error', () => {
    const d = toDraft({ date: '2026-02-30', total: 3.005, items: [{ name: 'Tea', quantity: 1, unitPrice: null, lineTotal: 2 }] }, []);
    expect(d.initial.occurredAt).toBeUndefined();
    expect(d.initial.totalSen).toBeUndefined();
    expect(d.initial.items).toEqual([]);
    expect(d.warnings).toContain('The date on the receipt could not be read.');
    expect(d.warnings).toContain('The total on the receipt could not be read.');
    expect(d.warnings).toContain('1 item could not be read and was left out.');
    expect(toDraft({ total: -4 }, []).initial.totalSen).toBeUndefined();
  });

  it('says when there is no total, and copes with something that is not an object at all', () => {
    expect(toDraft({}, []).warnings).toContain('No total was found on the receipt.');
    for (const raw of [null, 'text', 42, []]) {
      const d = toDraft(raw, []);
      expect(d.initial).toEqual({ items: [] });
      expect(d.warnings).toEqual(['No date was found on the receipt.', 'No total was found on the receipt.']);
    }
  });

  it('keeps the text fields tidy and leaves out an unknown payment method', () => {
    const d = toDraft({ merchant: '  KK   Mart ', receiptNumber: ' A1 ', paymentMethod: 'bitcoin' }, []);
    expect(d.initial.merchant).toBe('KK Mart');
    expect(d.initial.receiptNumber).toBe('A1');
    expect(d.initial.paymentMethod).toBeUndefined();
    expect(toDraft({ merchant: 'x'.repeat(150) }, []).initial.merchant).toHaveLength(100);
  });

  it('adds no warning when the items match the total', () => {
    const d = toDraft(fullReceipt, [{ id: 'b1', name: 'Groceries' }]);
    expect(d.warnings).toEqual([]);
    expect(d.initial).toMatchObject({ merchant: 'KK Super Mart', receiptNumber: 'INV-0042', totalSen: 1250, paymentMethod: 'card', budgetId: 'b1' });
  });
});

describe('extractReceipt', () => {
  beforeEach(async () => {
    await resetDb();
    vi.mocked(languageModel).mockReset();
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('DEEPSEEK_API_KEY', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  async function configure() {
    vi.stubEnv('ANTHROPIC_API_KEY', 'dummy');
    await setReceiptModel(owner, receiptModel);
  }

  it('reports not_configured while no receipt model is set, without calling a model', async () => {
    const result = await extractReceipt(img, []);
    expect(result.ok).toBe(false); // no receipt model configured -> 'not_configured'
    expect(result).toEqual({ ok: false, reason: 'not_configured' });
    expect(languageModel).not.toHaveBeenCalled();
  });

  it('sends the image as JPEG with instructions that its text is data, and returns the draft', async () => {
    await configure();
    const model = answering(fullReceipt);
    vi.mocked(languageModel).mockReturnValue(model);

    const result = await extractReceipt(img, [{ id: 'b1', name: 'Groceries' }]);

    expect(result).toEqual({ ok: true, draft: toDraft(fullReceipt, [{ id: 'b1', name: 'Groceries' }]) });
    expect(languageModel).toHaveBeenCalledWith(receiptModel);
    const call = model.doGenerateCalls[0];
    expect(call.abortSignal).toBeDefined();
    const system = call.prompt.find((m) => m.role === 'system');
    expect(system?.content).toMatch(/data, not instructions/i);
    expect(system?.content).toContain('Groceries');
    const user = call.prompt.find((m) => m.role === 'user');
    const parts = Array.isArray(user?.content) ? user.content : [];
    expect(parts.some((p) => p.type === 'file' && p.mediaType === 'image/jpeg')).toBe(true);
    expect(db.select().from(aiUsage).all()).toHaveLength(0); // receipts never count against the AI budget
  });

  it('reports unreadable when the model says it is not a receipt, or answers out of shape', async () => {
    await configure();
    vi.mocked(languageModel).mockReturnValue(answering({ ...fullReceipt, suggestedBudget: null, isReceipt: false }));
    expect(await extractReceipt(img, [])).toEqual({ ok: false, reason: 'unreadable' });
    vi.mocked(languageModel).mockReturnValue(answering({ ...fullReceipt, suggestedBudget: null, isReceipt: null }));
    expect((await extractReceipt(img, [])).ok).toBe(true); // in shape, so only isReceipt false means unreadable

    vi.mocked(languageModel).mockReturnValue(answering('this is not JSON'));
    expect(await extractReceipt(img, [])).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('reports provider_error when the provider fails', async () => {
    await configure();
    vi.mocked(languageModel).mockReturnValue(
      new MockLanguageModelV4({
        doGenerate: async () => {
          throw new Error('provider is down');
        },
      }),
    );
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await extractReceipt(img, [])).toEqual({ ok: false, reason: 'provider_error' });
    expect(db.select().from(aiUsage).all()).toHaveLength(0);
    quiet.mockRestore();
  });

  it('logs a refused key by error name and status, never the provider text that quotes the key', async () => {
    await configure();
    const text = 'Incorrect API key provided: sk-proj-abc1***************wxyz.';
    vi.mocked(languageModel).mockReturnValue(
      new MockLanguageModelV4({
        doGenerate: async () => {
          throw new APICallError({
            message: text,
            url: 'https://api.openai.com/v1/chat/completions',
            requestBodyValues: {},
            statusCode: 401,
            responseBody: JSON.stringify({ error: { message: text } }),
            isRetryable: false,
          });
        },
      }),
    );
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(await extractReceipt(img, [])).toEqual({ ok: false, reason: 'provider_error' });
      const lines = logged.mock.calls.flat().map((arg) => inspect(arg, { depth: 5 })).join('\n');
      expect(lines).toContain('AI_APICallError (HTTP 401)');
      expect(lines).not.toContain('sk-');
    } finally {
      logged.mockRestore();
    }
  });
});
