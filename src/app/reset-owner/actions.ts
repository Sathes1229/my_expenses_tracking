'use server';

import { headers } from 'next/headers';
import { passwordError } from '@/lib/auth/accounts';
import { resetOwnerPassword } from '@/lib/auth/owner-reset';
import { beginLoginAttempt, clientIp, markLoginSucceeded } from '@/lib/auth/throttle';
import { ValidationError } from '@/lib/errors';
import { formText, nextFormState, repeatError, waitText, type FormState } from '@/lib/form-state';

// Wrong tokens share the login throttle under a name no username can take ('-' is not allowed),
// so a weak token cannot be guessed faster than a password.
const THROTTLE_NAME = 'owner-reset';

const MESSAGES = {
  invalid: 'That reset token is not right. Copy it again from OWNER_RESET_TOKEN in the .env file.',
  used: 'That token was already used. Put a new OWNER_RESET_TOKEN in the .env file and restart the app.',
  disabled: 'Owner reset is switched off. Set OWNER_RESET_TOKEN in the .env file and restart the app.',
} as const;

export async function resetOwnerAction(prev: FormState, formData: FormData): Promise<FormState> {
  const token = formText(formData, 'token').trim();
  const password = formText(formData, 'password');
  const confirm = formText(formData, 'confirm');

  const fieldErrors: Record<string, string> = {};
  if (!token) fieldErrors.token = 'Enter the reset token.';
  const passwordProblem = passwordError(password);
  const repeatProblem = repeatError(password, confirm);
  if (passwordProblem) fieldErrors.password = passwordProblem;
  else if (repeatProblem) fieldErrors.confirm = repeatProblem;
  if (Object.keys(fieldErrors).length > 0) return nextFormState(prev, { fieldErrors });

  const ip = clientIp(await headers());
  // Reserved as a failure before the token is checked, so overlapping guesses cannot all pass.
  const attempt = await beginLoginAttempt(THROTTLE_NAME, ip);
  if (!attempt.allowed) {
    return nextFormState(prev, { message: `Too many wrong tokens. Try again in ${waitText(attempt.retryAfterSec)}.` });
  }

  let result;
  try {
    result = await resetOwnerPassword(token, password);
  } catch (error) {
    if (error instanceof ValidationError) {
      // Thrown only after the token matched, so it is not a wrong guess.
      await markLoginSucceeded(attempt.attemptIds);
      return nextFormState(prev, { fieldErrors: { [error.field]: error.message } });
    }
    throw error;
  }
  // Only a wrong token counts toward the lock.
  if (result !== 'invalid') await markLoginSucceeded(attempt.attemptIds);
  if (result === 'ok') return nextFormState(prev, { done: true });
  return nextFormState(prev, { message: MESSAGES[result] });
}
