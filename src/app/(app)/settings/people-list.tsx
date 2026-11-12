'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/button';
import { CopyField } from '@/components/copy-field';
import { Dialog } from '@/components/dialog';
import { EmptyState } from '@/components/empty-state';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import type { Person } from '@/lib/auth/people';
import { initialFormState } from '@/lib/form-state';
import { changeRoleAction, removePersonAction, resetPasswordAction, type ResetFormState } from './actions';

const ROLE_WORD = { owner: 'Owner', member: 'Member', guest: 'Guest' } as const;

type Notice = { text: string; moveFocus: boolean };

/** What changed between two versions of the list, said in a sentence. */
function describeChange(before: Person[], after: Person[]): Notice | null {
  const removed = before.find((p) => !after.some((q) => q.id === p.id));
  if (removed) return { text: `${removed.displayName} was removed.`, moveFocus: true };
  const changed = after.find((p) => before.some((q) => q.id === p.id && q.role !== p.role));
  if (changed) return { text: `${changed.displayName} is now a ${changed.role}.`, moveFocus: false };
  return null;
}

export function PeopleList({ people }: { people: Person[] }) {
  // The list comes fresh from the server after each change; compare with the last one to say what happened.
  const [shown, setShown] = useState(people);
  const [notice, setNotice] = useState<Notice | null>(null);
  if (people !== shown) {
    setShown(people);
    const change = describeChange(shown, people);
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
        People
      </h2>
      <p className="mt-1 text-muted">
        Members see all household spending. Guests see budget names and what is left, plus only their own
        entries.
      </p>
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
          <EmptyState title="No one else uses the app yet.">
            Create an invite below for family (Member) or friends (Guest).
          </EmptyState>
        </div>
      )}
    </>
  );
}

function PersonRow({ person }: { person: Person }) {
  const isOwner = person.role === 'owner';
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 py-1">
        <p className="font-medium break-words text-ink">
          {person.displayName}
          {isOwner && <span className="font-normal text-muted"> (you)</span>}
        </p>
        <p className="text-sm break-all text-muted">
          {ROLE_WORD[person.role]}
          <span aria-hidden="true"> · </span>
          <span className="sr-only">, username </span>
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

/** Two roles only, so one press switches to the other. Undo is the same button. */
function RoleForm({ person }: { person: Person }) {
  const [state, action] = useActionState(changeRoleAction, initialFormState);
  const next = person.role === 'member' ? 'guest' : 'member';
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={person.id} />
      <input type="hidden" name="role" value={next} />
      <SubmitButton variant="quiet">
        Make {next}
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

/**
 * Opens a confirmation. The dialog is mounted only while open, so a temporary password never
 * outlives it. Its buttons close the native dialog first (shown = false): the browser then puts
 * focus back on the button that opened it, and the close event unmounts it through onClose.
 */
function ResetPassword({ person }: { person: Person }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="quiet" onClick={() => setOpen(true)}>
        Reset password
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
  const name = person.displayName;

  if (state.tempPassword) {
    return (
      <Dialog open={shown} onClose={onClose} title={`Temporary password for ${name}`}>
        <p className="text-muted">
          {name} is signed out everywhere. Give them this password. They choose their own the next time
          they sign in. It is shown only now.
        </p>
        <div className="mt-4">
          <CopyField label="Temporary password" value={state.tempPassword} mono autoFocus />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={close}>Done</Button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open={shown} onClose={onClose} title={`Reset ${name}'s password?`}>
      <form action={action} className="flex flex-col gap-4">
        <p className="text-muted">
          {name} is signed out on every device and their current password stops working. You get a
          temporary password to give them.
        </p>
        <FormAlert state={state} />
        <input type="hidden" name="userId" value={person.id} />
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <SubmitButton variant="danger">Reset password</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}

function RemovePerson({ person }: { person: Person }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="quiet" onClick={() => setOpen(true)}>
        Remove
        <span className="sr-only"> ({person.displayName})</span>
      </Button>
      {open && <RemoveDialog person={person} onClose={() => setOpen(false)} />}
    </>
  );
}

function RemoveDialog({ person, onClose }: { person: Person; onClose: () => void }) {
  const [state, action] = useActionState(removePersonAction, initialFormState);
  const [shown, setShown] = useState(true);
  const name = person.displayName;
  // On success the row, and this dialog with it, leaves the page; the list says who was removed.
  return (
    <Dialog open={shown} onClose={onClose} title={`Remove ${name}?`}>
      <form action={action} className="flex flex-col gap-4">
        <p className="text-muted">
          {name} is signed out now and can no longer sign in. The transactions they added stay, under their
          name, so totals do not change.
        </p>
        <FormAlert state={state} />
        <input type="hidden" name="userId" value={person.id} />
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => setShown(false)}>
            Keep {name}
          </Button>
          <SubmitButton variant="danger">Remove {name}</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}
