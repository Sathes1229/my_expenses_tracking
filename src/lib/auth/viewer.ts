import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { db } from '@/db/client';
import { user } from '@/db/schema';
import { ForbiddenError } from '@/lib/errors';
import { getAuth } from './auth';

export type Role = 'owner' | 'member' | 'guest';
export type Viewer = { id: string; role: Role; displayName: string };
export type SessionState = { viewer: Viewer; mustChangePassword: boolean };

async function stateFromHeaders(requestHeaders: Headers): Promise<SessionState | null> {
  const found = await getAuth().api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true },
  });
  if (!found) return null;
  // Role, name and removal come from the user row on every call, so changes apply on the next request.
  const row = db
    .select({
      id: user.id,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      removedAt: user.removedAt,
    })
    .from(user)
    .where(eq(user.id, found.user.id))
    .get();
  if (!row || row.removedAt) return null;
  return {
    viewer: { id: row.id, role: row.role, displayName: row.name },
    mustChangePassword: row.mustChangePassword,
  };
}

/** The person a request's session cookie belongs to; null when signed out or removed. */
export async function viewerFromHeaders(requestHeaders: Headers): Promise<Viewer | null> {
  return (await stateFromHeaders(requestHeaders))?.viewer ?? null;
}

/** Once per render: the layout and the page both ask. Server actions run it on every call. */
export const getSessionState = cache(
  async (): Promise<SessionState | null> => stateFromHeaders(await headers()),
);

export async function getViewer(): Promise<Viewer | null> {
  return (await getSessionState())?.viewer ?? null;
}

/** Sends anyone signed out to /login, and anyone on a temporary password to /change-password. */
export async function requireViewer(): Promise<Viewer> {
  const state = await getSessionState();
  if (!state) redirect('/login');
  if (state.mustChangePassword) redirect('/change-password');
  return state.viewer;
}

export async function requireOwner(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (viewer.role !== 'owner') throw new ForbiddenError();
  return viewer;
}
