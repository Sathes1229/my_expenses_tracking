'use server';

import { refresh } from 'next/cache';
import { setChatModel, setDailyBudget, setReceiptModel } from '@/lib/ai/settings';
import { requireOwner } from '@/lib/auth/viewer';
import { ValidationError } from '@/lib/errors';
import { formText, nextFormState, type FormState } from '@/lib/form-state';

// Owner only, checked here (requireOwner) and again in the lib functions: a server action is
// reachable by a plain POST, so the page being owner-only protects nothing.

function failure(prev: FormState, error: unknown, values: Record<string, string>): FormState {
  if (error instanceof ValidationError) {
    return nextFormState(prev, { fieldErrors: { [error.field]: error.message }, values });
  }
  throw error;
}

/** A field left on "Not chosen" keeps whatever was saved before. */
export async function saveModelsAction(prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requireOwner();
  const chat = formText(formData, 'chatModel');
  const receipt = formText(formData, 'receiptModel');
  if (!chat && !receipt) {
    return nextFormState(prev, { message: 'Choose a model for the assistant or for receipts, then save.' });
  }
  try {
    if (chat) await setChatModel(owner, chat);
    if (receipt) await setReceiptModel(owner, receipt);
  } catch (error) {
    return failure(prev, error, { chatModel: chat, receiptModel: receipt });
  }
  refresh();
  return nextFormState(prev, { done: true });
}

export async function saveBudgetAction(prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requireOwner();
  const dailyBudget = formText(formData, 'dailyBudget');
  try {
    await setDailyBudget(owner, dailyBudget);
  } catch (error) {
    return failure(prev, error, { dailyBudget });
  }
  refresh();
  return nextFormState(prev, { done: true });
}
