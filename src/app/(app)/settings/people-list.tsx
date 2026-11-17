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
import type { Person } from '@/lib/auth/people';
import { initialFormState } from '@/lib/form-state';
import { changeRoleAction, removePersonAction, resetPasswordAction, type ResetFormState } from './actions';

type Notice = { text: string; moveFocus: boolean };

/** What changed between two versions of the list, said in a sentence. */
function describeChange(before: Person[], after: Person[], messages: Messages): Notice | null {
  const t = messages.people;
  const removed = before.find((p) => !after.some((q) => q.id === p.id));
  if (removed) return { text: fmt(t.removed, { name: removed.displayName }), moveFocus: true };
  const changed = after.find((p) => before.some((q) => q.id === p.id && q.role !== p.role));
  if (changed) {
    const role = messages.settings.roleWords[changed.role];
    return { text: fmt(t.nowRole, { name: changed.displayName, role }), moveFocus: false };
  }
  return null;
}

export function PeopleList({ people }: { people: Person[] }) {
  const messages = useMessages();
  const t = messages.people;
  // The list comes fresh from the server after each change; compare with the last one to say what happened.
  const [shown, setShown] = useState(people);
  const [notice, setNotice] = useState<Notice | null>(null);
  if (people !== shown) {
    setShown(people);
    const change = describeChange(shown, people, messages);
    if (change) setNotice(change);
  }

  // A removed person's row and its buttons are gone, so focus moves to the sentence saying so.
  const noticeRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (notice?.moveFocus) noticeRef.current?.focus();
  }, [notice]);

  const others = people.filter((p) => p.role !== 'owner');

  return (
    <>
      <h2 id="people-heading" className="text-lg font-semibold text-ink">
        {t.heading}
      </h2>
      <p className="mt-1 text-muted">{t.intro}</p>
      <p ref={noticeRef} tabIndex={-1} role="status" className="mt-3 min-h-6 text-sm font-medium text-ink">
        {notice?.text}
      </p>
      <ul className="mt-1 divide-y divide-line rounded-surface border border-line bg-surface">
        {people.map((person) => (
          <PersonRow key={person.id} person={person} />
        ))}
      </ul>
      {others.length === 0 && (
        <div className="mt-4">
          <EmptyState title={t.noOthersTitle}>{t.noOthersBody}</EmptyState>
        </div>
      )}
    </>
  );
}

function PersonRow({ person }: { person: Person }) {
  const { settings, people: t } = useMessages();
  const isOwner = person.role === 'owner';
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 py-1">
        <p className="font-medium break-words text-ink">
          {person.displayName}
          {isOwner && <span className="font-normal text-muted">{` ${t.you}`}</span>}
        </p>
        <p className="text-sm break-all text-muted">
          {settings.roles[person.role]}
          <span aria-hidden="true"> · </span>
          <span className="sr-only">{`, ${t.username} `}</span>
          {person.username}
        </p>
      </div>
      {!isOwner && (
        <div className="-mx-3 flex flex-wrap items-start gap-1">
          <RoleForm person={person} />
          <ResetPassword person={person} />
          <RemovePerson person={person} />
        </div>
      )}
    </li>
  );
}

/** Making someone a guest deletes their assistant conversation, so it asks first. Making a member does not. */
function RoleForm({ person }: { person: Person }) {
  return person.role === 'member' ? <MakeGuest person={person} /> : <MakeMember person={person} />;
}

