import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { invites, user } from '@/db/schema';
import { createAccount, signIn } from '@/lib/auth/accounts';
import {
  acceptInvite,
  createInvite,
  inviteLink,
  inviteStatus,
  listInvites,
  revokeInvite,
} from '@/lib/auth/invites';
import type { Viewer } from '@/lib/auth/viewer';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { resetDb } from '../helpers/db';

let owner: Viewer;
let member: Viewer;
let guest: Viewer;

const newcomer = { displayName: 'Aina', username: 'aina', password: 'password1' };

beforeEach(async () => {
  await resetDb();
  const o = await createAccount({ username: 'owner', displayName: 'Owner', password: 'password1', role: 'owner' });
  const m = await createAccount({ username: 'siti', displayName: 'Siti', password: 'password1', role: 'member' });
  const g = await createAccount({ username: 'ali', displayName: 'Ali', password: 'password1', role: 'guest' });
  owner = { id: o.id, role: 'owner', displayName: 'Owner' };
  member = { id: m.id, role: 'member', displayName: 'Siti' };
  guest = { id: g.id, role: 'guest', displayName: 'Ali' };
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createInvite', () => {
  it('returns a long random token and stores only its hash', async () => {
    const { id, token } = await createInvite(owner, 'guest');
    expect(token).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    const row = db.select().from(invites).where(eq(invites.id, id)).get();
    expect(row).toMatchObject({ role: 'guest', createdBy: owner.id, usedAt: null, revokedAt: null });
    expect(row?.tokenHash).not.toBe(token);
    expect(JSON.stringify(db.select().from(invites).all())).not.toContain(token);
  });

  it('expires 7 days after it is created', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-12T10:00:00Z'));
    const { id } = await createInvite(owner, 'member');
    const row = db.select().from(invites).where(eq(invites.id, id)).get();
    expect(row?.expiresAt).toBe(Date.parse('2026-11-19T10:00:00Z'));
  });

  it('gives a different token every time', async () => {
    const a = await createInvite(owner, 'guest');
    const b = await createInvite(owner, 'guest');
    expect(a.token).not.toBe(b.token);
  });

  it('is for the owner only', async () => {
    await expect(createInvite(member, 'guest')).rejects.toThrow(ForbiddenError);
    await expect(createInvite(guest, 'guest')).rejects.toThrow(ForbiddenError);
    expect(db.select().from(invites).all()).toHaveLength(0);
  });

  it('only invites members and guests', async () => {
    await expect(createInvite(owner, 'owner' as 'member')).rejects.toThrow(ValidationError);
    await expect(createInvite(owner, 'admin' as 'member')).rejects.toThrow(ValidationError);
  });
});

describe('inviteLink', () => {
  it('builds the address from APP_URL', () => {
    expect(inviteLink('abc')).toBe('http://localhost:3100/invite/abc');
  });
});

describe('inviteStatus', () => {
  it('is valid for a fresh invite and tells its role', async () => {
    const { token } = await createInvite(owner, 'guest');
    expect(await inviteStatus(token)).toEqual({ status: 'valid', role: 'guest' });
  });

  it('is unknown for a token nobody created', async () => {
    expect(await inviteStatus('not-a-real-token')).toEqual({ status: 'unknown' });
    expect(await inviteStatus('')).toEqual({ status: 'unknown' });
  });

  it('is expired after 7 days', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-12T10:00:00Z'));
    const { token } = await createInvite(owner, 'guest');

    vi.setSystemTime(new Date('2026-11-19T09:59:59Z'));
    expect((await inviteStatus(token)).status).toBe('valid');
    vi.setSystemTime(new Date('2026-11-19T10:00:00Z'));
    expect(await inviteStatus(token)).toEqual({ status: 'expired' });
  });

  it('is revoked once the owner revokes it', async () => {
    const { id, token } = await createInvite(owner, 'member');
    await revokeInvite(owner, id);
    expect(await inviteStatus(token)).toEqual({ status: 'revoked' });
  });
});

