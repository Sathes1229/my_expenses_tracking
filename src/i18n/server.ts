import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { getSessionState } from '@/lib/auth/viewer';
import { LOCALE_COOKIE, resolveLocale, type Locale } from './locale';
import { messages, type Messages } from './messages';

/** The request's language: the person's saved choice, then the cookie, then the browser. */
export const getLocale = cache(async (): Promise<Locale> => {
  const [state, cookieStore, headerList] = await Promise.all([getSessionState(), cookies(), headers()]);
  return resolveLocale({
    saved: state?.locale ?? null,
    cookie: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerList.get('accept-language'),
  });
});

export async function getMessages(): Promise<Messages> {
  return messages[await getLocale()];
}
