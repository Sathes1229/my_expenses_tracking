'use server';

import { headers } from 'next/headers';
import { getLocale } from '@/i18n/server';
import { redirect } from 'next/navigation';
import { displayNameError, passwordError, signIn, usernameError } from '@/lib/auth/accounts';
import { acceptInvite } from '@/lib/auth/invites';
import { clientIp } from '@/lib/auth/throttle';
import { getSessionState } from '@/lib/auth/viewer';
import { checkText, type ErrorKey, errorText, say, ValidationError } from '@/lib/errors';
import { formText, nextFormState, repeatError, type FormState } from '@/lib/form-state';

const REFUSED = {
  used: 'inviteUsed',
  expired: 'inviteExpired',
  revoked: 'inviteRevoked',
  unknown: 'inviteInvalid',
} as const satisfies Record<string, ErrorKey>;

/**
 * Creates the account an invite was made for, then signs the person in. The token comes in a
 * form field rather than a bound argument: development logging prints bound arguments.
 */
export async function acceptInviteAction(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  // Someone signed in would otherwise make a second account without noticing.
  if (await getSessionState()) {
    return nextFormState(prev, { message: say(locale, 'signedInSignOutFirst') });
  }

  const token = formText(formData, 'token');
  const displayName = formText(formData, 'displayName');
  const username = formText(formData, 'username');
  const password = formText(formData, 'password');
  const confirm = formText(formData, 'confirm');
  const values = { displayName, username };

  const fieldErrors: Record<string, string> = {};
  const checks: Array<[field: string, message: string | null]> = [
    ['displayName', checkText(displayNameError(displayName), locale)],
    ['username', checkText(usernameError(username), locale)],
    ['password', checkText(passwordError(password), locale)],
    ['confirm', repeatError(password, confirm, locale)],
  ];
  for (const [field, message] of checks) if (message) fieldErrors[field] = message;
  if (Object.keys(fieldErrors).length > 0) return nextFormState(prev, { fieldErrors, values });

  let result;
  try {
    result = await acceptInvite(token, { displayName, username, password });
  } catch (error) {
    if (error instanceof ValidationError) {
      return nextFormState(prev, { fieldErrors: { [error.field]: errorText(error, await getLocale()) }, values });
    }
    throw error;
  }
  if (!result.ok) return nextFormState(prev, { message: say(locale, REFUSED[result.reason]), values });

  const signedIn = await signIn(username, password, clientIp(await headers()));
  // The account exists either way; if sign-in is held back (too many attempts), they sign in later.
  redirect(signedIn.ok ? '/' : '/login');
}
