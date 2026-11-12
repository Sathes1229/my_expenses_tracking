'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { displayNameError, passwordError, signIn, usernameError } from '@/lib/auth/accounts';
import { acceptInvite } from '@/lib/auth/invites';
import { clientIp } from '@/lib/auth/throttle';
import { getSessionState } from '@/lib/auth/viewer';
import { ValidationError } from '@/lib/errors';
import { formText, nextFormState, repeatError, type FormState } from '@/lib/form-state';

const REFUSED = {
  used: 'This invite was already used. Each link works once.',
  expired: 'This invite has expired. Ask the person who sent it for a new link.',
  revoked: 'This invite was cancelled. Ask the person who sent it for a new link.',
  unknown: 'This invite link does not work. Check that you copied the whole link.',
} as const;

/**
 * Creates the account an invite was made for, then signs the person in. The token comes in a
 * form field rather than a bound argument: development logging prints bound arguments.
 */
export async function acceptInviteAction(prev: FormState, formData: FormData): Promise<FormState> {
  // Someone signed in would otherwise make a second account without noticing.
  if (await getSessionState()) {
    return nextFormState(prev, { message: 'You are signed in. Sign out first, then open the invite link again.' });
  }

  const token = formText(formData, 'token');
  const displayName = formText(formData, 'displayName');
  const username = formText(formData, 'username');
  const password = formText(formData, 'password');
  const confirm = formText(formData, 'confirm');
  const values = { displayName, username };

  const fieldErrors: Record<string, string> = {};
  const checks: Array<[field: string, message: string | null]> = [
    ['displayName', displayNameError(displayName)],
    ['username', usernameError(username)],
    ['password', passwordError(password)],
    ['confirm', repeatError(password, confirm)],
  ];
  for (const [field, message] of checks) if (message) fieldErrors[field] = message;
  if (Object.keys(fieldErrors).length > 0) return nextFormState(prev, { fieldErrors, values });

  let result;
  try {
    result = await acceptInvite(token, { displayName, username, password });
  } catch (error) {
    if (error instanceof ValidationError) {
      return nextFormState(prev, { fieldErrors: { [error.field]: error.message }, values });
    }
    throw error;
  }
  if (!result.ok) return nextFormState(prev, { message: REFUSED[result.reason], values });

  const signedIn = await signIn(username, password, clientIp(await headers()));
  // The account exists either way; if sign-in is held back (too many attempts), they sign in later.
  redirect(signedIn.ok ? '/' : '/login');
}
