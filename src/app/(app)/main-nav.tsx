'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/components/cx';

export type NavItem = { href: string; label: string };

/** 'page' on the item's own page, 'true' on a page inside its section (an open transaction). */
function currentFor(pathname: string, href: string): 'page' | 'true' | undefined {
  if (pathname === href) return 'page';
  if (href !== '/' && pathname.startsWith(`${href}/`)) return 'true';
  return undefined;
}

// Top: a row in the header, styled like the quiet buttons beside it. Bottom: a bar fixed to the
// screen edge, every item a full-height tap target. The current item gets a square ink bar (under
// the label on top, along the top edge at the bottom), so it never depends on colour alone.
const look = {
  top: {
    nav: 'hidden items-center lg:flex',
    list: 'flex items-center',
    item: '',
    link: 'relative inline-flex min-h-11 items-center rounded-control px-3 font-medium whitespace-nowrap text-ink no-underline transition-state hover:bg-sunken hover:underline active:bg-sunken',
    current: 'after:absolute after:inset-x-3 after:bottom-1 after:h-0.75 after:bg-ink',
  },
  bottom: {
    nav: 'fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] lg:hidden',
    // 13px labels, so up to five items fit one row on any phone.
    list: 'flex overflow-x-auto',
    item: 'flex flex-auto',
    link: 'relative flex min-h-14 flex-auto items-center justify-center px-1 text-[0.8125rem] font-medium whitespace-nowrap text-muted no-underline transition-state hover:bg-sunken hover:text-ink active:bg-sunken',
    current: 'text-ink before:absolute before:inset-x-2 before:top-0 before:h-0.75 before:bg-ink',
  },
} as const;

// Six or seven items do not fit one row of a phone in both languages ("Transactions", "Pembantu"),
// so below 480px they go in two rows, each 44px tall: every item stays in view and one tap away,
// with no sideways scrolling. Six items make rows of three; seven make four and three.
// The current item's bar moves under its label there; on top it would sit on the row above's label.
const twoRowsList = {
  3: 'max-[30rem]:grid max-[30rem]:grid-cols-3',
  4: 'max-[30rem]:grid max-[30rem]:grid-cols-4',
} as const;
const twoRowsLink = 'max-[30rem]:min-h-11';
const twoRowsCurrent = 'max-[30rem]:before:top-auto max-[30rem]:before:bottom-1';

/**
 * The main destinations, as a top row on wide screens and a bottom bar on narrower ones. The
 * layout renders both and CSS shows one, so each sits where it is read: the row in the header,
 * the bar straight after it (before the page content), never covering it.
 */
export function MainNav({
  items,
  label,
  variant,
  twoRows = false,
}: {
  items: NavItem[];
  /** The landmark's name, in the viewer's language. */
  label: string;
  variant: 'top' | 'bottom';
  /** Bottom bar only: two rows on phones narrower than 480px. */
  twoRows?: boolean;
}) {
  const pathname = usePathname();
  const style = look[variant];
  const rows = variant === 'bottom' && twoRows;
  return (
    <nav
      aria-label={label}
      className={style.nav}
      data-bottom-nav={variant === 'bottom' ? (rows ? 'two-rows' : 'one-row') : undefined}
    >
      <ul className={cx(style.list, rows && twoRowsList[items.length > 6 ? 4 : 3])}>
        {items.map((item) => {
          const current = currentFor(pathname, item.href);
          return (
            <li key={item.href} className={style.item || undefined}>
              <Link
                href={item.href}
                aria-current={current}
                className={cx(style.link, rows && twoRowsLink, current && style.current, current && rows && twoRowsCurrent)}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
