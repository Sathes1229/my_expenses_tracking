import { formatRM } from '@/lib/money';
import { cx } from './cx';

/**
 * An amount in ringgit, from whole sen. Tabular figures so columns of amounts line up,
 * and never broken across lines. For a screen's focal amount add `text-focal font-semibold`.
 */
export function Money({ sen, className }: { sen: number; className?: string }) {
  return <span className={cx('tabular-nums whitespace-nowrap', className)}>{formatRM(sen)}</span>;
}
