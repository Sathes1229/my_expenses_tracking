import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { invites } from '@/db/schema';
import { authEnv } from '@/lib/env';
import { ValidationError } from '@/lib/errors';
import { createAccount, displayNameError, passwordError, usernameError } from './accounts';
import { assertOwner, type Viewer } from './viewer';

export type InviteRole = 'member' | 'guest';
export type InviteListStatus = 'open' | 'used' | 'expired' | 'revoked';
export type InviteStatus = 'valid' | 'expired' | 'used' | 'revoked' | 'unknown';
export type InviteSummary = {
  id: string;
  role: InviteRole;
  createdAt: number;
  expiresAt: number;
  status: InviteListStatus;
};
export type AcceptResult = { ok: true } | { ok: false; reason: Exclude<InviteStatus, 'valid'> };

const LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

type InviteRow = typeof invites.$inferSelect;

/** Only this hash is stored, so a copy of the database cannot be turned back into working links. */
const hashToken = (token: string) => createHash('sha256').update(token, 'utf8').digest('hex');

const isInviteRole = (role: string): role is InviteRole => role === 'member' || role === 'guest';

function findByToken(token: string): InviteRow | undefined {
  if (!token) return undefined;
  return db.select().from(invites).where(eq(invites.tokenHash, hashToken(token))).get();
}

/** Used and revoked outrank expiry: they say what happened to the link, not just its age. */
function statusOf(row: InviteRow | undefined, now: number): InviteStatus {
  if (!row || !isInviteRole(row.role)) return 'unknown';
  if (row.usedAt !== null) return 'used';
  if (row.revokedAt !== null) return 'revoked';
  if (now >= row.expiresAt) return 'expired';
  return 'valid';
}

/** The address the owner copies and shares. Built from APP_URL, the address people open. */
export function inviteLink(token: string): string {
  return `${authEnv().appUrl.replace(/\/+$/, '')}/invite/${token}`;
}

/** The token is returned once, here; afterwards only its hash exists. */
export async function createInvite(owner: Viewer, role: InviteRole): Promise<{ id: string; token: string }> {
  assertOwner(owner);
  if (!isInviteRole(role)) throw new ValidationError('role', 'Choose Member or Guest.');

  const token = randomBytes(32).toString('base64url');
  const createdAt = Date.now();
  const row = db
    .insert(invites)
    .values({
      tokenHash: hashToken(token),
      role,
      createdBy: owner.id,
      createdAt,
      expiresAt: createdAt + LIFETIME_MS,
    })
    .returning({ id: invites.id })
    .get();
  return { id: row.id, token };
}

export async function listInvites(owner: Viewer): Promise<InviteSummary[]> {
  assertOwner(owner);
  const now = Date.now();
  return db
    .select()
    .from(invites)
    .orderBy(desc(invites.createdAt))
    .all()
    .flatMap((row) => {
      const status = statusOf(row, now);
      // Only a row whose role is not member or guest is 'unknown'; createInvite never writes one.
      if (status === 'unknown') return [];
      return [
        {
          id: row.id,
          role: row.role as InviteRole,
          createdAt: row.createdAt,
          expiresAt: row.expiresAt,
          status: status === 'valid' ? 'open' : status,
        },
      ];
    });
}

/** Takes back an unused invite. Revoking one that is already revoked changes nothing. */
export async function revokeInvite(owner: Viewer, id: string): Promise<void> {
  assertOwner(owner);
  db.transaction((tx) => {
    const row = tx.select().from(invites).where(eq(invites.id, id)).get();
    if (!row) throw new ValidationError('invite', 'That invite no longer exists.');
    if (row.usedAt !== null) throw new ValidationError('invite', 'That invite was already used, so it cannot be revoked.');
    if (row.revokedAt !== null) return;
    tx.update(invites).set({ revokedAt: Date.now() }).where(eq(invites.id, id)).run();
  });
}

export async function inviteStatus(token: string): Promise<{ status: InviteStatus; role?: InviteRole }> {
  const row = findByToken(token);
  const status = statusOf(row, Date.now());
  return status === 'valid' ? { status, role: row!.role as InviteRole } : { status };
}

/**
 * Creates the account an invite was made for. Race-safe: the invite is claimed (usedAt set) in one
 * synchronous transaction before the account is created, so of two people opening the same link
 * only one gets past the claim. If creating the account fails, the claim is released and the
 * invite works again. Bad input throws ValidationError before the invite is touched.
 */
export async function acceptInvite(
  token: string,
  input: { displayName: string; username: string; password: string },
): Promise<AcceptResult> {
  const found = findByToken(token);
  const before = statusOf(found, Date.now());
  if (before !== 'valid') return { ok: false, reason: before };
  const invite = found!;

  const problems: Array<[field: string, message: string | null]> = [
    ['displayName', displayNameError(input.displayName)],
    ['username', usernameError(input.username)],
    ['password', passwordError(input.password)],
  ];
  for (const [field, message] of problems) {
    if (message) throw new ValidationError(field, message);
  }

  const claimedAt = Date.now();
  const refused = db.transaction((tx): Exclude<InviteStatus, 'valid'> | null => {
    const claimed = tx
      .update(invites)
      .set({ usedAt: claimedAt })
      .where(
        and(
          eq(invites.id, invite.id),
          isNull(invites.usedAt),
          isNull(invites.revokedAt),
          gt(invites.expiresAt, claimedAt),
        ),
      )
      .returning({ id: invites.id })
      .all();
    if (claimed.length === 1) return null;
    const status = statusOf(tx.select().from(invites).where(eq(invites.id, invite.id)).get(), claimedAt);
    return status === 'valid' ? 'unknown' : status;
  });
  if (refused) return { ok: false, reason: refused };

  let account: { id: string };
  try {
    account = await createAccount({ ...input, role: invite.role as InviteRole });
  } catch (error) {
    // Release only the claim made here, so the invite can be used with, say, another username.
    db.update(invites)
      .set({ usedAt: null })
      .where(and(eq(invites.id, invite.id), eq(invites.usedAt, claimedAt), isNull(invites.usedBy)))
      .run();
    throw error;
  }
  db.update(invites).set({ usedBy: account.id }).where(eq(invites.id, invite.id)).run();
  return { ok: true };
}
