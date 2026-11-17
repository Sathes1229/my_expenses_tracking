import { describe, expect, it } from 'vitest';
import { isLocale, matchLocale, resolveLocale } from '@/i18n/locale';

describe('matchLocale', () => {
  it('picks Malay when the browser prefers it', () => {
    expect(matchLocale('ms-MY,ms;q=0.9,en;q=0.8')).toBe('ms');
  });

  it('skips languages the app does not have and takes the first one it does', () => {
    expect(matchLocale('zh-CN,ms;q=0.5')).toBe('ms');
  });

  it('picks English for English and for languages the app does not have', () => {
    expect(matchLocale('en-US')).toBe('en');
    expect(matchLocale('fr-FR')).toBe('en');
  });

  it('falls back to English for an empty, missing or malformed header', () => {
    expect(matchLocale('')).toBe('en');
    expect(matchLocale(null)).toBe('en');
    expect(matchLocale(';;q=abc')).toBe('en');
  });

  it('follows the q-values, not only the order', () => {
    expect(matchLocale('en;q=0.4,ms;q=0.8')).toBe('ms');
  });
});

describe('resolveLocale', () => {
  it('uses the saved choice first', () => {
    expect(resolveLocale({ saved: 'ms', cookie: 'en', acceptLanguage: 'en-US' })).toBe('ms');
  });

  it('uses the cookie when nothing is saved', () => {
    expect(resolveLocale({ saved: null, cookie: 'ms', acceptLanguage: 'en-US' })).toBe('ms');
  });

  it('ignores a cookie that is not a language the app has', () => {
    expect(resolveLocale({ saved: null, cookie: 'xx', acceptLanguage: 'ms-MY' })).toBe('ms');
    expect(resolveLocale({ saved: null, cookie: undefined, acceptLanguage: null })).toBe('en');
  });
});

describe('isLocale', () => {
  it('accepts only en and ms', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('ms')).toBe(true);
    expect(isLocale('ms-MY')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe('localeFromRequest', () => {
  const request = (headers: Record<string, string>) => new Request('http://localhost/api/x', { headers });

  it('reads the lang cookie, then the browser languages', async () => {
    const { localeFromRequest } = await import('@/i18n/request');
    expect(localeFromRequest(request({ cookie: 'a=1; lang=ms; b=2', 'accept-language': 'en-US' }), null)).toBe('ms');
    expect(localeFromRequest(request({ 'accept-language': 'ms-MY' }), null)).toBe('ms');
    expect(localeFromRequest(request({}), null)).toBe('en');
  });

  it('puts the saved choice first', async () => {
    const { localeFromRequest } = await import('@/i18n/request');
    expect(localeFromRequest(request({ cookie: 'lang=en' }), 'ms')).toBe('ms');
  });
});
