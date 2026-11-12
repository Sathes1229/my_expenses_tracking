import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { username } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { account, session, user, verification } from '@/db/schema';
import { authEnv } from '@/lib/env';

function createAuth() {
  const { secret, appUrl } = authEnv();
  return betterAuth({
    secret,
    baseURL: appUrl,
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      // Accounts come only from createAccount (src/lib/auth/accounts.ts), never from a sign-up request.
      disableSignUp: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    user: {
      additionalFields: {
        role: { type: ['owner', 'member', 'guest'], required: true, input: false },
        mustChangePassword: { type: 'boolean', required: true, defaultValue: false, input: false },
        removedAt: { type: 'date', required: false, input: false },
      },
    },
    session: {
      // Off (the default), stated here because getViewer depends on it: a cached session payload
      // would let a role change or removal wait until the cache expired.
      cookieCache: { enabled: false },
    },
    databaseHooks: {
      session: {
        create: {
          // A removed person cannot start a session, whichever endpoint is used.
          async before(newSession) {
            const row = db
              .select({ removedAt: user.removedAt })
              .from(user)
              .where(eq(user.id, newSession.userId))
              .get();
            if (!row || row.removedAt) return false;
          },
        },
      },
    },
    telemetry: { enabled: false },
    // Every wrong password would log a warning; failures are already counted by the throttle.
    logger: { level: 'error' },
    // nextCookies must stay last: it copies Set-Cookie from auth.api calls in server actions.
    plugins: [username({ minUsernameLength: 3, maxUsernameLength: 30, displayUsername: false }), nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;
let instance: Auth | undefined;

/** The Better Auth instance, created on first use so a missing secret fails with a clear message. */
export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}
