import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { session, transactions, user } from '@/db/schema';
import { createAccount, signIn } from '@/lib/auth/accounts';
import { getAuth } from '@/lib/auth/auth';
import {
  changeOwnPassword,
  changeRole,
  listPeople,
  removePerson,
  resetPassword,
  updateProfile,
} from '@/lib/auth/people';
import { viewerFromHeaders, type Viewer } from '@/lib/auth/viewer';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { resetDb } from '../helpers/db';
import { sessionHeaders } from '../helpers/session';

let owner: Viewer;
let member: Viewer;
let guest: Viewer;

beforeEach(async () => {
  await resetDb();
  const o = await createAccount({ username: 'owner', displayName: 'Owner', password: 'password1', role: 'owner' });
  const m = await createAccount({ username: 'siti', displayName: 'Siti', password: 'password1', role: 'member' });
  const g = await createAccount({ username: 'ali', displayName: 'Ali', password: 'password1', role: 'guest' });
  owner = { id: o.id, role: 'owner', displayName: 'Owner' };
  member = { id: m.id, role: 'member', displayName: 'Siti' };
  guest = { id: g.id, role: 'guest', displayName: 'Ali' };
});

const row = (id: string) => db.select().from(user).where(eq(user.id, id)).get();

describe('owner-only functions', () => {
  it('throw ForbiddenError for a member or guest', async () => {
    for (const viewer of [member, guest]) {
      await expect(listPeople(viewer)).rejects.toThrow(ForbiddenError);
      await expect(changeRole(viewer, guest.id, 'member')).rejects.toThrow(ForbiddenError);
      await expect(resetPassword(viewer, guest.id)).rejects.toThrow(ForbiddenError);
      await expect(removePerson(viewer, guest.id)).rejects.toThrow(ForbiddenError);
    }
    expect(row(guest.id)).toMatchObject({ role: 'guest', removedAt: null, mustChangePassword: false });
  });
});

describe('listPeople', () => {
  it('lists everyone not removed, the owner first', async () => {
    await removePerson(owner, guest.id);
    expect(await listPeople(owner)).toEqual([
      { id: owner.id, displayName: 'Owner', username: 'owner', role: 'owner' },
      { id: member.id, displayName: 'Siti', username: 'siti', role: 'member' },
    ]);
  });
});

