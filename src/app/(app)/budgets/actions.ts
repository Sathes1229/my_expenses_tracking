'use server';

import { refresh } from 'next/cache';
import { requireOwner } from '@/lib/auth/viewer';
import { allocationFor, archiveBudget, createBudget, updateBudget } from '@/lib/budgets';
import { ValidationError } from '@/lib/errors';
import { formText, nextFormState, type FormState } from '@/lib/form-state';
import { parseRM } from '@/lib/money';
import { monthKey } from '@/lib/time';

// Every action here checks the session itself (requireOwner): a server action is reachable by a
// plain POST, so the page showing the buttons only to the owner protects nothing. The form says
// which budget to act on; who is acting always comes from the session.

type Parsed = { name: string; allocationSen: number; thresholdPct: number };

/** Reads the three fields. A bad one comes back as a message under that field, not a thrown error. */
function parseFields(formData: FormData): { ok: true; value: Parsed } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const name = formText(formData, 'name');
  const allocationText = formText(formData, 'allocation');
  const thresholdText = formText(formData, 'threshold').trim();

  if (!name.trim()) errors.name = 'Enter a name for the budget.';
  const allocationSen = allocationText.trim() ? parseRM(allocationText) : null;
  if (allocationSen === null) {
    errors.allocation = allocationText.trim() ? 'Enter an amount like 800 or 800.50.' : 'Enter the monthly amount.';
  }
  const thresholdPct = /^\d{1,3}$/.test(thresholdText) ? Number(thresholdText) : NaN;
  if (!(thresholdPct >= 1 && thresholdPct <= 100)) errors.threshold = 'Enter a whole number from 1 to 100.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, allocationSen: allocationSen as number, thresholdPct } };
}

/** What was typed, so a failed submit puts it back. */
function submitted(formData: FormData) {
  return {
    name: formText(formData, 'name'),
    allocation: formText(formData, 'allocation'),
    threshold: formText(formData, 'threshold'),
  };
}

const FIELDS = ['name', 'allocation', 'threshold'];

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

export async function createBudgetAction(prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requireOwner();
  const parsed = parseFields(formData);
  if (!parsed.ok) {
    return nextFormState(prev, { fieldErrors: parsed.errors, values: submitted(formData) });
  }
  return attempt(prev, formData, async () => {
    await createBudget(owner, parsed.value);
  });
}

export async function updateBudgetAction(prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requireOwner();
  const id = formText(formData, 'budgetId');
  const parsed = parseFields(formData);
  if (!parsed.ok) {
    return nextFormState(prev, { fieldErrors: parsed.errors, values: submitted(formData) });
  }
  return attempt(prev, formData, async () => {
    const { name, allocationSen, thresholdPct } = parsed.value;
    // Only a changed amount starts a new allocation for this month; saving the same one again does not.
    const current = await allocationFor(id, monthKey(new Date()));
    await updateBudget(owner, id, {
      name,
      thresholdPct,
      ...(allocationSen !== current ? { allocationSen } : {}),
    });
  });
}

export async function archiveBudgetAction(prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requireOwner();
  return attempt(prev, formData, () => archiveBudget(owner, formText(formData, 'budgetId')));
}
