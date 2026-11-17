'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { Locale } from './locale';
import { messages, type Messages } from './messages';

const LocaleContext = createContext<Locale>('en');

/**
 * Gives client components the request's language. Only the locale crosses from the server; both
 * catalogs are small and ship with the client code. The root layout cannot read the request, so
 * <html lang> starts as "en" and is corrected here.
 */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useMessages(): Messages {
  return messages[useLocale()];
}
