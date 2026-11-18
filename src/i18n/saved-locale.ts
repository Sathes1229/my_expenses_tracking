import type { Locale } from './locale';

/**
 * The language a person saved, read from their session. A failed session read gives null here, so
 * the root layout (which no error boundary covers) still renders; the page's own session check
 * meets the same error inside its boundary and shows the app's error page.
 */
export async function savedLocaleOf(read: () => Promise<{ locale: Locale | null } | null>): Promise<Locale | null> {
  try {
    return (await read())?.locale ?? null;
  } catch {
    return null;
  }
}
