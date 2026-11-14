import { inspect } from 'node:util';
import { APICallError, simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/client';
import { aiUsage, chatMessages } from '@/db/schema';
import { createAccount } from '@/lib/auth/accounts';
import type { Viewer } from '@/lib/auth/viewer';
import { getAiBudgetStatus, recordChatUsage } from '@/lib/ai/budget';
import { ANSWER_TIMEOUT_MS, clearChat, HISTORY_MESSAGES, listChat, MAX_OUTPUT_TOKENS } from '@/lib/ai/chat';
import { costMicroUsd, MODELS } from '@/lib/ai/models';
import { languageModel } from '@/lib/ai/providers';
import { setChatModel, setDailyBudget } from '@/lib/ai/settings';
import { createBudget } from '@/lib/budgets';
import { fromLocalDateTime } from '@/lib/time';
import { createTransaction } from '@/lib/transactions';
import { POST } from '@/app/api/chat/route';
import { resetDb } from '../helpers/db';
import { sessionHeaders } from '../helpers/session';

// The model is always a mock: these tests never reach a provider.
vi.mock('@/lib/ai/providers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai/providers')>()),
  languageModel: vi.fn(),
}));

type StreamPart = Awaited<ReturnType<MockLanguageModelV4['doStream']>>['stream'] extends ReadableStream<infer P> ? P : never;

const APP = 'http://localhost:3100';
const chatModel = MODELS.find((m) => m.provider === 'anthropic')!.id;
const usage = {
  inputTokens: { total: 1200, noCache: 1200, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 80, text: 80, reasoning: undefined },
};

let owner: Viewer;
let member: Viewer;
let guest: Viewer;

async function person(username: string, displayName: string, role: Viewer['role']): Promise<Viewer> {
  const a = await createAccount({ username, displayName, password: 'password1', role });
  return { id: a.id, role, displayName };
}

function answering(deltas: string[], options: { delayMs?: number; firstDelayMs?: number; failAfter?: number } = {}) {
  const parts: StreamPart[] = [{ type: 'text-start', id: 't' }];
  deltas.forEach((delta, index) => {
    if (index === options.failAfter) parts.push({ type: 'error', error: new Error('connection reset') });
    else parts.push({ type: 'text-delta', id: 't', delta });
  });
  if (options.failAfter === undefined) {
    parts.push({ type: 'text-end', id: 't' }, { type: 'finish', finishReason: { unified: 'stop', raw: undefined }, usage });
  }
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: parts,
        initialDelayInMs: options.firstDelayMs ?? null,
        chunkDelayInMs: options.delayMs ?? null,
      }),
    }),
  });
}

function failing() {
  return new MockLanguageModelV4({
    doStream: async () => {
      throw new Error('provider is down');
    },
  });
}

/** A 401 as the OpenAI provider builds it: the provider's own text, masked key included, is the message. */
function keyRefused() {
  const text = 'Incorrect API key provided: sk-proj-abc1***************wxyz.';
  return new APICallError({
    message: text,
    url: 'https://api.openai.com/v1/chat/completions',
    requestBodyValues: {},
    statusCode: 401,
    responseBody: JSON.stringify({ error: { message: text } }),
    isRetryable: false,
  });
}

/** A JSON body as the assistant page sends it, with its Content-Length. A string is sent as it is. */
function ask(
  session: Headers,
  body: unknown,
  { origin = APP, sized = true, signal }: { origin?: string | null; sized?: boolean; signal?: AbortSignal } = {},
) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const h = new Headers(session);
  h.set('host', 'localhost:3100');
  h.set('content-type', 'application/json');
  if (sized) h.set('content-length', String(new TextEncoder().encode(text).byteLength));
  if (origin) h.set('origin', origin);
  return new Request(`${APP}/api/chat`, { method: 'POST', headers: h, body: text, signal });
}

/** Makes the route's 120 s answer timeout fire after `ms` instead, for the duration of a test. */
function shortenAnswerTimeout(ms: number) {
  const realTimeout = AbortSignal.timeout.bind(AbortSignal);
  return vi.spyOn(AbortSignal, 'timeout').mockImplementation((asked) => realTimeout(asked === ANSWER_TIMEOUT_MS ? ms : asked));
}

/**
 * What an unfinished answer is counted as when the provider reports nothing: every character sent
 * (rules, context, history, question) at three to a token, and the longest answer allowed.
 */
