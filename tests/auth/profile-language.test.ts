import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { user } from '@/db/schema';
import { createAccount } from '@/lib/auth/accounts';
import { setLocale } from '@/lib/auth/people';
import { stateFromHeaders, type Viewer } from '@/lib/auth/viewer';
import { ValidationError } from '@/lib/errors';
import { resetDb } from '../helpers/db';
import { sessionHeaders } from '../helpers/session';

let member: Viewer;

beforeEach(async () => {
  await resetDb();
  const m = await createAccount({ username: 'siti', displayName: 'Siti', password: 'password1', role: 'member' });
  member = { id: m.id, role: 'member', displayName: 'Siti' };
});

const saved = () => db.select({ locale: user.locale }).from(user).where(eq(user.id, member.id)).get()?.locale;

describe('setLocale', () => {
  it('saves the chosen language on the account', async () => {
    await setLocale(member, 'ms');
    expect(saved()).toBe('ms');
  });

  it('refuses a language the app does not have and saves nothing', async () => {
    await expect(setLocale(member, 'xx')).rejects.toThrow(ValidationError);
    expect(saved()).toBeNull();
  });

  it('is part of the session state, null until chosen', async () => {
    const headers = await sessionHeaders('siti', 'password1');
    expect((await stateFromHeaders(headers))?.locale).toBeNull();
    await setLocale(member, 'ms');
    expect((await stateFromHeaders(headers))?.locale).toBe('ms');
  });
});
