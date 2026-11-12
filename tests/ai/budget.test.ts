import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/client';
import { aiUsage } from '@/db/schema';
import { createAccount } from '@/lib/auth/accounts';
import type { Viewer } from '@/lib/auth/viewer';
import { ForbiddenError } from '@/lib/errors';
import { getAiBudgetStatus, recordChatUsage, resetTodayUsage, usageByPersonToday } from '@/lib/ai/budget';
import { costMicroUsd } from '@/lib/ai/models';
import { setDailyBudget } from '@/lib/ai/settings';
import { resetDb } from '../helpers/db';

// 'fixture' is priced like the fixture in models.test.ts: US$3 in and US$15 out per million tokens.
vi.mock('@/lib/ai/models', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/models')>();
  const fixture = { id: 'fixture', provider: 'anthropic', label: 'Fixture', vision: false, inputUsdPerMTok: 3, outputUsdPerMTok: 15 } as const;
  return {
    ...actual,
    costMicroUsd: (id: string, input: number, output: number) =>
      id === 'fixture' ? actual.costFor(fixture, input, output) : actual.costMicroUsd(id, input, output),
  };
});

let owner: Viewer;
let member: Viewer;
let guest: Viewer;

async function person(username: string, displayName: string, role: Viewer['role']): Promise<Viewer> {
  const a = await createAccount({ username, displayName, password: 'password1', role });
  return { id: a.id, role, displayName };
}

// 12:00 on 13 November in Malaysia.
const NOON = new Date('2026-11-13T04:00:00Z');

beforeEach(async () => {
  // Only Date is faked, so the database and password hashing keep working.
  vi.useFakeTimers({ toFake: ['Date'], now: NOON });
  await resetDb();
  owner = await person('owner', 'Owner', 'owner');
  member = await person('siti', 'Siti', 'member');
  guest = await person('mei', 'Mei', 'guest');
});

afterEach(() => vi.useRealTimers());

const later = (ms: number) => vi.setSystemTime(new Date(Date.now() + ms));

describe('getAiBudgetStatus', () => {
  it('lets the request that crosses the budget finish, then blocks everyone', async () => {
    // budget US$1.00
    await recordChatUsage(member.id, 'fixture', 100_000, 40_000); // 0.90
    expect(await getAiBudgetStatus()).toEqual({ budgetMicroUsd: 1_000_000, usedMicroUsd: 900_000, available: true });
    await recordChatUsage(guest.id, 'fixture', 10_000, 6_000); // +0.12 -> 1.02, the overshoot is allowed
    expect(await getAiBudgetStatus()).toMatchObject({ usedMicroUsd: 1_020_000, available: false });
  });

  it('counts nothing once the owner resets, and counts what comes after', async () => {
    await recordChatUsage(member.id, 'fixture', 100_000, 60_000);
    expect((await getAiBudgetStatus()).available).toBe(false);
    await resetTodayUsage(owner);
    expect((await getAiBudgetStatus()).usedMicroUsd).toBe(0);
    expect((await getAiBudgetStatus()).available).toBe(true);

    later(60_000);
    await recordChatUsage(member.id, 'fixture', 10_000, 0);
    expect((await getAiBudgetStatus()).usedMicroUsd).toBe(30_000);
  });

  it('refuses a reset from anyone but the owner', async () => {
    await recordChatUsage(member.id, 'fixture', 100_000, 60_000);
    await expect(resetTodayUsage(member)).rejects.toThrow(ForbiddenError);
    await expect(resetTodayUsage(guest)).rejects.toThrow(ForbiddenError);
    expect((await getAiBudgetStatus()).available).toBe(false);
  });

  it('starts again at midnight Malaysia time', async () => {
    vi.setSystemTime(new Date('2026-11-13T15:59:00Z')); // 23:59 in Malaysia
    await recordChatUsage(member.id, 'fixture', 100_000, 60_000);
    expect((await getAiBudgetStatus()).available).toBe(false);

    vi.setSystemTime(new Date('2026-11-13T16:01:00Z')); // 00:01 the next day
    expect(await getAiBudgetStatus()).toEqual({ budgetMicroUsd: 1_000_000, usedMicroUsd: 0, available: true });
  });

  it('is available again as soon as the owner raises the budget', async () => {
    await recordChatUsage(member.id, 'fixture', 10_000, 66_000); // 1.02
    expect((await getAiBudgetStatus()).available).toBe(false);
    await setDailyBudget(owner, '2.00');
    expect(await getAiBudgetStatus()).toEqual({ budgetMicroUsd: 2_000_000, usedMicroUsd: 1_020_000, available: true });
  });
});

describe('recordChatUsage', () => {
  it('stores the tokens, the model, the Malaysian day and the price from the model list', async () => {
    vi.setSystemTime(new Date('2026-11-13T16:30:00Z')); // already the 14th in Malaysia
    await recordChatUsage(member.id, 'claude-haiku-5-5', 1200, 300);
    expect(db.select().from(aiUsage).all()).toEqual([
      expect.objectContaining({
        userId: member.id,
        day: '2026-11-14',
        model: 'claude-haiku-5-5',
        inputTokens: 1200,
        outputTokens: 300,
        costMicroUsd: costMicroUsd('claude-haiku-5-5', 1200, 300),
      }),
    ]);
  });
});

describe('usageByPersonToday', () => {
  it('gives the owner what each person used since the last reset today, largest first', async () => {
    vi.setSystemTime(new Date('2026-11-12T10:00:00Z')); // yesterday
    await recordChatUsage(owner.id, 'fixture', 100_000, 0);
    vi.setSystemTime(NOON);
    await recordChatUsage(guest.id, 'fixture', 1_000, 0);
    await resetTodayUsage(owner);
    later(1000);
    await recordChatUsage(member.id, 'fixture', 10_000, 0);
    await recordChatUsage(guest.id, 'fixture', 20_000, 0);
    await recordChatUsage(member.id, 'fixture', 1_000, 0);

    expect(await usageByPersonToday(owner)).toEqual([
      { name: 'Mei', usedMicroUsd: 60_000 },
      { name: 'Siti', usedMicroUsd: 33_000 },
    ]);
  });

  it('is owner only', async () => {
    await expect(usageByPersonToday(member)).rejects.toThrow(ForbiddenError);
    await expect(usageByPersonToday(guest)).rejects.toThrow(ForbiddenError);
  });
});
