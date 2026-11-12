'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { signIn } from '@/lib/auth/accounts';
import { clientIp } from '@/lib/auth/throttle';
import { formText, nextFormState, waitText, type FormState } from '@/lib/form-state';

export async function signInAction(prev: FormState, formData: FormData): Promise<FormState> {
  const username = formText(formData, 'username');
  const password = formText(formData, 'password');
  const values = { username };

  const fieldErrors: Record<string, string> = {};
  if (!username.trim()) fieldErrors.username = 'Enter your username.';
  if (!password) fieldErrors.password = 'Enter your password.';
  if (Object.keys(fieldErrors).length > 0) return nextFormState(prev, { fieldErrors, values });

  const result = await signIn(username, password, clientIp(await headers()));
  if (result.ok) redirect('/');
  if (result.reason === 'locked') {
    return nextFormState(prev, {
      message: `Too many sign-in attempts. Try again in ${waitText(result.retryAfterSec ?? 900)}.`,
      values,
    });
  }
  return nextFormState(prev, { message: 'Wrong username or password.', values });
}
