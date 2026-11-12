'use server';

import { refresh } from 'next/cache';
import { requireOwner } from '@/lib/auth/viewer';
import { addPayment, createDebt, deleteDebt, deletePayment, updateDebt, type DebtInput } from '@/lib/debts';
import { ValidationError } from '@/lib/errors';
import { formText, nextFormState, type FormState } from '@/lib/form-state';
import { parseRM } from '@/lib/money';

// Every action here checks the session itself (requireOwner): a server action is reachable by a
// plain POST, so hiding the page from members and guests protects nothing on its own. The form
// says which debt or payment to act on; who is acting always comes from the session.

const FIELDS = ['personName', 'amount', 'lentOn', 'dueOn', 'note', 'paidOn'];

/** Reads the amount field. A bad one comes back as a message under that field. */
function parseAmount(formData: FormData): { sen: number } | { error: string } {
  const text = formText(formData, 'amount').trim();
  if (!text) return { error: 'Enter the amount.' };
  const sen = parseRM(text);
  return sen === null ? { error: 'Enter an amount like 500 or 500.50.' } : { sen };
}

function submitted(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of FIELDS) out[name] = formText(formData, name);
  return out;
}

/** Runs a change. A ValidationError becomes a message (under its field when it has one). */
async function attempt(prev: FormState, formData: FormData, change: () => Promise<void>): Promise<FormState> {
  const values = submitted(formData);
  try {
    await change();
  } catch (error) {
    if (error instanceof ValidationError) {
      return FIELDS.includes(error.field)
        ? nextFormState(prev, { fieldErrors: { [error.field]: error.message }, values })
        : nextFormState(prev, { message: error.message, values });
    }
    throw error;
  }
  // The list is read per request, so re-render it in this same response.
  refresh();
  return nextFormState(prev, { done: true });
}

/** A bad amount, plus a blank name when the form has one, so both show at once. */
function amountFailed(prev: FormState, formData: FormData, error: string): FormState {
  const fieldErrors: Record<string, string> = { amount: error };
  if (formData.has('personName') && !formText(formData, 'personName').trim()) {
    fieldErrors.personName = 'Enter who you lent the money to.';
  }
  return nextFormState(prev, { fieldErrors, values: submitted(formData) });
}

function debtInput(formData: FormData, amountSen: number): DebtInput {
  return {
    personName: formText(formData, 'personName'),
    amountSen,
    lentOn: formText(formData, 'lentOn'),
    dueOn: formText(formData, 'dueOn') || undefined,
    note: formText(formData, 'note'),
  };
}

export async function createDebtAction(prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requireOwner();
  const amount = parseAmount(formData);
  if ('error' in amount) return amountFailed(prev, formData, amount.error);
  return attempt(prev, formData, async () => {
    await createDebt(owner, debtInput(formData, amount.sen));
  });
}

export async function updateDebtAction(prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requireOwner();
  const amount = parseAmount(formData);
  if ('error' in amount) return amountFailed(prev, formData, amount.error);
  return attempt(prev, formData, () => updateDebt(owner, formText(formData, 'debtId'), debtInput(formData, amount.sen)));
}

export async function deleteDebtAction(prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requireOwner();
  return attempt(prev, formData, () => deleteDebt(owner, formText(formData, 'debtId')));
}

export async function addPaymentAction(prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requireOwner();
  const amount = parseAmount(formData);
  if ('error' in amount) return amountFailed(prev, formData, amount.error);
  return attempt(prev, formData, () =>
    addPayment(owner, formText(formData, 'debtId'), { amountSen: amount.sen, paidOn: formText(formData, 'paidOn') }),
  );
}

export async function deletePaymentAction(prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requireOwner();
  return attempt(prev, formData, () => deletePayment(owner, formText(formData, 'paymentId')));
}
