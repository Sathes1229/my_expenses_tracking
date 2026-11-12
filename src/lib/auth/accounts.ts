import { isAPIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { user } from '@/db/schema';
import { ValidationError } from '@/lib/errors';
import { getAuth } from './auth';
import { checkLoginAllowed, recordLoginAttempt } from './throttle';
import type { Role } from './viewer';

const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;
const USERNAME_TAKEN = 'That username is already taken.';

/** Usernames are stored and compared lower-cased. Phones often add a trailing space, so trim it. */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function usernameError(username: string): string | null {
  const normalized = normalizeUsername(username);
  if (!normalized) return 'Enter a username.';
  if (!USERNAME_PATTERN.test(normalized)) {
    return 'Use 3 to 30 characters: letters, numbers, dots or underscores.';
  }
  return null;
}

/** Better Auth refuses passwords over 128 characters at sign-in, so they are refused here too. */
export function passwordError(password: string): string | null {
  if (!password) return 'Enter a password.';
  if (password.length < 8) return 'Use at least 8 characters.';
  if (password.length > 128) return 'Use 128 characters or fewer.';
  return null;
}

export function displayNameError(displayName: string): string | null {
  const name = displayName.trim();
  if (!name) return 'Enter a name.';
  if (name.length > 50) return 'Use 50 characters or fewer.';
  return null;
}

export async function hasAnyUser(): Promise<boolean> {
  return db.select({ id: user.id }).from(user).limit(1).get() !== undefined;
}

function usernameTaken(normalized: string): boolean {
  return db.select({ id: user.id }).from(user).where(eq(user.username, normalized)).get() !== undefined;
}

/**
 * The only way accounts are created (public sign-up is off). Throws ValidationError for bad input
 * or a taken username; a second owner is refused by the database.
 */
export async function createAccount(input: {
  username: string;
  displayName: string;
  password: string;
  role: Role;
  mustChangePassword?: boolean;
}): Promise<{ id: string }> {
  const problems: Array<[field: string, message: string | null]> = [
    ['displayName', displayNameError(input.displayName)],
    ['username', usernameError(input.username)],
    ['password', passwordError(input.password)],
  ];
  for (const [field, message] of problems) {
    if (message) throw new ValidationError(field, message);
  }
  const username = normalizeUsername(input.username);
  if (usernameTaken(username)) throw new ValidationError('username', USERNAME_TAKEN);

  // Same calls as Better Auth's own server-side createUser (admin plugin), without its extra endpoints.
  const ctx = await getAuth().$context;
  const passwordHash = await ctx.password.hash(input.password);
  let created: { id: string };
  try {
    created = await ctx.internalAdapter.createUser(
      {
        name: input.displayName.trim(),
        email: `${crypto.randomUUID()}@users.invalid`,
        username,
        role: input.role,
        mustChangePassword: input.mustChangePassword ?? false,
      },
      { method: 'admin' },
    );
  } catch (error) {
    // Someone took the username between the check above and the insert.
    if (usernameTaken(username)) throw new ValidationError('username', USERNAME_TAKEN);
    throw error;
  }
  try {
    await ctx.internalAdapter.linkAccount({
      providerId: 'credential',
      accountId: created.id,
      userId: created.id,
      password: passwordHash,
    });
  } catch (error) {
    await ctx.internalAdapter.deleteUser(created.id);
    throw error;
  }
  return { id: created.id };
}

export type SignInResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'locked'; retryAfterSec?: number };

/**
 * Checks the throttle, then signs in through Better Auth. In a server action the session cookie
 * is set by the nextCookies plugin. Wrong username, wrong password and removed person all look alike.
 */
export async function signIn(username: string, password: string, ip: string): Promise<SignInResult> {
  const gate = await checkLoginAllowed(username, ip);
  if (!gate.allowed) return { ok: false, reason: 'locked', retryAfterSec: gate.retryAfterSec };

  let ok = true;
  try {
    await getAuth().api.signInUsername({
      body: { username: normalizeUsername(username), password },
      // Recorded on the session row as its IP address.
      headers: new Headers({ 'x-forwarded-for': ip }),
    });
  } catch (error) {
    if (!isAPIError(error)) throw error;
    ok = false;
  }
  await recordLoginAttempt(username, ip, ok);
  return ok ? { ok: true } : { ok: false, reason: 'invalid' };
}

/** Replaces a temporary password chosen by the owner with the person's own. */
export async function replaceTemporaryPassword(userId: string, newPassword: string): Promise<void> {
  const problem = passwordError(newPassword);
  if (problem) throw new ValidationError('password', problem);

  const ctx = await getAuth().$context;
  const current = await ctx.internalAdapter.findCredentialAccount(userId);
  if (current?.password && (await ctx.password.verify({ hash: current.password, password: newPassword }))) {
    throw new ValidationError('password', 'Choose a password different from the temporary one.');
  }
  await ctx.internalAdapter.updatePassword(userId, await ctx.password.hash(newPassword));
  db.update(user).set({ mustChangePassword: false }).where(eq(user.id, userId)).run();
}
