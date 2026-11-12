import { getAuth } from '@/lib/auth/auth';

/** Signs in through Better Auth directly and returns the Cookie header a browser would send. */
export async function sessionCookie(username: string, password: string): Promise<string> {
  const res = await getAuth().api.signInUsername({ body: { username, password }, asResponse: true });
  const cookie = res.headers.getSetCookie().find((c) => c.includes('session_token='));
  if (!cookie) throw new Error('no session cookie');
  return cookie.split(';')[0];
}

/** Request headers carrying a fresh session for this person. */
export async function sessionHeaders(username: string, password: string): Promise<Headers> {
  return new Headers({ cookie: await sessionCookie(username, password) });
}