function estimateFor(model: MockLanguageModelV4) {
  const chars = model.doStreamCalls[0].prompt.reduce(
    (sum, m) =>
      sum + (typeof m.content === 'string' ? m.content.length : m.content.reduce((n, p) => n + ('text' in p ? p.text.length : 0), 0)),
    0,
  );
  return { inputTokens: Math.ceil(chars / 3), outputTokens: MAX_OUTPUT_TOKENS };
}

const messagesOf = (userId: string) => db.select().from(chatMessages).where(eq(chatMessages.userId, userId)).all();
const usageRows = () => db.select().from(aiUsage).all();

beforeEach(async () => {
  await resetDb();
  vi.mocked(languageModel).mockReset();
  vi.stubEnv('ANTHROPIC_API_KEY', 'dummy');
  vi.stubEnv('OPENAI_API_KEY', '');
  vi.stubEnv('DEEPSEEK_API_KEY', '');
  owner = await person('owner', 'Owner', 'owner');
  member = await person('siti', 'Siti', 'member');
  guest = await person('mei', 'Mei', 'guest');
});

afterEach(() => vi.unstubAllEnvs());

describe('POST /api/chat, refusals', () => {
  it('refuses a signed-out request (401) and another site (403)', async () => {
    await setChatModel(owner, chatModel);
    expect((await POST(ask(new Headers(), { message: 'Hi' }))).status).toBe(401);
    const res = await POST(ask(await sessionHeaders('siti', 'password1'), { message: 'Hi' }, { origin: 'http://evil.example' }));
    expect(res.status).toBe(403);
    expect(languageModel).not.toHaveBeenCalled();
  });

  it('needs a size (411), caps the body (413) and wants a message of 1 to 2000 characters (400)', async () => {
    await setChatModel(owner, chatModel);
    const session = await sessionHeaders('siti', 'password1');

    expect((await POST(ask(session, { message: 'Hi' }, { sized: false }))).status).toBe(411);
    expect((await POST(ask(session, { message: 'x'.repeat(17 * 1024) }))).status).toBe(413);

    for (const bad of [{ message: '   ' }, { message: 'x'.repeat(2001) }, { message: 42 }, {}, 'not json', [1]]) {
      const res = await POST(ask(session, bad));
      expect(res.status).toBe(400);
    }
    expect((await (await POST(ask(session, { message: '' }))).json()).error).toBe('invalid_message');
    expect(languageModel).not.toHaveBeenCalled();
  });

  it('answers 409 not_configured while no chat model is chosen, and saves nothing', async () => {
    const res = await POST(ask(await sessionHeaders('siti', 'password1'), { message: 'How am I doing?' }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'not_configured' });
    expect(messagesOf(member.id)).toHaveLength(0);
    expect(languageModel).not.toHaveBeenCalled();
  });

  it('answers 429 budget_used once today is used up, for everyone, and saves nothing', async () => {
    await setChatModel(owner, chatModel);
    await setDailyBudget(owner, '0.01');
    await recordChatUsage(owner.id, chatModel, 100_000, 0);

    for (const username of ['siti', 'owner']) {
      const res = await POST(ask(await sessionHeaders(username, 'password1'), { message: 'How am I doing?' }));
      expect(res.status).toBe(429);
      expect(await res.json()).toEqual({ error: 'budget_used' });
    }
    expect(db.select().from(chatMessages).all()).toHaveLength(0);
    expect(usageRows()).toHaveLength(1);
    expect(languageModel).not.toHaveBeenCalled();
  });
});

