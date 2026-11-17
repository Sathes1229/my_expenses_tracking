import type { Locale } from '@/i18n/locale';
import { say } from './errors';
import { formText } from './form-state';
import { parseRM } from './money';
import { isStarterKey } from './starter-keys';

export type StarterPick = { name: string; allocationSen: number };

/**
 * Reads the starter form: `pick` once per ticked row, then `name_<key>` and `amount_<key>`. Rows
 * not ticked are ignored, whatever they hold. A ticked row needs an amount; nothing ticked is a
 * message under `pick`. Messages are in the viewer's language.
 */
export function parseStarterForm(
  formData: FormData,
  locale: Locale,
): { ok: true; picks: StarterPick[] } | { ok: false; errors: Record<string, string> } {
  const keys = [...new Set(formData.getAll('pick').filter((v): v is string => typeof v === 'string'))].filter(isStarterKey);
  if (keys.length === 0) return { ok: false, errors: { pick: say(locale, 'starterNoneChosen') } };

  const picks: StarterPick[] = [];
  const errors: Record<string, string> = {};
  for (const key of keys) {
    const amountText = formText(formData, `amount_${key}`).trim();
    const allocationSen = amountText ? parseRM(amountText) : null;
    if (allocationSen === null) {
      errors[`amount_${key}`] = say(locale, amountText ? 'budgetAmountFormat' : 'enterMonthlyAmount');
      continue;
    }
    picks.push({ name: formText(formData, `name_${key}`), allocationSen });
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, picks };
}
