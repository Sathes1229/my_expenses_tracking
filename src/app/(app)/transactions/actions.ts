'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireViewer } from '@/lib/auth/viewer';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { formText, nextFormState, type FormState } from '@/lib/form-state';
import { parseTransactionForm } from '@/lib/transaction-form-data';
import { createTransaction, deleteTransaction, updateTransaction, type TransactionInput } from '@/lib/transactions';
import { monthKey, parseMonthParam } from '@/lib/time';

// Every action checks the session itself (requireViewer) and the lib checks the rights on the row:
// a server action is reachable by a plain POST. Forms say which transaction to act on; who is
// acting always comes from the session, never from a field.

const FIELDS = new Set(['merchant', 'total', 'occurredAt', 'paymentMethod', 'budget', 'receiptNumber', 'note']);

/** What was typed in the single-value fields, so a failed submit puts it back. Item rows are controlled by the form. */
function submitted(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string' && !key.startsWith('item') && !key.startsWith('$')) out[key] = value;
  }
  return out;
}

/** Runs a change. A ValidationError or ForbiddenError becomes a message, under its field when it has one. */
async function attempt(prev: FormState, formData: FormData, change: () => Promise<void>): Promise<FormState> {
  const values = submitted(formData);
  try {
    await change();
  } catch (error) {
    if (error instanceof ValidationError) {
      return FIELDS.has(error.field) || error.field.startsWith('items')
        ? nextFormState(prev, { fieldErrors: { [error.field]: error.message }, values })
        : nextFormState(prev, { message: error.message, values });
    }
    if (error instanceof ForbiddenError) return nextFormState(prev, { message: error.message, values });
    throw error;
  }
  // The list, the edit pages and the budget meters are kept in the router between visits; this drops them so the redirect shows the change.
  revalidatePath('/transactions', 'layout');
  revalidatePath('/budgets');
  return nextFormState(prev, { done: true });
}

function goToMonth(input: TransactionInput): never {
  redirect(`/transactions?month=${monthKey(input.occurredAt)}`);
}

export async function createTransactionAction(prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireViewer();
  const parsed = parseTransactionForm(formData);
  if (!parsed.ok) return nextFormState(prev, { fieldErrors: parsed.errors, values: submitted(formData) });
  const result = await attempt(prev, formData, async () => {
    await createTransaction(viewer, parsed.input);
  });
  if (result.done) goToMonth(parsed.input);
  return result;
}

export async function updateTransactionAction(prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireViewer();
  const id = formText(formData, 'transactionId');
  const parsed = parseTransactionForm(formData);
  if (!parsed.ok) return nextFormState(prev, { fieldErrors: parsed.errors, values: submitted(formData) });
  const result = await attempt(prev, formData, () => updateTransaction(viewer, id, parsed.input));
  if (result.done) goToMonth(parsed.input);
  return result;
}

export async function deleteTransactionAction(prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireViewer();
  const result = await attempt(prev, formData, () => deleteTransaction(viewer, formText(formData, 'transactionId')));
  if (result.done) redirect(`/transactions?month=${parseMonthParam(formText(formData, 'month'))}`);
  return result;
}
