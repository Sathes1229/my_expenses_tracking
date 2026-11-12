'use server';

import { refresh } from 'next/cache';
import { clearChat } from '@/lib/ai/chat';
import { requireViewer } from '@/lib/auth/viewer';
import { nextFormState, type FormState } from '@/lib/form-state';

/** Deletes the signed-in person's own conversation. Whose it is comes from the session, never a field. */
export async function clearChatAction(prev: FormState): Promise<FormState> {
  const viewer = await requireViewer();
  await clearChat(viewer);
  refresh();
  return nextFormState(prev, { done: true });
}
