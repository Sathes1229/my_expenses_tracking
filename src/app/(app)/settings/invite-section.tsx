'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/button';
import { CopyField } from '@/components/copy-field';
import { Dialog } from '@/components/dialog';
import { EmptyState } from '@/components/empty-state';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import type { InviteListStatus, InviteRole } from '@/lib/auth/invites';
import { initialFormState } from '@/lib/form-state';
import { createInviteAction, revokeInviteAction, type InviteFormState } from './actions';

/** One invite as the page shows it; dates are already written out by the server. */
export type InviteRow = { id: string; role: InviteRole; status: InviteListStatus; created: string; expires: string };

const ROLE_WORD = { member: 'Member', guest: 'Guest' } as const;

function statusText(invite: InviteRow): string {
  switch (invite.status) {
    case 'open':
      return `Open until ${invite.expires}`;
    case 'expired':
      return `Expired ${invite.expires}`;
    case 'used':
      return 'Used';
    case 'revoked':
      return 'Revoked';
  }
}

export function InviteSection({ invites }: { invites: InviteRow[] }) {
  // Revoking removes the row's button, so focus moves to the sentence that says it worked.
  const [shown, setShown] = useState(invites);
  // A new object per revoke, so the focus effect runs once for each.
  const [notice, setNotice] = useState<{ text: string } | null>(null);
  if (invites !== shown) {
    setShown(invites);
    const revoked = invites.some(
      (i) => i.status === 'revoked' && shown.some((s) => s.id === i.id && s.status === 'open'),
    );
    if (revoked) setNotice({ text: 'Invite revoked. Its link no longer works.' });
  }
  const noticeRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);

  return (
    <>
      <CreateInvite />
      <h3 className="mt-8 font-semibold text-ink">Invite links</h3>
      <p ref={noticeRef} tabIndex={-1} role="status" className="min-h-6 text-sm font-medium text-ink">
        {notice?.text}
      </p>
      {invites.length === 0 ? (
        <EmptyState title="No invites yet.">Links you create show here, with whether each one was used.</EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-surface border border-line bg-surface">
          {invites.map((invite) => (
            <li key={invite.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
              <div className="min-w-0 py-1">
                <p className="font-medium text-ink">{ROLE_WORD[invite.role]} invite</p>
                <p className="text-sm text-muted">
                  {statusText(invite)}
                  <span aria-hidden="true"> · </span>
                  <span className="sr-only">, </span>
                  made {invite.created}
                </p>
              </div>
              {invite.status === 'open' && <RevokeInvite invite={invite} />}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function RoleChoice({
  value,
  title,
  detail,
  defaultChecked,
}: {
  value: InviteRole;
  title: string;
  detail: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex min-h-11 items-start gap-3 rounded-control border border-line-strong bg-surface px-3 py-2.5 transition-state hover:bg-sunken has-checked:border-ink has-checked:bg-sunken">
      <input
        type="radio"
        name="role"
        value={value}
        defaultChecked={defaultChecked}
        className="mt-1 size-4 shrink-0 accent-ink"
      />
      <span>
        <span className="block font-medium text-ink">{title}</span>
        <span className="block text-sm text-muted">{detail}</span>
      </span>
    </label>
  );
}

function CreateInvite() {
  // Only the attempt count goes back to the server, never the link from the last result.
  const [state, action] = useActionState<InviteFormState, FormData>(
    (prev, formData) => createInviteAction({ attempt: prev.attempt }, formData),
    initialFormState,
  );
  const roleError = state.fieldErrors?.role;

  return (
    <div className="mt-4 rounded-surface border border-line bg-surface p-4">
      <form action={action} noValidate className="flex flex-col gap-4">
        <fieldset aria-describedby={roleError ? 'invite-role-error' : undefined}>
          <legend className="text-sm font-medium text-ink">Who is the invite for?</legend>
          {roleError && (
            <p id="invite-role-error" className="mt-1.5 text-sm font-medium text-danger">
              <span className="sr-only">Error: </span>
              {roleError}
            </p>
          )}
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {/* The form resets after each submit; it comes back with the last role chosen. */}
            <RoleChoice
              value="member"
              title="Member"
              detail="For family. Sees all household spending."
              defaultChecked={state.role !== 'guest'}
            />
            <RoleChoice
              value="guest"
              title="Guest"
              detail="For friends. Sees budget names, what is left and their own entries."
              defaultChecked={state.role === 'guest'}
            />
          </div>
        </fieldset>
        <SubmitButton className="self-start">Create invite link</SubmitButton>
      </form>
      {state.link && state.role && (
        <div className="mt-5 border-t border-line pt-4">
          <CopyField
            label={`New ${state.role} invite link`}
            hint="Send it to the person yourself. It works once, for 7 days. This is the only time it is shown."
            value={state.link}
            autoFocus
          />
        </div>
      )}
    </div>
  );
}

function RevokeInvite({ invite }: { invite: InviteRow }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="quiet" className="-mx-3" onClick={() => setOpen(true)}>
        Revoke
        <span className="sr-only">
          {' '}
          ({ROLE_WORD[invite.role]} invite made {invite.created})
        </span>
      </Button>
      {open && <RevokeDialog invite={invite} onClose={() => setOpen(false)} />}
    </>
  );
}

function RevokeDialog({ invite, onClose }: { invite: InviteRow; onClose: () => void }) {
  const [state, action] = useActionState(revokeInviteAction, initialFormState);
  // Closing the native dialog first lets the browser put focus back on the Revoke button.
  const [shown, setShown] = useState(true);
  return (
    <Dialog open={shown} onClose={onClose} title="Revoke this invite?">
      <form action={action} className="flex flex-col gap-4">
        <p className="text-muted">
          The {invite.role} invite link made {invite.created} stops working, so nobody can join with it. You
          can create a new one at any time.
        </p>
        <FormAlert state={state} />
        <input type="hidden" name="inviteId" value={invite.id} />
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => setShown(false)}>
            Keep it
          </Button>
          <SubmitButton variant="danger">Revoke invite</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}
