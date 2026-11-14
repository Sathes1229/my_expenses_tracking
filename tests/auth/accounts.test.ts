import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { POST } from '@/app/api/auth/[...all]/route';
import { db } from '@/db/client';
import { loginAttempts, user } from '@/db/schema';
import {
  createAccount,
  hasAnyUser,
  passwordError,
  replaceTemporaryPassword,
  signIn,
  usernameError,
} from '@/lib/auth/accounts';
import { getAuth } from '@/lib/auth/auth';
import { viewerFromHeaders } from '@/lib/auth/viewer';
import { ValidationError } from '@/lib/errors';
import { resetDb } from '../helpers/db';

beforeEach(resetDb);

/** Signs in through Better Auth directly and returns the Cookie header a browser would send. */
async function sessionCookie(username: string, password: string): Promise<string> {
  const res = await getAuth().api.signInUsername({ body: { username, password }, asResponse: true });
  const cookie = res.headers.getSetCookie().find((c) => c.includes('session_token='));
  if (!cookie) throw new Error('no session cookie');
  return cookie.split(';')[0];
}

describe('usernameError', () => {
  it('allows 3 to 30 characters from a-z 0-9 . _, compared lower-cased', () => {
    expect(usernameError('ab')).not.toBeNull();
    expect(usernameError('Siti.01')).toBeNull();
    expect(usernameError('abc')).toBeNull();
    expect(usernameError('a'.repeat(30))).toBeNull();
    expect(usernameError('a'.repeat(31))).not.toBeNull();
    expect(usernameError('siti-01')).not.toBeNull();
    expect(usernameError('siti 01')).not.toBeNull();
    expect(usernameError('')).not.toBeNull();
  });
});

describe('passwordError', () => {
  it('needs at least 8 characters', () => {
    expect(passwordError('short')).not.toBeNull();
    expect(passwordError('1234567')).not.toBeNull();
    expect(passwordError('12345678')).toBeNull();
  });
});

describe('createAccount', () => {
  it('refuses a username that differs only in case', async () => {
    expect(await hasAnyUser()).toBe(false);
    await createAccount({ username: 'Owner', displayName: 'O', password: 'password1', role: 'owner' });
    await expect(
      createAccount({ username: 'owner', displayName: 'X', password: 'password1', role: 'member' }),
    ).rejects.toThrow(ValidationError);
    expect(await hasAnyUser()).toBe(true);
  });

  it('stores the role, a lower-cased username and a placeholder email', async () => {
    const { id } = await createAccount({
      username: 'Siti.01',
      displayName: '  Siti  ',
      password: 'password1',
      role: 'member',
      mustChangePassword: true,
    });
    const row = db.select().from(user).where(eq(user.id, id)).get();
    expect(row).toMatchObject({
      username: 'siti.01',
      name: 'Siti',
      role: 'member',
      mustChangePassword: true,
      removedAt: null,
    });
    expect(row?.email).toMatch(/@users\.invalid$/);
  });

  it('rejects a bad username, password or display name', async () => {
    const ok = { username: 'siti', displayName: 'Siti', password: 'password1', role: 'member' } as const;
    await expect(createAccount({ ...ok, username: 'ab' })).rejects.toThrow(ValidationError);
    await expect(createAccount({ ...ok, password: 'short' })).rejects.toThrow(ValidationError);
    await expect(createAccount({ ...ok, displayName: '   ' })).rejects.toThrow(ValidationError);
    expect(await hasAnyUser()).toBe(false);
  });

  it('allows only one owner', async () => {
    await createAccount({ username: 'owner', displayName: 'O', password: 'password1', role: 'owner' });
    await expect(
      createAccount({ username: 'second', displayName: 'S', password: 'password1', role: 'owner' }),
    ).rejects.toThrow();
  });
});

describe('public sign-up', () => {
  const request = () =>
    new Request('http://localhost:3100/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3100' },
      body: JSON.stringify({ name: 'X', email: 'x@example.com', password: 'password1', username: 'intruder' }),
    });

  it('is refused by the route and by Better Auth itself', async () => {
    const viaRoute = await POST(request());
    expect(viaRoute.status).toBeGreaterThanOrEqual(400);
    const direct = await getAuth().handler(request());
    expect(direct.status).toBeGreaterThanOrEqual(400);
    expect(await hasAnyUser()).toBe(false);
  });

  it('cannot reach the unthrottled sign-in endpoints over HTTP', async () => {
    await createAccount({ username: 'siti', displayName: 'Siti', password: 'password1', role: 'member' });
    const res = await POST(
      new Request('http://localhost:3100/api/auth/sign-in/username', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3100' },
        body: JSON.stringify({ username: 'siti', password: 'password1' }),
      }),
    );
    expect(res.status).toBe(404);
  });
});

