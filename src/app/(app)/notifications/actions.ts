'use server';

import { revalidatePath } from 'next/cache';
import { requireViewer } from '@/lib/auth/viewer';
import { markAllRead } from '@/lib/notifications';

/** Called from the page after it has shown the list, never while rendering it. */
export async function markNotificationsReadAction(): Promise<void> {
  const viewer = await requireViewer();
  await markAllRead(viewer);
  // The bell sits in the shell, so the whole layout is refreshed.
  revalidatePath('/', 'layout');
}
