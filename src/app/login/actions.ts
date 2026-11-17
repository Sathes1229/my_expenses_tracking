'use server';

import { headers } from 'next/headers';
import { getLocale } from '@/i18n/server';
import { redirect } from 'next/navigation';
import { signIn } from '@/lib/auth/accounts';
import { clientIp } from '@/lib/auth/throttle';
import { formText, nextFormState, waitText, type FormState } from '@/lib/form-state';
import { say } from '@/lib/errors';

export async function signInAction(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  const username = formText(formData, 'username');
  const password = formText(formData, 'password');
  const values = { username };

  const fieldErrors: Record<string, string> = {};
  if (!username.trim()) fieldErrors.username = say(locale, 'enterYourUsername');
  if (!password) fieldErrors.password = say(locale, 'enterYourPassword');
  if (Object.keys(fieldErrors).length > 0) return nextFormState(prev, { fieldErrors, values });

  const result = await signIn(username, password, clientIp(await headers()));
  if (result.ok) redirect('/');
  if (result.reason === 'locked') {
    return nextFormState(prev, {
      message: say(locale, 'tooManySignIns', { wait: waitText(result.retryAfterSec ?? 900, locale) }),
      values,
    });
  }
  return nextFormState(prev, { message: say(locale, 'wrongLogin'), values });
}