describe('signIn', () => {
  beforeEach(async () => {
    await createAccount({ username: 'siti', displayName: 'Siti', password: 'password1', role: 'member' });
  });

  it('accepts the right password, with the username in any case', async () => {
    expect(await signIn('Siti', 'password1', '1.1.1.1')).toEqual({ ok: true });
  });

  it('refuses a wrong password or unknown username the same way', async () => {
    expect(await signIn('siti', 'wrongpass', '1.1.1.1')).toEqual({ ok: false, reason: 'invalid' });
    expect(await signIn('nobody', 'password1', '1.1.1.1')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('locks after 5 failures, even for the right password, and says how long', async () => {
    for (let i = 0; i < 5; i++) await signIn('siti', 'wrongpass', '1.1.1.1');
    const result = await signIn('siti', 'password1', '1.1.1.1');
    expect(result).toMatchObject({ ok: false, reason: 'locked' });
    if (result.ok) throw new Error('unreachable');
    expect(result.retryAfterSec).toBeGreaterThan(0);
    expect(result.retryAfterSec).toBeLessThanOrEqual(15 * 60);
  });

  it('refuses a username that breaks the format the same way, without writing a throttle row', async () => {
    for (const username of ['x'.repeat(10_000), 'siti; drop', 'ab', 'Ṣiti']) {
      expect(await signIn(username, 'password1', '1.1.1.1')).toEqual({ ok: false, reason: 'invalid' });
    }
    expect(db.select().from(loginAttempts).all()).toHaveLength(0);
  });

  it('refuses a removed person', async () => {
    db.update(user).set({ removedAt: new Date() }).where(eq(user.username, 'siti')).run();
    expect(await signIn('siti', 'password1', '1.1.1.1')).toEqual({ ok: false, reason: 'invalid' });
  });

  // Password checks run off the event loop, so these requests overlap the way real ones do.
  it('holds the username limit when wrong passwords arrive at once', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => signIn('siti', 'wrongpass', `10.0.0.${i}`)),
    );
    expect(tally(results)).toEqual({ invalid: 5, locked: 5 });
  });

  it('holds the address limit when sign-ins for many usernames arrive at once', async () => {
    const results = await Promise.all(
      Array.from({ length: 25 }, (_, i) => signIn(`user${i}`, 'wrongpass', '10.9.9.9')),
    );
    expect(tally(results)).toEqual({ invalid: 20, locked: 5 });
  });

  it('does not count a successful sign-in toward the lock', async () => {
    for (let i = 0; i < 4; i++) await signIn('siti', 'wrongpass', '1.1.1.1');
    expect(await signIn('siti', 'password1', '1.1.1.1')).toEqual({ ok: true });
    expect(await signIn('siti', 'wrongpass', '1.1.1.1')).toEqual({ ok: false, reason: 'invalid' });
    expect(await signIn('siti', 'password1', '1.1.1.1')).toMatchObject({ ok: false, reason: 'locked' });
  });
});

function tally(results: Array<Awaited<ReturnType<typeof signIn>>>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of results) {
    const outcome = r.ok ? 'ok' : r.reason;
    counts[outcome] = (counts[outcome] ?? 0) + 1;
  }
  return counts;
}

describe('viewerFromHeaders', () => {
  it('returns null without a session', async () => {
    expect(await viewerFromHeaders(new Headers())).toBeNull();
    expect(await viewerFromHeaders(new Headers({ cookie: 'better-auth.session_token=forged' }))).toBeNull();
  });

  it('reads role, name and removal from the database on every call', async () => {
    const { id } = await createAccount({ username: 'siti', displayName: 'Siti', password: 'password1', role: 'member' });
    const headers = new Headers({ cookie: await sessionCookie('siti', 'password1') });

    expect(await viewerFromHeaders(headers)).toEqual({ id, role: 'member', displayName: 'Siti' });

    db.update(user).set({ role: 'guest', name: 'Siti A' }).where(eq(user.id, id)).run();
    expect(await viewerFromHeaders(headers)).toEqual({ id, role: 'guest', displayName: 'Siti A' });

    db.update(user).set({ removedAt: new Date() }).where(eq(user.id, id)).run();
    expect(await viewerFromHeaders(headers)).toBeNull();
  });
});

describe('replaceTemporaryPassword', () => {
  it('swaps the temporary password for a new one and clears the flag', async () => {
    const { id } = await createAccount({
      username: 'siti',
      displayName: 'Siti',
      password: 'temporary1',
      role: 'member',
      mustChangePassword: true,
    });
    await expect(replaceTemporaryPassword(id, 'temporary1')).rejects.toThrow(ValidationError);
    await expect(replaceTemporaryPassword(id, 'short')).rejects.toThrow(ValidationError);

    await replaceTemporaryPassword(id, 'myownpass1');
    expect(db.select().from(user).where(eq(user.id, id)).get()?.mustChangePassword).toBe(false);
    expect(await signIn('siti', 'myownpass1', '1.1.1.1')).toEqual({ ok: true });
    expect((await signIn('siti', 'temporary1', '1.1.1.1')).ok).toBe(false);
  });

  it('signs out every other session, which the temporary password could have opened', async () => {
    const { id } = await createAccount({
      username: 'siti',
      displayName: 'Siti',
      password: 'temporary1',
      role: 'member',
      mustChangePassword: true,
    });
    const mine = new Headers({ cookie: await sessionCookie('siti', 'temporary1') });
    const other = new Headers({ cookie: await sessionCookie('siti', 'temporary1') });
    const current = await getAuth().api.getSession({ headers: mine });

    await replaceTemporaryPassword(id, 'myownpass1', current!.session.id);

    expect(await viewerFromHeaders(other)).toBeNull();
    expect(await viewerFromHeaders(mine)).toEqual({ id, role: 'member', displayName: 'Siti' });
  });

  it('signs out every session when no current session is given', async () => {
    const { id } = await createAccount({
      username: 'siti',
      displayName: 'Siti',
      password: 'temporary1',
      role: 'member',
      mustChangePassword: true,
    });
    const headers = new Headers({ cookie: await sessionCookie('siti', 'temporary1') });
    await replaceTemporaryPassword(id, 'myownpass1');
    expect(await viewerFromHeaders(headers)).toBeNull();
  });
});
