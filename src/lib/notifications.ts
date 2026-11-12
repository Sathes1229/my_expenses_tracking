import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { budgets, notificationReads, notifications } from '@/db/schema';
import type { Viewer } from '@/lib/auth/viewer';
import { allocationFor, budgetState, spentFor } from './budgets';
import { monthLabel } from './time';

const WINDOW_MS = 60 * 24 * 60 * 60 * 1000;

export type NotificationItem = { id: string; text: string; createdAt: Date; read: boolean };

/**
 * Records a notification for each warning level this budget has reached in the month. The unique
 * index on (budget, month, level) makes repeats and races harmless. Archived budgets, Uncategorised
 * (`null`) and zero allocations never alert.
 */
export async function evaluateBudgetAlerts(budgetId: string | null, month: string): Promise<void> {
  if (budgetId === null) return;
  const budget = db
    .select({ thresholdPct: budgets.thresholdPct, archivedAt: budgets.archivedAt })
    .from(budgets)
    .where(eq(budgets.id, budgetId))
    .get();
  if (!budget || budget.archivedAt !== null) return;
  const allocationSen = await allocationFor(budgetId, month);
  if (allocationSen === 0) return;
  const state = budgetState(await spentFor(budgetId, month), allocationSen, budget.thresholdPct);
  if (state === 'fine') return;
  const levels = state === 'over' ? (['threshold', 'over'] as const) : (['threshold'] as const);
  db.insert(notifications)
    .values(levels.map((level) => ({ budgetId, month, level })))
    .onConflictDoNothing()
    .run();
}

const since = () => Date.now() - WINDOW_MS;

function textFor(level: string, name: string, month: string): string {
  return level === 'over'
    ? `${name} is over budget for ${monthLabel(month)}.`
    : `${name} has passed its warning level for ${monthLabel(month)}.`;
}

/** The last 60 days, newest first. Same wording for every role, and no amounts. */
export async function listNotifications(viewer: Viewer): Promise<NotificationItem[]> {
  return db
    .select({
      id: notifications.id,
      level: notifications.level,
      month: notifications.month,
      name: budgets.name,
      createdAt: notifications.createdAt,
      readAt: notificationReads.readAt,
    })
    .from(notifications)
    .innerJoin(budgets, eq(budgets.id, notifications.budgetId))
    .leftJoin(
      notificationReads,
      and(eq(notificationReads.notificationId, notifications.id), eq(notificationReads.userId, viewer.id)),
    )
    .where(gte(notifications.createdAt, since()))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .all()
    .map((r) => ({
      id: r.id,
      text: textFor(r.level, r.name, r.month),
      createdAt: new Date(r.createdAt),
      read: r.readAt !== null,
    }));
}

export async function unreadCount(viewer: Viewer): Promise<number> {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(notifications)
    .leftJoin(
      notificationReads,
      and(eq(notificationReads.notificationId, notifications.id), eq(notificationReads.userId, viewer.id)),
    )
    .where(and(gte(notifications.createdAt, since()), isNull(notificationReads.readAt)))
    .get();
  return row?.n ?? 0;
}

export async function markAllRead(viewer: Viewer): Promise<void> {
  const unread = db
    .select({ id: notifications.id })
    .from(notifications)
    .leftJoin(
      notificationReads,
      and(eq(notificationReads.notificationId, notifications.id), eq(notificationReads.userId, viewer.id)),
    )
    .where(isNull(notificationReads.readAt))
    .all();
  if (unread.length === 0) return;
  db.insert(notificationReads)
    .values(unread.map((n) => ({ notificationId: n.id, userId: viewer.id, readAt: Date.now() })))
    .onConflictDoNothing()
    .run();
}