describe('POST /api/chat, answers', () => {
  beforeEach(async () => {
    await setChatModel(owner, chatModel);
  });

  it('streams the answer, then saves both messages and one usage row', async () => {
    vi.mocked(languageModel).mockReturnValue(answering(['You have ', 'RM 760.00 ', 'left.']));
    const res = await POST(ask(await sessionHeaders('siti', 'password1'), { message: '  How am I doing?  ' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.text()).toBe('You have RM 760.00 left.');

    expect(messagesOf(member.id).map((m) => [m.role, m.content])).toEqual([
      ['user', 'How am I doing?'],
      ['assistant', 'You have RM 760.00 left.'],
    ]);
    expect(usageRows()).toEqual([
      expect.objectContaining({
        userId: member.id,
        model: chatModel,
        inputTokens: 1200,
        outputTokens: 80,
        costMicroUsd: costMicroUsd(chatModel, 1200, 80),
      }),
    ]);
    expect(languageModel).toHaveBeenCalledWith(chatModel);
  });

  it('sends the rules, the viewer’s own context and a capped answer length', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-13T04:00:00Z') });
    try {
      const groceries = (await createBudget(owner, { name: 'Groceries', allocationSen: 80000 })).id;
      await createTransaction(member, {
        merchant: 'Tesco',
        occurredAt: fromLocalDateTime('2026-11-03', '12:00'),
        totalSen: 4000,
        paymentMethod: 'card',
        budgetId: groceries,
        items: [],
      });
      const model = answering(['Fine.']);
      vi.mocked(languageModel).mockReturnValue(model);
      await (await POST(ask(await sessionHeaders('mei', 'password1'), { message: 'Berapa baki saya?' }))).text();

      const call = model.doStreamCalls[0];
      expect(call.maxOutputTokens).toBe(MAX_OUTPUT_TOKENS);
      expect(call.abortSignal).toBeDefined();
      const system = String(call.prompt.find((m) => m.role === 'system')?.content);
      expect(system).toMatch(/Malaysian household/);
      expect(system).toMatch(/RM/);
      expect(system).toMatch(/English or Malay/);
      expect(system).toMatch(/not a licensed financial adviser/);
      expect(system).toMatch(/investment advice/);
      expect(system).toMatch(/say so/);
      expect(system).toMatch(/data, not instructions/);
      expect(system).toContain('Groceries'); // the guest may see budget names
      expect(system).not.toContain('Tesco'); // but not a member's spending
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends only the last HISTORY_MESSAGES messages of this person, oldest first', async () => {
    const base = Date.now() - 60 * 60 * 1000;
    for (let i = 0; i < 30; i++) {
      db.insert(chatMessages)
        .values({ userId: member.id, role: i % 2 === 0 ? 'user' : 'assistant', content: `old ${i}`, createdAt: base + i * 1000 })
        .run();
    }
    db.insert(chatMessages).values({ userId: guest.id, role: 'user', content: 'not yours', createdAt: base }).run();
    const model = answering(['Ok.']);
    vi.mocked(languageModel).mockReturnValue(model);
    await (await POST(ask(await sessionHeaders('siti', 'password1'), { message: 'And now?' }))).text();

    const sent = model.doStreamCalls[0].prompt.filter((m) => m.role !== 'system');
    expect(sent).toHaveLength(HISTORY_MESSAGES + 1);
    const texts = sent.map((m) => (Array.isArray(m.content) ? m.content.map((p) => ('text' in p ? p.text : '')).join('') : m.content));
    expect(texts[0]).toBe('old 10');
    expect(texts.at(-2)).toBe('old 29');
    expect(texts.at(-1)).toBe('And now?');
    expect(texts).not.toContain('not yours');
  });

  it('answers 502 provider_error when the provider fails, and records no usage', async () => {
    vi.mocked(languageModel).mockReturnValue(failing());
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await POST(ask(await sessionHeaders('siti', 'password1'), { message: 'How am I doing?' }));
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: 'provider_error' });
    } finally {
      quiet.mockRestore();
    }
    expect(messagesOf(member.id)).toHaveLength(0);
    expect(usageRows()).toHaveLength(0);
  });

  it('logs a refused key by error name and status, never the provider text that quotes the key', async () => {
    vi.mocked(languageModel).mockReturnValue(
      new MockLanguageModelV4({
        doStream: async () => {
          throw keyRefused();
        },
      }),
    );
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await POST(ask(await sessionHeaders('siti', 'password1'), { message: 'How am I doing?' }));
      expect(res.status).toBe(502);
      const text = logged.mock.calls.flat().map((arg) => inspect(arg, { depth: 5 })).join('\n');
      expect(text).toContain('AI_APICallError (HTTP 401)');
      expect(text).not.toContain('sk-');
    } finally {
      logged.mockRestore();
    }
  });

  it('breaks the stream when the provider fails part way, saves no messages, and counts an estimate', async () => {
    const model = answering(['You have ', 'RM 760.00 ', 'left.'], { failAfter: 2 });
    vi.mocked(languageModel).mockReturnValue(model);
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await POST(ask(await sessionHeaders('siti', 'password1'), { message: 'How am I doing?' }));
      expect(res.status).toBe(200);
      await expect(res.text()).rejects.toThrow();
      await vi.waitFor(() => expect(usageRows()).toHaveLength(1));
    } finally {
      quiet.mockRestore();
    }
    expect(messagesOf(member.id)).toHaveLength(0);
    expect(usageRows()).toEqual([expect.objectContaining({ userId: member.id, model: chatModel, ...estimateFor(model) })]);
  });

  it('counts an estimate, and saves no messages, when the person leaves before the answer is complete', async () => {
    const model = answering(['One ', 'two ', 'three ', 'four.'], { delayMs: 30 });
    vi.mocked(languageModel).mockReturnValue(model);
    const res = await POST(ask(await sessionHeaders('siti', 'password1'), { message: 'How am I doing?' }));
    const reader = res.body!.getReader();
    await reader.read();
    await reader.cancel();
    await vi.waitFor(() => expect(usageRows()).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 200)); // the rest of the answer would have arrived by now
    expect(messagesOf(member.id)).toHaveLength(0);
    const [row] = usageRows();
    expect(row).toMatchObject({ userId: member.id, model: chatModel, ...estimateFor(model) });
    expect(row.costMicroUsd).toBe(costMicroUsd(chatModel, row.inputTokens, row.outputTokens));
    expect(row.costMicroUsd).toBeGreaterThan(0);
    expect(usageRows()).toHaveLength(1);
  });

  it('counts an estimate, and saves no messages, when the person leaves before the first word', async () => {
    const model = answering(['One ', 'two.'], { firstDelayMs: 300 });
    vi.mocked(languageModel).mockReturnValue(model);
    const leaving = new AbortController();
    const asking = POST(ask(await sessionHeaders('siti', 'password1'), { message: 'How am I doing?' }, { signal: leaving.signal }));
    await vi.waitFor(() => expect(model.doStreamCalls).toHaveLength(1)); // the provider has the question
    leaving.abort();
    const res = await asking;
    expect(res.status).toBe(502); // nobody is left to read it
    await vi.waitFor(() => expect(usageRows()).toHaveLength(1));
    expect(usageRows()).toEqual([expect.objectContaining({ userId: member.id, model: chatModel, ...estimateFor(model) })]);
    expect(messagesOf(member.id)).toHaveLength(0);
  });

  it('counts an estimate, and saves no messages, when the answer times out before the first word', async () => {
    const shortened = shortenAnswerTimeout(100);
    try {
      const model = answering(['One ', 'two.'], { firstDelayMs: 400 });
      vi.mocked(languageModel).mockReturnValue(model);
      const res = await POST(ask(await sessionHeaders('siti', 'password1'), { message: 'How am I doing?' }));
      expect(res.status).toBe(502);
      await vi.waitFor(() => expect(usageRows()).toHaveLength(1));
      expect(usageRows()).toEqual([expect.objectContaining({ userId: member.id, model: chatModel, ...estimateFor(model) })]);
      expect(messagesOf(member.id)).toHaveLength(0);
    } finally {
      shortened.mockRestore();
    }
  });

  it('counts an estimate, and saves no messages, when the answer times out part way', async () => {
    const shortened = shortenAnswerTimeout(100);
    try {
      const model = answering(['One ', 'two ', 'three ', 'four.'], { delayMs: 40 });
      vi.mocked(languageModel).mockReturnValue(model);
      const res = await POST(ask(await sessionHeaders('siti', 'password1'), { message: 'How am I doing?' }));
      expect(res.status).toBe(200);
      await expect(res.text()).rejects.toThrow();
      await vi.waitFor(() => expect(usageRows()).toHaveLength(1));
      expect(messagesOf(member.id)).toHaveLength(0);
      expect(usageRows()).toEqual([expect.objectContaining({ userId: member.id, ...estimateFor(model) })]);
    } finally {
      shortened.mockRestore();
    }
  });

  it('holds the estimate while the answer streams, then replaces it with the reported usage', async () => {
    const model = answering(['You have ', 'RM 760.00 ', 'left.'], { delayMs: 30 });
    vi.mocked(languageModel).mockReturnValue(model);
    const res = await POST(ask(await sessionHeaders('siti', 'password1'), { message: 'How am I doing?' }));
    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    let answer = (await reader.read()).value;

    const [held] = usageRows();
    expect(usageRows()).toHaveLength(1);
    expect(held).toMatchObject({ userId: member.id, model: chatModel, ...estimateFor(model) });
    expect(held.costMicroUsd).toBe(costMicroUsd(chatModel, held.inputTokens, held.outputTokens));

    for (let part = await reader.read(); !part.done; part = await reader.read()) answer += part.value;
    expect(answer).toBe('You have RM 760.00 left.');
    expect(usageRows()).toEqual([
      expect.objectContaining({
        id: held.id,
        createdAt: held.createdAt,
        inputTokens: 1200,
        outputTokens: 80,
        costMicroUsd: costMicroUsd(chatModel, 1200, 80),
      }),
    ]);
  });

  it('holds the estimate while the provider is asked, and lets it go when the provider fails before any words', async () => {
    const heldAtCall: (typeof aiUsage.$inferSelect)[][] = [];
    const model = new MockLanguageModelV4({
      doStream: async () => {
        heldAtCall.push(usageRows());
        throw new Error('provider is down');
      },
    });
    vi.mocked(languageModel).mockReturnValue(model);
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await POST(ask(await sessionHeaders('siti', 'password1'), { message: 'How am I doing?' }));
      expect(res.status).toBe(502);
    } finally {
      quiet.mockRestore();
    }
    expect(heldAtCall).toEqual([[expect.objectContaining({ userId: member.id, ...estimateFor(model) })]]);
    expect(usageRows()).toHaveLength(0);
  });

  it('answers only one of several questions sent at once when the budget fits only one', async () => {
    // One answer is held at 800 output tokens at US$20 per million, US$0.016: past US$0.01 on its own.
    const opus = MODELS.find((m) => m.id === 'claude-opus-5-5')!.id;
    await setChatModel(owner, opus);
    await setDailyBudget(owner, '0.01');
    const model = answering(['One ', 'two ', 'three.'], { delayMs: 30 });
    vi.mocked(languageModel).mockReturnValue(model);
    const sessions = [
      await sessionHeaders('siti', 'password1'),
      await sessionHeaders('mei', 'password1'),
      await sessionHeaders('owner', 'password1'),
    ];

    const answers = await Promise.all(sessions.map((session) => POST(ask(session, { message: 'How am I doing?' }))));

    expect(answers.map((res) => res.status).sort()).toEqual([200, 429, 429]);
    for (const res of answers.filter((r) => r.status === 429)) expect(await res.json()).toEqual({ error: 'budget_used' });
    expect(await answers.find((r) => r.status === 200)!.text()).toBe('One two three.');
    expect(model.doStreamCalls).toHaveLength(1);
    expect(usageRows()).toHaveLength(1);
    expect(db.select().from(chatMessages).all()).toHaveLength(2);
  });

  it('stops the assistant once abandoned answers have used up the budget', async () => {
    // 800 output tokens at US$10 per million are US$0.008, so the second abandoned answer passes US$0.01.
    const sonnet = MODELS.find((m) => m.id === 'claude-sonnet-5-5')!.id;
    await setChatModel(owner, sonnet);
    await setDailyBudget(owner, '0.01');
    const session = await sessionHeaders('siti', 'password1');
    for (let i = 1; i <= 2; i++) {
      vi.mocked(languageModel).mockReturnValue(answering(['One ', 'two ', 'three.'], { delayMs: 30 }));
      const res = await POST(ask(session, { message: 'How am I doing?' }));
      expect(res.status).toBe(200);
      const reader = res.body!.getReader();
      await reader.read();
      await reader.cancel();
      await vi.waitFor(() => expect(usageRows()).toHaveLength(i));
    }
    expect((await getAiBudgetStatus()).available).toBe(false);
    const refused = await POST(ask(session, { message: 'And now?' }));
    expect(refused.status).toBe(429);
    expect(messagesOf(member.id)).toHaveLength(0);
  });
});

describe('listChat and clearChat', () => {
  it('keeps each person’s conversation private to them', async () => {
    await setChatModel(owner, chatModel);
    vi.mocked(languageModel).mockReturnValue(answering(['For Siti.']));
    await (await POST(ask(await sessionHeaders('siti', 'password1'), { message: 'Siti asks' }))).text();
    vi.mocked(languageModel).mockReturnValue(answering(['For Mei.']));
    await (await POST(ask(await sessionHeaders('mei', 'password1'), { message: 'Mei asks' }))).text();

    expect((await listChat(member)).map((m) => [m.role, m.content])).toEqual([
      ['user', 'Siti asks'],
      ['assistant', 'For Siti.'],
    ]);
    expect((await listChat(guest)).map((m) => m.content)).toEqual(['Mei asks', 'For Mei.']);
    expect(await listChat(owner)).toEqual([]);

    await clearChat(member);
    expect(await listChat(member)).toEqual([]);
    expect(await listChat(guest)).toHaveLength(2);
  });
});
