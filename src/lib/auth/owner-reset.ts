import { createHash, timingSafeEqual } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { account, session, settings, user } from '@/db/schema';
import { env } from '@/lib/env';
import { ValidationError } from '@/lib/errors';
import { passwordError } from './accounts';
import { getAuth } from './auth';

/** settings key holding the SHA-256 (hex, JSON string) of the last token that was used. */
const USED_TOKEN_KEY = 'ownerReset.usedTokenHash';

const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest();

export type OwnerResetResult = 'ok' | 'invalid' | 'used' | 'disabled';

/**
 * Lets the owner set a new password with OWNER_RESET_TOKEN from .env. Each token works once;
 * on success every owner session ends. A too-short password throws before the token is spent.
 */
export async function resetOwnerPassword(token: string, newPassword: string): Promise<OwnerResetResult> {
  const expected = env.OWNER_RESET_TOKEN;
  if (!expected) return 'disabled';

  // Digests have equal length, so timingSafeEqual can compare them without leaking the token.
  const given = sha256(token);
  if (!timingSafeEqual(given, sha256(expected))) return 'invalid';
  const usedValue = JSON.stringify(given.toString('hex'));
  const isUsed = () =>
    db.select({ value: settings.value }).from(settings).where(eq(settings.key, USED_TOKEN_KEY)).get()?.value ===
    usedValue;
  if (isUsed()) return 'used';

  const problem = passwordError(newPassword);
  if (problem) throw new ValidationError('password', problem);

  const owner = db.select({ id: user.id }).from(user).where(eq(user.role, 'owner')).get();
  if (!owner) throw new Error('There is no owner account to reset.');
  const passwordHash = await (await getAuth().$context).password.hash(newPassword);

  // One synchronous transaction, so two requests with the same token cannot both succeed.
  // Sessions live only in the database (no secondary storage), so deleting the rows signs the owner out.
  return db.transaction((tx) => {
    if (isUsed()) return 'used';
    tx.update(account)
      .set({ password: passwordHash })
      .where(and(eq(account.userId, owner.id), eq(account.providerId, 'credential')))
      .run();
    tx.update(user).set({ mustChangePassword: false }).where(eq(user.id, owner.id)).run();
    tx.insert(settings)
      .values({ key: USED_TOKEN_KEY, value: usedValue })
      .onConflictDoUpdate({ target: settings.key, set: { value: usedValue } })
      .run();
    tx.delete(session).where(eq(session.userId, owner.id)).run();
    return 'ok';
  });
}