// Review Focus 5: access that changes while someone is signed in.
describe('changes take effect on the next request', () => {
  it('a removed person loses their session', async () => {
    const headers = await sessionHeaders('siti', 'password1');
    expect(await viewerFromHeaders(headers)).toEqual(member);

    await removePerson(owner, member.id);

    expect(await viewerFromHeaders(headers)).toBeNull();
    expect(db.select().from(session).where(eq(session.userId, member.id)).all()).toHaveLength(0);
    expect(row(member.id)?.removedAt).toBeInstanceOf(Date);
    expect(await signIn('siti', 'password1', '1.1.1.1')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('a member changed to guest is a guest on their next request', async () => {
    const headers = await sessionHeaders('siti', 'password1');
    await changeRole(owner, member.id, 'guest');
    expect(await viewerFromHeaders(headers)).toEqual({ ...member, role: 'guest' });

    await changeRole(owner, member.id, 'member');
    expect(await viewerFromHeaders(headers)).toEqual(member);
  });
});

describe('removePerson', () => {
  it('keeps their transactions', async () => {
    db.insert(transactions)
      .values({ merchant: 'Shop', occurredAt: Date.now(), totalSen: 1250, paymentMethod: 'cash', createdBy: member.id })
      .run();
    await removePerson(owner, member.id);
    expect(db.select().from(transactions).where(eq(transactions.createdBy, member.id)).all()).toHaveLength(1);
    expect(row(member.id)?.name).toBe('Siti');
  });

  it('cannot remove the owner', async () => {
    await expect(removePerson(owner, owner.id)).rejects.toThrow(ValidationError);
    expect(row(owner.id)?.removedAt).toBeNull();
  });

  it('refuses someone already removed or unknown', async () => {
    await removePerson(owner, guest.id);
    await expect(removePerson(owner, guest.id)).rejects.toThrow(ValidationError);
    await expect(removePerson(owner, 'no-such-id')).rejects.toThrow(ValidationError);
  });
});

describe('changeRole', () => {
  it('cannot change the owner', async () => {
    await expect(changeRole(owner, owner.id, 'guest')).rejects.toThrow(ValidationError);
    expect(row(owner.id)?.role).toBe('owner');
  });

  it('only switches between member and guest', async () => {
    await expect(changeRole(owner, member.id, 'owner' as 'guest')).rejects.toThrow(ValidationError);
    expect(row(member.id)?.role).toBe('member');
  });

  it('refuses a removed person', async () => {
    await removePerson(owner, guest.id);
    await expect(changeRole(owner, guest.id, 'member')).rejects.toThrow(ValidationError);
  });
});

describe('resetPassword', () => {
  it('replaces the password with a temporary one and signs them out everywhere', async () => {
    const headers = await sessionHeaders('siti', 'password1');

    const { tempPassword } = await resetPassword(owner, member.id);

    expect(tempPassword.length).toBeGreaterThanOrEqual(10);
    expect(row(member.id)?.mustChangePassword).toBe(true);
    expect(await viewerFromHeaders(headers)).toBeNull();
    expect((await signIn('siti', 'password1', '1.1.1.1')).ok).toBe(false);
    expect(await signIn('siti', tempPassword, '1.1.1.1')).toEqual({ ok: true });
  });

  it('gives a different temporary password each time', async () => {
    const a = await resetPassword(owner, member.id);
    const b = await resetPassword(owner, member.id);
    expect(a.tempPassword).not.toBe(b.tempPassword);
  });

  it('is not for the owner, who changes their own password in Profile', async () => {
    await expect(resetPassword(owner, owner.id)).rejects.toThrow(ValidationError);
    expect(await signIn('owner', 'password1', '1.1.1.1')).toEqual({ ok: true });
  });

  it('refuses a removed person', async () => {
    await removePerson(owner, guest.id);
    await expect(resetPassword(owner, guest.id)).rejects.toThrow(ValidationError);
  });
});

describe('updateProfile', () => {
  it('changes the display name, trimmed, for anyone', async () => {
    await updateProfile(guest, { displayName: '  Ali Baba ' });
    expect(row(guest.id)?.name).toBe('Ali Baba');
  });

  it('needs 1 to 40 characters', async () => {
    await expect(updateProfile(member, { displayName: '   ' })).rejects.toThrow(ValidationError);
    await expect(updateProfile(member, { displayName: 'x'.repeat(41) })).rejects.toThrow(ValidationError);
    await updateProfile(member, { displayName: 'x'.repeat(40) });
    expect(row(member.id)?.name).toBe('x'.repeat(40));
  });
});

describe('changeOwnPassword', () => {
  it('needs the current password', async () => {
    const error = await changeOwnPassword(member, 'wrongpass', 'newpassword1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).field).toBe('current');
    expect(await signIn('siti', 'password1', '1.1.1.1')).toEqual({ ok: true });
  });

  it('refuses a new password that is too short', async () => {
    await expect(changeOwnPassword(member, 'password1', 'short')).rejects.toThrow(ValidationError);
  });

  it('sets the new password and signs out every other session', async () => {
    const mine = await sessionHeaders('siti', 'password1');
    const other = await sessionHeaders('siti', 'password1');
    const current = await getAuth().api.getSession({ headers: mine });

    await changeOwnPassword(member, 'password1', 'newpassword1', current!.session.id);

    expect(await viewerFromHeaders(mine)).toEqual(member);
    expect(await viewerFromHeaders(other)).toBeNull();
    expect((await signIn('siti', 'password1', '1.1.1.1')).ok).toBe(false);
    expect(await signIn('siti', 'newpassword1', '1.1.1.1')).toEqual({ ok: true });
  });
});
