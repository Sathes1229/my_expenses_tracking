'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/button';
import { Dialog } from '@/components/dialog';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { useMessages } from '@/i18n/client';
import { fmt } from '@/i18n/format';
import { initialFormState } from '@/lib/form-state';
import { deleteTransactionAction } from './actions';

/** Delete with a confirmation. On success the action redirects to the list. */
export function DeleteTransaction({ id, merchant, month }: { id: string; merchant: string; month: string }) {
  const [open, setOpen] = useState(false);
  const t = useMessages().transactions.delete;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t.button}
        <span className="sr-only"> {fmt(t.buttonDetail, { merchant })}</span>
      </Button>
      {open && <DeleteDialog id={id} merchant={merchant} month={month} onClose={() => setOpen(false)} />}
    </>
  );
}

function DeleteDialog({ id, merchant, month, onClose }: { id: string; merchant: string; month: string; onClose: () => void }) {
  const [state, action] = useActionState(deleteTransactionAction, initialFormState);
  const t = useMessages().transactions.delete;
  return (
    <Dialog open onClose={onClose} title={fmt(t.title, { merchant })}>
      <form action={action} className="flex flex-col gap-4">
        <p className="text-muted">{t.body}</p>
        <FormAlert state={state} />
        <input type="hidden" name="transactionId" value={id} />
        <input type="hidden" name="month" value={month} />
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            {t.keep}
          </Button>
          <SubmitButton variant="danger">{t.confirm}</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}
