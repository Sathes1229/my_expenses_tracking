'use server';

import { refresh } from 'next/cache';
import { getLocale } from '@/i18n/server';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { passwordError } from '@/lib/auth/accounts';
import { LOCALE_COOKIE } from '@/i18n/locale';
import { changeOwnPassword, setLocale, updateProfile } from '@/lib/auth/people';
import { beginLoginAttempt, clientIp, markLoginSucceeded } from '@/lib/auth/throttle';
import { getSessionState, requireViewer } from '@/lib/auth/viewer';
import { env } from '@/lib/env';
import { checkText, errorText, say, ValidationError } from '@/lib/errors';
import { formText, nextFormState, repeatError, waitText, type FormState } from '@/lib/form-state';

export async function updateNameAction(prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireViewer();
  const displayName = formText(formData, 'displayName');
  try {
    await updateProfile(viewer, { displayName });
  } catch (error) {
    if (error instanceof ValidationError) {
      return nextFormState(prev, { fieldErrors: { [error.field]: errorText(error, await getLocale()) }, values: { displayName } });
    }
    throw error;
  }
  // The header shows the name too.
  refresh();
  return nextFormState(prev, { done: true, values: { displayName: displayName.trim() } });
}

/**
 * Checking the current password is a password guess like a sign-in, so it is throttled the same
 * way, under a name no username can take (':' is not allowed): a stolen session cannot be used to
 * try passwords at full speed.
 */
export async function changePasswordAction(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  const viewer = await requireViewer();
  const state = await getSessionState();
  if (!state) redirect('/login');

  const current = formText(formData, 'current');
  const password = formText(formData, 'password');
  const confirm = formText(formData, 'confirm');
  const fieldErrors: Record<string, string> = {};
  if (!current) fieldErrors.current = say(locale, 'enterCurrentPassword');
  const passwordProblem = checkText(passwordError(password), locale);
  const repeatProblem = repeatError(password, confirm, locale);
  if (passwordProblem) fieldErrors.password = passwordProblem;
  else if (repeatProblem) fieldErrors.confirm = repeatProblem;
  if (Object.keys(fieldErrors).length > 0) return nextFormState(prev, { fieldErrors });

  const attempt = await beginLoginAttempt(`password-change:${viewer.id}`, clientIp(await headers()));
  if (!attempt.allowed) {
    return nextFormState(prev, {
      message: say(locale, 'tooManyPasswords', { wait: waitText(attempt.retryAfterSec, locale) }),
    });
  }
  try {
    await changeOwnPassword(viewer, current, password, state.sessionId);
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    // Only a wrong current password counts toward the lock.
    if (error.field !== 'current') await markLoginSucceeded(attempt.attemptIds);
    return nextFormState(prev, { fieldErrors: { [error.field]: errorText(error, await getLocale()) } });
  }
  await markLoginSucceeded(attempt.attemptIds);
  return nextFormState(prev, { done: true });
}

/**
 * Saves the language on the account (every device) and in a cookie, so the sign-in page keeps it
 * after signing out.
 */
export async function setLanguageAction(prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireViewer();
  const chosen = formText(formData, 'locale');
  try {
    await setLocale(viewer, chosen);
  } catch (error) {
    if (error instanceof ValidationError) return nextFormState(prev, { message: errorText(error, await getLocale()) });
    throw error;
  }
  (await cookies()).set(LOCALE_COOKIE, chosen, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: true,
    secure: env.APP_URL?.startsWith('https://') ?? false,
  });
  refresh();
  return nextFormState(prev, { done: true });
}
