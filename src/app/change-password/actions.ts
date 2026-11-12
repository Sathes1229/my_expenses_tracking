'use server';

import { redirect } from 'next/navigation';
import { passwordError, replaceTemporaryPassword } from '@/lib/auth/accounts';
import { getSessionState } from '@/lib/auth/viewer';
import { ValidationError } from '@/lib/errors';
import { formText, nextFormState, repeatError, type FormState } from '@/lib/form-state';

export async function changePasswordAction(prev: FormState, formData: FormData): Promise<FormState> {
  const state = await getSessionState();
  if (!state) redirect('/login');
  if (!state.mustChangePassword) redirect('/');

  const password = formText(formData, 'password');
  const confirm = formText(formData, 'confirm');
  const fieldErrors: Record<string, string> = {};
  const passwordProblem = passwordError(password);
  const repeatProblem = repeatError(password, confirm);
  if (passwordProblem) fieldErrors.password = passwordProblem;
  else if (repeatProblem) fieldErrors.confirm = repeatProblem;
  if (Object.keys(fieldErrors).length > 0) return nextFormState(prev, { fieldErrors });

  try {
    await replaceTemporaryPassword(state.viewer.id, password);
  } catch (error) {
    if (error instanceof ValidationError) {
      return nextFormState(prev, { fieldErrors: { [error.field]: error.message } });
    }
    throw error;
  }
  redirect('/');
}
