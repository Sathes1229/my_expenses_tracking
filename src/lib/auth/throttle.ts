import { and, asc, eq, gt, inArray, lt } from 'drizzle-orm';
import { db } from '@/db/client';
import { loginAttempts } from '@/db/schema';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_USERNAME = 5;
const MAX_FAILURES_PER_IP = 20;

const usernameKey = (username: string) => `user:${username.trim().toLowerCase()}`;
const ipKey = (ip: string) => `ip:${ip}`;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type LoginGate = { allowed: true } | { allowed: false; retryAfterSec: number };
export type LoginAttempt =
  | { allowed: true; attemptIds: string[] }
  | { allowed: false; retryAfterSec: number };

/**
 * When the lock on this username or address lifts, or 0 when there is none. Failures count in a
 * rolling 15 minutes; a success never resets the count, so guessing between real sign-ins gains nothing.
 */
function lockedUntil(tx: Tx | typeof db, username: string, ip: string, now: number): number {
  let retryAt = 0;
  const rules: Array<[key: string, limit: number]> = [
    [usernameKey(username), MAX_FAILURES_PER_USERNAME],
    [ipKey(ip), MAX_FAILURES_PER_IP],
  ];
  for (const [key, limit] of rules) {
    const failures = tx
      .select({ at: loginAttempts.at })
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.key, key),
          eq(loginAttempts.success, false),
          gt(loginAttempts.at, now - WINDOW_MS),
        ),
      )
      .orderBy(asc(loginAttempts.at))
      .all();
    if (failures.length >= limit) {
      // The lock lifts when this failure leaves the window, leaving limit - 1 behind it.
      retryAt = Math.max(retryAt, failures[failures.length - limit].at + WINDOW_MS);
    }
  }
  return retryAt;
}

function insertAttempt(tx: Tx, username: string, ip: string, at: number, success: boolean): string[] {
  const rows = tx
    .insert(loginAttempts)
    .values([
      { key: usernameKey(username), at, success },
      { key: ipKey(ip), at, success },
    ])
    .returning({ id: loginAttempts.id })
    .all();
  tx.delete(loginAttempts).where(lt(loginAttempts.at, at - WINDOW_MS)).run();
  return rows.map((r) => r.id);
}

export async function checkLoginAllowed(username: string, ip: string): Promise<LoginGate> {
  const now = Date.now();
  const retryAt = lockedUntil(db, username, ip, now);
  if (retryAt === 0) return { allowed: true };
  return { allowed: false, retryAfterSec: Math.ceil((retryAt - now) / 1000) };
}

/**
 * Checks the limits and, if allowed, records the attempt as a failure in the same transaction, so
 * requests that overlap while a password is being verified cannot all pass the check. Call
 * markLoginSucceeded with the returned ids when the attempt turns out to be right.
 */
export async function beginLoginAttempt(username: string, ip: string): Promise<LoginAttempt> {
  const now = Date.now();
  return db.transaction((tx): LoginAttempt => {
    const retryAt = lockedUntil(tx, username, ip, now);
    if (retryAt !== 0) return { allowed: false, retryAfterSec: Math.ceil((retryAt - now) / 1000) };
    return { allowed: true, attemptIds: insertAttempt(tx, username, ip, now, false) };
  });
}

export async function markLoginSucceeded(attemptIds: string[]): Promise<void> {
  if (attemptIds.length === 0) return;
  db.update(loginAttempts).set({ success: true }).where(inArray(loginAttempts.id, attemptIds)).run();
}

export async function recordLoginAttempt(username: string, ip: string, success: boolean): Promise<void> {
  db.transaction((tx) => {
    insertAttempt(tx, username, ip, Date.now(), success);
  });
}

/**
 * The address to throttle by. Next fills x-forwarded-for with the socket address when a request
 * arrives without one; behind a reverse proxy (phase 2) the proxy sets it.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip')?.trim() || 'unknown';
}
