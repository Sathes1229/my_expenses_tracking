// Shared by the root layout (server) and ThemeToggle (client), so it must stay a plain
// module: a value exported from a 'use client' file reaches the server only as a reference.

export type Theme = 'light' | 'dark';

/** localStorage key for an explicit theme choice. No value means "follow the device". */
export const THEME_KEY = 'theme';

/** Runs in <head> before first paint, so a stored choice never flashes the other theme. */
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export function readStoredTheme(): Theme | null {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}
