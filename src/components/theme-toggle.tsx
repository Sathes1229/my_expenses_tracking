'use client';

import { Button } from './button';
import { THEME_KEY, type Theme } from './theme-script';

/**
 * Switches between light and dark and remembers the choice on this device. Until someone
 * chooses, the device setting decides. The label names the theme the button switches to;
 * CSS picks it from the theme in effect, so the server and the browser render the same markup.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const current: Theme =
      root.dataset.theme === 'dark' || root.dataset.theme === 'light'
        ? root.dataset.theme
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage blocked (private mode): the switch still applies for this visit.
    }
  }

  return (
    <Button variant="quiet" onClick={toggle}>
      <span className="dark:hidden">Dark theme</span>
      <span className="hidden dark:inline">Light theme</span>
    </Button>
  );
}
