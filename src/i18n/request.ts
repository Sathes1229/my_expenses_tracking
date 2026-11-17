import { LOCALE_COOKIE, resolveLocale, type Locale } from './locale';

/**
 * A route handler's language, read from the Request it was given (route handlers do not use
 * next/headers, so they also run in tests): the saved choice, then the cookie, then the browser.
 */
export function localeFromRequest(request: Request, saved: Locale | null): Locale {
  const cookie = (request.headers.get('cookie') ?? '')
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === LOCALE_COOKIE)?.[1];
  return resolveLocale({ saved, cookie, acceptLanguage: request.headers.get('accept-language') });
}
