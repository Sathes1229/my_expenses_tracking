// Which language a request gets. Plain module: the client provider and the server both import it.

export const LOCALES = ['en', 'ms'] as const;
export type Locale = (typeof LOCALES)[number];

/** Holds the language for signed-out pages, set when someone saves a language in Profile. */
export const LOCALE_COOKIE = 'lang';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * The best language the app has for an Accept-Language header: the highest-weighted range the app
 * supports ('ms-MY' counts as 'ms'), in header order on a tie. English when nothing matches.
 */
export function matchLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return 'en';
  const ranges = acceptLanguage
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const quality = q === undefined ? 1 : Number(q.slice(2));
      return { language: tag.trim().toLowerCase().split('-')[0], quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter((range) => range.language && range.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  return ranges.map((range) => range.language).find(isLocale) ?? 'en';
}

/** A saved choice first, then the cookie, then the browser's languages. */
export function resolveLocale(input: { saved: Locale | null; cookie: string | undefined; acceptLanguage: string | null }): Locale {
  if (input.saved) return input.saved;
  if (isLocale(input.cookie)) return input.cookie;
  return matchLocale(input.acceptLanguage);
}
