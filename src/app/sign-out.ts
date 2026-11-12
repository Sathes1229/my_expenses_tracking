'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth/auth';

/** Ends this browser's session; nextCookies clears the cookie. */
export async function signOut(): Promise<void> {
  await getAuth().api.signOut({ headers: await headers() });
  redirect('/login');
}
