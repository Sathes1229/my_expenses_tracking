import { randomInt } from 'node:crypto';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { db } from '@/db/client';
import { account, session, user } from '@/db/schema';
import { ValidationError } from '@/lib/errors';
import { displayNameError, passwordError } from './accounts';
import { getAuth } from './auth';
import { assertOwner, type Role, type Viewer } from './viewer';

export type Person = { id: string; displayName: string; username: string; role: Role };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const GONE = 'That person is not in the app any more.';

// Lower-case letters and digits without look-alikes (0/o, 1/l/i), so it can be read out or typed on a phone.
const TEMP_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Twelve characters in groups of four, about 59 bits: "k7mp-3xqa-9wte". */
function temporaryPassword(): string {
  const groups = Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () => TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)]).join(''),
  );
  return groups.join('-');
}

/** The member or guest the owner is acting on, read inside the transaction that changes them. */
function targetPerson(tx: Tx, userId: string, ownerMessage: string): { id: string } {
  const row = tx
    .select({ id: user.id, role: user.role, removedAt: user.removedAt })
    .from(user)
    .where(eq(user.id, userId))
    .get();
  if (!row || row.removedAt) throw new ValidationError('person', GONE);
  if (row.role === 'owner') throw new ValidationError('person', ownerMessage);
  return { id: row.id };
}

/**
 * Sessions live only in the database (no secondary storage, cookie cache off), so deleting the
 * rows signs the person out on their next request. Done inside the caller's transaction, so no
 * session survives a password change or removal even for a moment.
 */
function endSessions(tx: Tx, userId: string, keepSessionId?: string): void {
  tx.delete(session)
    .where(keepSessionId ? and(eq(session.userId, userId), ne(session.id, keepSessionId)) : eq(session.userId, userId))
    .run();
}

function setPassword(tx: Tx, userId: string, passwordHash: string): void {
  const result = tx
    .update(account)
    .set({ password: passwordHash })
    .where(and(eq(account.userId, userId), eq(account.providerId, 'credential')))
    .run();
  if (result.changes !== 1) throw new Error('This person has no password to change.');
}

/** Everyone not removed, the owner first, then by name. */
export async function listPeople(owner: Viewer): Promise<Person[]> {
  assertOwner(owner);
  return db
    .select({ id: user.id, displayName: user.name, username: user.username, role: user.role })
    .from(user)
    .where(isNull(user.removedAt))
    .all()
    .map((p) => ({ ...p, username: p.username ?? '' }))
    .sort(
      (a, b) =>
        Number(b.role === 'owner') - Number(a.role === 'owner') ||
        a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }),
    );
}

/** Takes effect on the person's next request: the viewer's role is read from the database each time. */
export async function changeRole(owner: Viewer, userId: string, role: 'member' | 'guest'): Promise<void> {
  assertOwner(owner);
  if (role !== 'member' && role !== 'guest') throw new ValidationError('role', 'Choose Member or Guest.');
  db.transaction((tx) => {
    targetPerson(tx, userId, "The owner's role cannot be changed.");
    tx.update(user).set({ role }).where(eq(user.id, userId)).run();
  });
}

/**
 * Replaces a forgotten password with a temporary one the owner passes on. The person must choose
 * their own at the next sign-in, and every session they had ends.
 */
export async function resetPassword(owner: Viewer, userId: string): Promise<{ tempPassword: string }> {
  assertOwner(owner);
  const tempPassword = temporaryPassword();
  const passwordHash = await (await getAuth().$context).password.hash(tempPassword);
  // One synchronous transaction: password, flag and sessions change together or not at all.
  db.transaction((tx) => {
    targetPerson(tx, userId, 'The owner changes their own password in Profile.');
    setPassword(tx, userId, passwordHash);
    tx.update(user).set({ mustChangePassword: true }).where(eq(user.id, userId)).run();
    endSessions(tx, userId);
  });
  return { tempPassword };
}

/** Signs the person out and keeps them from signing in. Their transactions stay, under their name. */
export async function removePerson(owner: Viewer, userId: string): Promise<void> {
  assertOwner(owner);
  db.transaction((tx) => {
    targetPerson(tx, userId, 'The owner cannot be removed.');
    tx.update(user).set({ removedAt: new Date() }).where(eq(user.id, userId)).run();
    endSessions(tx, userId);
  });
}

export async function updateProfile(viewer: Viewer, input: { displayName: string }): Promise<void> {
  const problem = displayNameError(input.displayName);
  if (problem) throw new ValidationError('displayName', problem);
  db.update(user)
    .set({ name: input.displayName.trim() })
    .where(and(eq(user.id, viewer.id), isNull(user.removedAt)))
    .run();
}

/**
 * Checks the current password, sets the new one and signs out every other session (pass the
 * current session's id to keep it). Wrong current password: ValidationError on `current`.
 */
export async function changeOwnPassword(
  viewer: Viewer,
  current: string,
  next: string,
  keepSessionId?: string,
): Promise<void> {
  const problem = passwordError(next);
  if (problem) throw new ValidationError('password', problem);

  const ctx = await getAuth().$context;
  const credential = await ctx.internalAdapter.findCredentialAccount(viewer.id);
  const matches =
    !!current &&
    !!credential?.password &&
    (await ctx.password.verify({ hash: credential.password, password: current }));
  if (!matches) throw new ValidationError('current', 'That is not your current password.');

  const passwordHash = await ctx.password.hash(next);
  db.transaction((tx) => {
    setPassword(tx, viewer.id, passwordHash);
    endSessions(tx, viewer.id, keepSessionId);
  });
}
