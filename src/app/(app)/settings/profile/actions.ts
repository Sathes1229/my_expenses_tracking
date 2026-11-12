'use server';

import { refresh } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { passwordError } from '@/lib/auth/accounts';
import { changeOwnPassword, updateProfile } from '@/lib/auth/people';
import { beginLoginAttempt, clientIp, markLoginSucceeded } from '@/lib/auth/throttle';
import { getSessionState, requireViewer } from '@/lib/auth/viewer';
import { ValidationError } from '@/lib/errors';
import { formText, nextFormState, repeatError, waitText, type FormState } from '@/lib/form-state';

export async function updateNameAction(prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireViewer();
  const displayName = formText(formData, 'displayName');
  try {
    await updateProfile(viewer, { displayName });
  } catch (error) {
    if (error instanceof ValidationError) {
      return nextFormState(prev, { fieldErrors: { [error.field]: error.message }, values: { displayName } });
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
  const viewer = await requireViewer();
  const state = await getSessionState();
  if (!state) redirect('/login');

  const current = formText(formData, 'current');
  const password = formText(formData, 'password');
  const confirm = formText(formData, 'confirm');
  const fieldErrors: Record<string, string> = {};
  if (!current) fieldErrors.current = 'Enter your current password.';
  const passwordProblem = passwordError(password);
  const repeatProblem = repeatError(password, confirm);
  if (passwordProblem) fieldErrors.password = passwordProblem;
  else if (repeatProblem) fieldErrors.confirm = repeatProblem;
  if (Object.keys(fieldErrors).length > 0) return nextFormState(prev, { fieldErrors });

  const attempt = await beginLoginAttempt(`password-change:${viewer.id}`, clientIp(await headers()));
  if (!attempt.allowed) {
    return nextFormState(prev, {
      message: `Too many wrong passwords. Try again in ${waitText(attempt.retryAfterSec)}.`,
    });
  }
  try {
    await changeOwnPassword(viewer, current, password, state.sessionId);
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    // Only a wrong current password counts toward the lock.
    if (error.field !== 'current') await markLoginSucceeded(attempt.attemptIds);
    return nextFormState(prev, { fieldErrors: { [error.field]: error.message } });
  }
  await markLoginSucceeded(attempt.attemptIds);
  return nextFormState(prev, { done: true });
}
