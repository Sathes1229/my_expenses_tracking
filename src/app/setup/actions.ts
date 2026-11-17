'use server';

import { headers } from 'next/headers';
import { getLocale } from '@/i18n/server';
import { redirect } from 'next/navigation';
import {
  createAccount,
  displayNameError,
  hasAnyUser,
  passwordError,
  signIn,
  usernameError,
} from '@/lib/auth/accounts';
import { clientIp } from '@/lib/auth/throttle';
import { checkText, errorText, ValidationError } from '@/lib/errors';
import { formText, nextFormState, repeatError, type FormState } from '@/lib/form-state';

/** Creates the owner, but only while nobody exists yet, then signs them in. */
export async function createOwnerAction(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  if (await hasAnyUser()) redirect('/login');

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

  try {
    await createAccount({ username, displayName, password, role: 'owner' });
  } catch (error) {
    if (error instanceof ValidationError) {
      return nextFormState(prev, { fieldErrors: { [error.field]: errorText(error, await getLocale()) }, values });
    }
    // Another submission created the owner first; the database refused a second one.
    if (await hasAnyUser()) redirect('/login');
    throw error;
  }

  await signIn(username, password, clientIp(await headers()));
  redirect('/');
}
