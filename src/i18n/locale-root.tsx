import type { ReactNode } from 'react';
import { I18nProvider } from './client';
import { getLocale } from './server';

/** Reads the request's language once and hands it to the client components below. */
export async function LocaleRoot({ children }: { children: ReactNode }) {
  return <I18nProvider locale={await getLocale()}>{children}</I18nProvider>;
}
