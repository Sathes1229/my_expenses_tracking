'use client';

import { useLayoutEffect } from 'react';
import { readStoredTheme } from './theme-script';

/**
 * Rendered once from the root layout. The head script applies a stored theme before paint, but
 * React's development remount clears data-theme from <html>; this puts it back on every page,
 * signed in or not. No-op in production.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    const stored = readStoredTheme();
    if (stored) document.documentElement.dataset.theme = stored;
  }, []);
  return null;
}
