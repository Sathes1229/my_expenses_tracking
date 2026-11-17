import { fmtNodes } from '@/i18n/format-nodes';
import { formatRM } from '@/lib/money';
import { cx } from './cx';

/**
 * An amount in ringgit, from whole sen. Tabular figures so columns of amounts line up,
 * and never broken across lines. For a screen's focal amount add `text-focal font-semibold`.
 */
export function Money({ sen, className }: { sen: number; className?: string }) {
  return <span className={cx('tabular-nums whitespace-nowrap', className)}>{formatRM(sen)}</span>;
}

/**
 * A sentence from the message catalog with amounts in it, each written as <Money>:
 * text "{spent} spent of {allocation}" with amounts { spent: 4000, allocation: 10000 }.
 */
export function MoneySentence({ text, amounts }: { text: string; amounts: Record<string, number> }) {
  const parts = Object.fromEntries(Object.entries(amounts).map(([name, sen]) => [name, <Money key={name} sen={sen} />]));
  return <>{fmtNodes(text, parts)}</>;
}
