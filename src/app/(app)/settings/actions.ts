'use server';

import { refresh } from 'next/cache';
import { createInvite, inviteLink, revokeInvite } from '@/lib/auth/invites';
import { changeRole, removePerson, resetPassword } from '@/lib/auth/people';
import { requireOwner } from '@/lib/auth/viewer';
import { ValidationError } from '@/lib/errors';
import { formText, nextFormState, type FormState } from '@/lib/form-state';

// Every action here checks the session itself (requireOwner): a server action is reachable by a
// plain POST, so the page being owner-only protects nothing. The form says which invite or person
// to act on; who is acting always comes from the session.

export type InviteFormState = FormState & { link?: string; role?: 'member' | 'guest' };
export type ResetFormState = FormState & { tempPassword?: string };

/** Runs an owner change; a ValidationError becomes the form's message, anything else is a real error. */
async function attempt(prev: FormState, change: () => Promise<void>): Promise<FormState> {
  try {
    await change();
  } catch (error) {
    if (error instanceof ValidationError) return nextFormState(prev, { message: error.message });
    throw error;
  }
  // The lists on the page are read per request, so re-render them in this same response.
  refresh();
  return nextFormState(prev, { done: true });
}

export async function createInviteAction(prev: InviteFormState, formData: FormData): Promise<InviteFormState> {
  const owner = await requireOwner();
  const role = formText(formData, 'role');
  if (role !== 'member' && role !== 'guest') {
    return nextFormState(prev, { fieldErrors: { role: 'Choose Member or Guest.' } });
  }
  const { token } = await createInvite(owner, role);
  refresh();
  return { ...nextFormState(prev, { done: true }), link: inviteLink(token), role };
}

export async function revokeInviteAction(prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requireOwner();
  return attempt(prev, () => revokeInvite(owner, formText(formData, 'inviteId')));
}

export async function changeRoleAction(prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requireOwner();
  const role = formText(formData, 'role');
  if (role !== 'member' && role !== 'guest') return nextFormState(prev, { message: 'Choose Member or Guest.' });
  return attempt(prev, () => changeRole(owner, formText(formData, 'userId'), role));
}

export async function removePersonAction(prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requireOwner();
  return attempt(prev, () => removePerson(owner, formText(formData, 'userId')));
}

/** The temporary password goes back to the owner's screen once and is never stored in plain form. */
export async function resetPasswordAction(prev: ResetFormState, formData: FormData): Promise<ResetFormState> {
  const owner = await requireOwner();
  try {
    const { tempPassword } = await resetPassword(owner, formText(formData, 'userId'));
    return { ...nextFormState(prev, { done: true }), tempPassword };
  } catch (error) {
    if (error instanceof ValidationError) return nextFormState(prev, { message: error.message });
    throw error;
  }
}
