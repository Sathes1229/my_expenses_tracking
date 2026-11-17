'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/button';
import { CopyField } from '@/components/copy-field';
import { Dialog } from '@/components/dialog';
import { EmptyState } from '@/components/empty-state';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { useMessages } from '@/i18n/client';
import { fmt } from '@/i18n/format';
import type { Messages } from '@/i18n/messages';
import type { InviteListStatus, InviteRole } from '@/lib/auth/invites';
import { initialFormState } from '@/lib/form-state';
import { createInviteAction, revokeInviteAction, type InviteFormState } from './actions';

/** One invite as the page shows it; dates are already written out by the server. */
export type InviteRow = { id: string; role: InviteRole; status: InviteListStatus; created: string; expires: string };

function statusText(invite: InviteRow, t: Messages['invites']['status']): string {
  switch (invite.status) {
    case 'open':
      return fmt(t.open, { date: invite.expires });
    case 'expired':
      return fmt(t.expired, { date: invite.expires });
    case 'used':
      return t.used;
    case 'revoked':
      return t.revoked;
  }
}

export function InviteSection({ invites }: { invites: InviteRow[] }) {
  const t = useMessages().invites;
  // Revoking removes the row's button, so focus moves to the sentence that says it worked.
  const [shown, setShown] = useState(invites);
  // A new object per revoke, so the focus effect runs once for each.
  const [notice, setNotice] = useState<{ text: string } | null>(null);
  if (invites !== shown) {
    setShown(invites);
    const revoked = invites.some(
      (i) => i.status === 'revoked' && shown.some((s) => s.id === i.id && s.status === 'open'),
    );
    if (revoked) setNotice({ text: t.revoked });
  }
  const noticeRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);

  return (
    <>
      <CreateInvite />
      <h3 className="mt-8 font-semibold text-ink">{t.linksHeading}</h3>
      <p ref={noticeRef} tabIndex={-1} role="status" className="min-h-6 text-sm font-medium text-ink">
        {notice?.text}
      </p>
      {invites.length === 0 ? (
        <EmptyState title={t.emptyTitle}>{t.emptyBody}</EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-surface border border-line bg-surface">
          {invites.map((invite) => (
            <li key={invite.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
              <div className="min-w-0 py-1">
                <p className="font-medium text-ink">{t.roleInvite[invite.role]}</p>
                <p className="text-sm text-muted">
                  {statusText(invite, t.status)}
                  <span aria-hidden="true"> · </span>
                  <span className="sr-only">, </span>
                  {fmt(t.made, { date: invite.created })}
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
  const { common, settings, invites: t } = useMessages();
  const roleError = state.fieldErrors?.role;

  return (
    <div className="mt-4 rounded-surface border border-line bg-surface p-4">
      <form action={action} noValidate className="flex flex-col gap-4">
        <fieldset aria-describedby={roleError ? 'invite-role-error' : undefined}>
          <legend className="text-sm font-medium text-ink">{t.whoFor}</legend>
          {roleError && (
            <p id="invite-role-error" className="mt-1.5 text-sm font-medium text-danger">
              <span className="sr-only">{common.errorPrefix} </span>
              {roleError}
            </p>
          )}
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {/* The form resets after each submit; it comes back with the last role chosen. */}
            <RoleChoice
              value="member"
              title={settings.roles.member}
              detail={t.memberDetail}
              defaultChecked={state.role !== 'guest'}
            />
            <RoleChoice
              value="guest"
              title={settings.roles.guest}
              detail={t.guestDetail}
              defaultChecked={state.role === 'guest'}
            />
          </div>
        </fieldset>
        <SubmitButton className="self-start">{t.create}</SubmitButton>
      </form>
      {state.link && state.role && (
        <div className="mt-5 border-t border-line pt-4">
          <CopyField
            label={fmt(t.newLink, { role: settings.roleWords[state.role] })}
            hint={t.linkHint}
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
  const t = useMessages().invites;
  return (
    <>
      <Button variant="quiet" className="-mx-3" onClick={() => setOpen(true)}>
        {t.revoke}
        <span className="sr-only">
          {' '}
          ({fmt(t.revokeDetail, { invite: t.roleInvite[invite.role], date: invite.created })})
        </span>
      </Button>
      {open && <RevokeDialog invite={invite} onClose={() => setOpen(false)} />}
    </>
  );
}

function RevokeDialog({ invite, onClose }: { invite: InviteRow; onClose: () => void }) {
  const [state, action] = useActionState(revokeInviteAction, initialFormState);
  const { settings, invites: t } = useMessages();
  // Closing the native dialog first lets the browser put focus back on the Revoke button.
  const [shown, setShown] = useState(true);
  return (
    <Dialog open={shown} onClose={onClose} title={t.revokeTitle}>
      <form action={action} className="flex flex-col gap-4">
        <p className="text-muted">
          {fmt(t.revokeBody, { role: settings.roleWords[invite.role], date: invite.created })}
        </p>
        <FormAlert state={state} />
        <input type="hidden" name="inviteId" value={invite.id} />
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => setShown(false)}>
            {t.keep}
          </Button>
          <SubmitButton variant="danger">{t.revokeConfirm}</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}
