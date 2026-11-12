import { and, desc, eq, gt, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db/client';
import { aiUsage, user } from '@/db/schema';
import { assertOwner, type Viewer } from '@/lib/auth/viewer';
import { dayKey } from '@/lib/time';
import { costMicroUsd } from './models';
import { getAiSettings, readSetting, writeSetting } from './settings';

// The daily AI budget caps the assistant only (receipt reading is never counted). "Today" is the
// Malaysian calendar day, so the count starts again at midnight in Kuala Lumpur.

/** Milliseconds; usage created at or before it no longer counts toward today. */
const RESET_KEY = 'ai.usageResetAt';

/** Rows that count toward today's budget: today's day key, and created after the owner's last reset. */
function countedToday(): SQL {
  const resetAt = readSetting(RESET_KEY);
  const today = eq(aiUsage.day, dayKey(new Date()));
  return typeof resetAt === 'number' ? and(today, gt(aiUsage.createdAt, resetAt))! : today;
}

/**
 * Today's spending against the owner's daily amount. A request that starts while `available` is
 * true may finish even if it goes past the budget (each answer is capped in length); no locking.
 */
export async function getAiBudgetStatus(): Promise<{ budgetMicroUsd: number; usedMicroUsd: number; available: boolean }> {
  const { dailyBudgetMicroUsd } = await getAiSettings();
  const row = db
    .select({ used: sql<number>`coalesce(sum(${aiUsage.costMicroUsd}), 0)` })
    .from(aiUsage)
    .where(countedToday())
    .get();
  const usedMicroUsd = row?.used ?? 0;
  return { budgetMicroUsd: dailyBudgetMicroUsd, usedMicroUsd, available: usedMicroUsd < dailyBudgetMicroUsd };
}

/** One assistant answer's tokens as the provider reported them, priced from the model list. */
export async function recordChatUsage(userId: string, modelId: string, inputTokens: number, outputTokens: number): Promise<void> {
  const now = new Date();
  db.insert(aiUsage)
    .values({
      userId,
      day: dayKey(now),
      model: modelId,
      inputTokens,
      outputTokens,
      costMicroUsd: costMicroUsd(modelId, inputTokens, outputTokens),
      createdAt: now.getTime(),
    })
    .run();
}

/** Lets everyone use the assistant again today. The rows stay; they simply stop counting. */
export async function resetTodayUsage(owner: Viewer): Promise<void> {
  assertOwner(owner);
  writeSetting(RESET_KEY, Date.now());
}

/** What each person has used of today's budget (the same rows as the total), largest first. */
export async function usageByPersonToday(owner: Viewer): Promise<{ name: string; usedMicroUsd: number }[]> {
  assertOwner(owner);
  const used = sql<number>`sum(${aiUsage.costMicroUsd})`;
  return db
    .select({ name: sql<string>`coalesce(${user.name}, 'Unknown')`, usedMicroUsd: used })
    .from(aiUsage)
    .leftJoin(user, eq(user.id, aiUsage.userId))
    .where(countedToday())
    .groupBy(aiUsage.userId)
    .orderBy(desc(used), user.name)
    .all();
}