describe('acceptInvite', () => {
  it('creates an account with the invite role, which can sign in', async () => {
    const { id, token } = await createInvite(owner, 'guest');
    expect(await acceptInvite(token, { ...newcomer, displayName: '  Aina  ' })).toEqual({ ok: true });

    const created = db.select().from(user).where(eq(user.username, 'aina')).get();
    expect(created).toMatchObject({ name: 'Aina', role: 'guest', mustChangePassword: false });
    const row = db.select().from(invites).where(eq(invites.id, id)).get();
    expect(row?.usedBy).toBe(created?.id);
    expect(row?.usedAt).toEqual(expect.any(Number));
    expect(await signIn('aina', 'password1', '1.1.1.1')).toEqual({ ok: true });
  });

  it('works once', async () => {
    const { token } = await createInvite(owner, 'guest');
    expect(await acceptInvite(token, newcomer)).toEqual({ ok: true });
    expect(await acceptInvite(token, { ...newcomer, username: 'other' })).toEqual({ ok: false, reason: 'used' });
    expect(await inviteStatus(token)).toEqual({ status: 'used' });
    expect(db.select().from(user).where(eq(user.username, 'other')).get()).toBeUndefined();
  });

  // Review Focus 5: two people open the same link.
  it('lets only one of two people who open the same link at once create an account', async () => {
    const { token } = await createInvite(owner, 'guest');
    expect((await inviteStatus(token)).status).toBe('valid');
    const [a, b] = await Promise.all([
      acceptInvite(token, { displayName: 'A', username: 'aaa', password: 'password1' }),
      acceptInvite(token, { displayName: 'B', username: 'bbb', password: 'password1' }),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect([a, b]).toContainEqual({ ok: false, reason: 'used' });
    expect((await inviteStatus(token)).status).toBe('used');
    const joined = db.select({ username: user.username }).from(user).all().map((u) => u.username);
    expect(joined.filter((u) => u === 'aaa' || u === 'bbb')).toHaveLength(1);
  });

  it('refuses an expired invite', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-12T10:00:00Z'));
    const { token } = await createInvite(owner, 'guest');
    vi.setSystemTime(new Date('2026-11-19T10:00:01Z'));
    expect(await acceptInvite(token, newcomer)).toEqual({ ok: false, reason: 'expired' });
    expect(db.select().from(user).where(eq(user.username, 'aina')).get()).toBeUndefined();
  });

  it('refuses a revoked invite and an unknown token', async () => {
    const { id, token } = await createInvite(owner, 'member');
    await revokeInvite(owner, id);
    expect(await acceptInvite(token, newcomer)).toEqual({ ok: false, reason: 'revoked' });
    expect(await acceptInvite('made-up-token', newcomer)).toEqual({ ok: false, reason: 'unknown' });
    expect(db.select().from(user).where(eq(user.username, 'aina')).get()).toBeUndefined();
  });

  it('keeps the invite usable when the username is taken', async () => {
    const { token } = await createInvite(owner, 'guest');
    await expect(acceptInvite(token, { ...newcomer, username: 'Siti' })).rejects.toThrow(ValidationError);
    expect(await inviteStatus(token)).toEqual({ status: 'valid', role: 'guest' });
    expect(await acceptInvite(token, newcomer)).toEqual({ ok: true });
  });

  it('checks the name, username and password before using the invite', async () => {
    const { token } = await createInvite(owner, 'guest');
    await expect(acceptInvite(token, { ...newcomer, displayName: ' ' })).rejects.toThrow(ValidationError);
    await expect(acceptInvite(token, { ...newcomer, displayName: 'x'.repeat(41) })).rejects.toThrow(ValidationError);
    await expect(acceptInvite(token, { ...newcomer, username: 'a b' })).rejects.toThrow(ValidationError);
    await expect(acceptInvite(token, { ...newcomer, password: 'short' })).rejects.toThrow(ValidationError);
    expect((await inviteStatus(token)).status).toBe('valid');
  });
});

describe('listInvites', () => {
  it('shows each invite with its status, newest first', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-01T10:00:00Z'));
    await createInvite(owner, 'member'); // expires on the 8th
    vi.setSystemTime(new Date('2026-11-12T10:00:00Z'));
    const used = await createInvite(owner, 'guest');
    vi.setSystemTime(new Date('2026-11-12T10:01:00Z'));
    const revoked = await createInvite(owner, 'member');
    vi.setSystemTime(new Date('2026-11-12T10:02:00Z'));
    const open = await createInvite(owner, 'guest');
    await acceptInvite(used.token, newcomer);
    await revokeInvite(owner, revoked.id);

    const list = await listInvites(owner);
    expect(list.map((i) => [i.role, i.status])).toEqual([
      ['guest', 'open'],
      ['member', 'revoked'],
      ['guest', 'used'],
      ['member', 'expired'],
    ]);
    expect(list[0]).toEqual({
      id: open.id,
      role: 'guest',
      createdAt: Date.parse('2026-11-12T10:02:00Z'),
      expiresAt: Date.parse('2026-11-19T10:02:00Z'),
      status: 'open',
    });
    expect(JSON.stringify(list)).not.toContain(open.token);
  });

  it('is for the owner only', async () => {
    await expect(listInvites(member)).rejects.toThrow(ForbiddenError);
  });
});

describe('revokeInvite', () => {
  it('is for the owner only', async () => {
    const { id, token } = await createInvite(owner, 'guest');
    await expect(revokeInvite(member, id)).rejects.toThrow(ForbiddenError);
    expect((await inviteStatus(token)).status).toBe('valid');
  });

  it('cannot take back an invite that was already used', async () => {
    const { id, token } = await createInvite(owner, 'guest');
    await acceptInvite(token, newcomer);
    await expect(revokeInvite(owner, id)).rejects.toThrow(ValidationError);
    expect((await inviteStatus(token)).status).toBe('used');
  });

  it('refuses an invite that does not exist', async () => {
    await expect(revokeInvite(owner, 'no-such-id')).rejects.toThrow(ValidationError);
  });
});
