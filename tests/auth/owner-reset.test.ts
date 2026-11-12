import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { session, settings } from '@/db/schema';
import { createAccount, signIn } from '@/lib/auth/accounts';
import { getAuth } from '@/lib/auth/auth';
import { resetOwnerPassword } from '@/lib/auth/owner-reset';
import { viewerFromHeaders } from '@/lib/auth/viewer';
import { env } from '@/lib/env';
import { ValidationError } from '@/lib/errors';
import { resetDb } from '../helpers/db';

let ownerId: string;

beforeEach(async () => {
  await resetDb();
  env.OWNER_RESET_TOKEN = undefined;
  ({ id: ownerId } = await createAccount({
    username: 'owner',
    displayName: 'Owner',
    password: 'password1',
    role: 'owner',
  }));
});

afterAll(() => {
  env.OWNER_RESET_TOKEN = undefined;
});

describe('resetOwnerPassword', () => {
  it('is disabled while OWNER_RESET_TOKEN is unset', async () => {
    expect(await resetOwnerPassword('x', 'newpassword1')).toBe('disabled');
  });

  it('works once per token', async () => {
    env.OWNER_RESET_TOKEN = 'abc123';
    expect(await resetOwnerPassword('wrong', 'newpassword1')).toBe('invalid');
    expect(await resetOwnerPassword('abc123', 'newpassword1')).toBe('ok');
    expect(await resetOwnerPassword('abc123', 'another12')).toBe('used');

    expect(await signIn('owner', 'newpassword1', '1.1.1.1')).toEqual({ ok: true });
    expect((await signIn('owner', 'another12', '1.1.1.1')).ok).toBe(false);
  });

  it('stores a hash of the used token, never the token', async () => {
    env.OWNER_RESET_TOKEN = 'abc123';
    await resetOwnerPassword('abc123', 'newpassword1');
    const rows = db.select().from(settings).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].value).not.toContain('abc123');
  });

  it('accepts a new token after the old one was used', async () => {
    env.OWNER_RESET_TOKEN = 'abc123';
    expect(await resetOwnerPassword('abc123', 'newpassword1')).toBe('ok');
    env.OWNER_RESET_TOKEN = 'def456';
    expect(await resetOwnerPassword('def456', 'another12')).toBe('ok');
  });

  it('signs out every owner session', async () => {
    const res = await getAuth().api.signInUsername({
      body: { username: 'owner', password: 'password1' },
      asResponse: true,
    });
    const cookie = res.headers.getSetCookie().find((c) => c.includes('session_token='))!.split(';')[0];
    const headers = new Headers({ cookie });
    expect(await viewerFromHeaders(headers)).not.toBeNull();

    env.OWNER_RESET_TOKEN = 'abc123';
    expect(await resetOwnerPassword('abc123', 'newpassword1')).toBe('ok');

    expect(await viewerFromHeaders(headers)).toBeNull();
    expect(db.select().from(session).where(eq(session.userId, ownerId)).all()).toEqual([]);
  });

  it('rejects a short new password without using up the token', async () => {
    env.OWNER_RESET_TOKEN = 'abc123';
    await expect(resetOwnerPassword('abc123', 'short')).rejects.toThrow(ValidationError);
    expect(await resetOwnerPassword('abc123', 'newpassword1')).toBe('ok');
  });
});