function MakeMember({ person }: { person: Person }) {
  const [state, action] = useActionState(changeRoleAction, initialFormState);
  const t = useMessages().people;
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={person.id} />
      <input type="hidden" name="role" value="member" />
      <SubmitButton variant="quiet">
        {t.makeMember}
        <span className="sr-only"> ({person.displayName})</span>
      </SubmitButton>
      {state.message && (
        <p key={state.attempt} role="alert" className="px-3 text-sm font-medium text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}

function MakeGuest({ person }: { person: Person }) {
  const [open, setOpen] = useState(false);
  const t = useMessages().people;
  return (
    <>
      <Button variant="quiet" onClick={() => setOpen(true)}>
        {t.makeGuest}
        <span className="sr-only"> ({person.displayName})</span>
      </Button>
      {open && <MakeGuestDialog person={person} onClose={() => setOpen(false)} />}
    </>
  );
}

function MakeGuestDialog({ person, onClose }: { person: Person; onClose: () => void }) {
  const [state, action] = useActionState(changeRoleAction, initialFormState);
  const [shown, setShown] = useState(true);
  const t = useMessages().people;
  const name = { name: person.displayName };
  // On success the row turns into a guest's, and this dialog leaves the page with the member's button.
  return (
    <Dialog open={shown} onClose={onClose} title={fmt(t.makeGuestTitle, name)}>
      <form action={action} className="flex flex-col gap-4">
        <p className="text-muted">{fmt(t.makeGuestBody, name)}</p>
        <FormAlert state={state} />
        <input type="hidden" name="userId" value={person.id} />
        <input type="hidden" name="role" value="guest" />
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => setShown(false)}>
            {fmt(t.keepMember, name)}
          </Button>
          <SubmitButton variant="danger">{fmt(t.makeGuestConfirm, name)}</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * Opens a confirmation. The dialog is mounted only while open, so a temporary password never
 * outlives it. Its buttons close the native dialog first (shown = false): the browser then puts
 * focus back on the button that opened it, and the close event unmounts it through onClose.
 */
function ResetPassword({ person }: { person: Person }) {
  const [open, setOpen] = useState(false);
  const t = useMessages().people;
  return (
    <>
      <Button variant="quiet" onClick={() => setOpen(true)}>
        {t.resetPassword}
        <span className="sr-only"> ({person.displayName})</span>
      </Button>
      {open && <ResetPasswordDialog person={person} onClose={() => setOpen(false)} />}
    </>
  );
}

function ResetPasswordDialog({ person, onClose }: { person: Person; onClose: () => void }) {
  // Only the attempt count goes back to the server, never a temporary password from an earlier result.
  const [state, action] = useActionState<ResetFormState, FormData>(
    (prev, formData) => resetPasswordAction({ attempt: prev.attempt }, formData),
    initialFormState,
  );
  const [shown, setShown] = useState(true);
  const close = () => setShown(false);
  const { common, people: t } = useMessages();
  const name = { name: person.displayName };

  if (state.tempPassword) {
    return (
      <Dialog open={shown} onClose={onClose} title={fmt(t.tempTitle, name)}>
        <p className="text-muted">{fmt(t.tempBody, name)}</p>
        <div className="mt-4">
          <CopyField label={t.tempLabel} value={state.tempPassword} mono autoFocus />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={close}>{t.done}</Button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open={shown} onClose={onClose} title={fmt(t.resetTitle, name)}>
      <form action={action} className="flex flex-col gap-4">
        <p className="text-muted">{fmt(t.resetBody, name)}</p>
        <FormAlert state={state} />
        <input type="hidden" name="userId" value={person.id} />
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={close}>
            {common.cancel}
          </Button>
          <SubmitButton variant="danger">{t.resetPassword}</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}

function RemovePerson({ person }: { person: Person }) {
  const [open, setOpen] = useState(false);
  const t = useMessages().people;
  return (
    <>
      <Button variant="quiet" onClick={() => setOpen(true)}>
        {t.remove}
        <span className="sr-only"> ({person.displayName})</span>
      </Button>
      {open && <RemoveDialog person={person} onClose={() => setOpen(false)} />}
    </>
  );
}

function RemoveDialog({ person, onClose }: { person: Person; onClose: () => void }) {
  const [state, action] = useActionState(removePersonAction, initialFormState);
  const [shown, setShown] = useState(true);
  const t = useMessages().people;
  const name = { name: person.displayName };
  // On success the row, and this dialog with it, leaves the page; the list says who was removed.
  return (
    <Dialog open={shown} onClose={onClose} title={fmt(t.removeTitle, name)}>
      <form action={action} className="flex flex-col gap-4">
        <p className="text-muted">{fmt(t.removeBody, name)}</p>
        <FormAlert state={state} />
        <input type="hidden" name="userId" value={person.id} />
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => setShown(false)}>
            {fmt(t.keep, name)}
          </Button>
          <SubmitButton variant="danger">{fmt(t.removeConfirm, name)}</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}
