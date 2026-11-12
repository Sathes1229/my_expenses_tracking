'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/button';
import { Dialog } from '@/components/dialog';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/form-state';
import { deleteTransactionAction } from './actions';

/** Delete with a confirmation. On success the action redirects to the list. */
export function DeleteTransaction({ id, merchant, month }: { id: string; merchant: string; month: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Delete
        <span className="sr-only"> transaction at {merchant}</span>
      </Button>
      {open && <DeleteDialog id={id} merchant={merchant} month={month} onClose={() => setOpen(false)} />}
    </>
  );
}

function DeleteDialog({ id, merchant, month, onClose }: { id: string; merchant: string; month: string; onClose: () => void }) {
  const [state, action] = useActionState(deleteTransactionAction, initialFormState);
  return (
    <Dialog open onClose={onClose} title={`Delete the transaction at ${merchant}?`}>
      <form action={action} className="flex flex-col gap-4">
        <p className="text-muted">It is removed for everyone and no longer counts toward a budget. This cannot be undone.</p>
        <FormAlert state={state} />
        <input type="hidden" name="transactionId" value={id} />
        <input type="hidden" name="month" value={month} />
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Keep it
          </Button>
          <SubmitButton variant="danger">Delete transaction</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}
