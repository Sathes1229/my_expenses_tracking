import { and, asc, eq, gt, lt } from 'drizzle-orm';
import { db } from '@/db/client';
import { loginAttempts } from '@/db/schema';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_USERNAME = 5;
const MAX_FAILURES_PER_IP = 20;

const usernameKey = (username: string) => `user:${username.trim().toLowerCase()}`;
const ipKey = (ip: string) => `ip:${ip}`;

export type LoginGate = { allowed: true } | { allowed: false; retryAfterSec: number };

/**
 * Failures count in a rolling 15 minutes, per username and per address. A success does not
 * reset the count, so guessing between real sign-ins gains nothing.
 */
export async function checkLoginAllowed(username: string, ip: string): Promise<LoginGate> {
  const now = Date.now();
  let retryAt = 0;
  const rules: Array<[key: string, limit: number]> = [
    [usernameKey(username), MAX_FAILURES_PER_USERNAME],
    [ipKey(ip), MAX_FAILURES_PER_IP],
  ];
  for (const [key, limit] of rules) {
    const failures = db
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
  if (retryAt === 0) return { allowed: true };
  return { allowed: false, retryAfterSec: Math.ceil((retryAt - now) / 1000) };
}

export async function recordLoginAttempt(username: string, ip: string, success: boolean): Promise<void> {
  const at = Date.now();
  db.transaction((tx) => {
    tx.insert(loginAttempts)
      .values([
        { key: usernameKey(username), at, success },
        { key: ipKey(ip), at, success },
      ])
      .run();
    tx.delete(loginAttempts).where(lt(loginAttempts.at, at - WINDOW_MS)).run();
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
