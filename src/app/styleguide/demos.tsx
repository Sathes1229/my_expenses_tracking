'use client';

// Interactive specimens for the styleguide. Every control here does something visible,
// so each one can be checked by pressing it.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/button';
import { Dialog } from '@/components/dialog';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { CameraIcon, PlusIcon } from '@/components/icons';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm text-muted">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function Feedback({ children }: { children: ReactNode }) {
  return (
    <p aria-live="polite" className="mt-3 min-h-6 text-sm text-muted">
      {children}
    </p>
  );
}

export function ButtonsDemo() {
  const [pressed, setPressed] = useState('');
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function save() {
    setSaving(true);
    setPressed('');
    timer.current = setTimeout(() => {
      setSaving(false);
      setPressed('Saved. The button is ready again.');
    }, 2000);
  }

  return (
    <div className="flex flex-col gap-6">
      <Row label="Variants: primary, secondary, danger, quiet">
        <Button onClick={() => setPressed('Pressed: Save transaction (primary)')}>Save transaction</Button>
        <Button variant="secondary" onClick={() => setPressed('Pressed: Edit (secondary)')}>
          Edit
        </Button>
        <Button variant="danger" onClick={() => setPressed('Pressed: Delete (danger)')}>
          Delete
        </Button>
        <Button variant="quiet" onClick={() => setPressed('Pressed: Cancel (quiet)')}>
          Cancel
        </Button>
      </Row>
      <Row label="With an icon, where the icon is faster to read than the word alone">
        <Button onClick={() => setPressed('Pressed: Add manually')}>
          <PlusIcon />
          Add manually
        </Button>
        <Button variant="secondary" onClick={() => setPressed('Pressed: Scan receipt')}>
          <CameraIcon />
          Scan receipt
        </Button>
      </Row>
      <Row label="Disabled">
        <Button disabled>Save transaction</Button>
        <Button variant="secondary" disabled>
          Edit
        </Button>
        <Button variant="danger" disabled>
          Delete
        </Button>
        <Button variant="quiet" disabled>
          Cancel
        </Button>
      </Row>
      <Row label="Pending: presses are ignored, focus stays on the button">
        <Button pending>Saving</Button>
        <Button variant="danger" pending>
          Deleting
        </Button>
        <Button variant="secondary" pending={saving} onClick={save}>
          {saving ? 'Saving' : 'Save, takes 2 seconds'}
        </Button>
      </Row>
      <Feedback>{pressed}</Feedback>
    </div>
  );
}

export function EmptyStateDemo() {
  const [pressed, setPressed] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <EmptyState
        title="No budgets yet."
        action={
          <Button onClick={() => setPressed(true)}>
            <PlusIcon />
            Add a budget
          </Button>
        }
      >
        Budgets you add show here, with how much is left this month.
      </EmptyState>
      <EmptyState title="No budgets have been set up yet." />
      <Feedback>{pressed ? 'Pressed: Add a budget' : ''}</Feedback>
    </div>
  );
}

export function ErrorStateDemo() {
  const [tries, setTries] = useState(0);
  return (
    <div className="flex flex-col gap-4">
      <ErrorState title="Could not load this month's budgets." retry={() => setTries((n) => n + 1)}>
        If it keeps failing, check that the computer running My Expenses is switched on.
      </ErrorState>
      <ErrorState title="This transaction could not be found.">It may have been deleted.</ErrorState>
      <Feedback>{tries > 0 ? `Pressed: Try again (${tries})` : ''}</Feedback>
    </div>
  );
}

export function DialogDemo() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState('');
  return (
    <div>
      <Button
        variant="secondary"
        onClick={() => {
          setResult('');
          setOpen(true);
        }}
      >
        Delete a sample transaction
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Delete this transaction?">
        <p className="text-muted">It comes off this month&apos;s totals. This cannot be undone.</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Keep it
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setResult('Pressed: Delete. This is a preview, so nothing was deleted.');
              setOpen(false);
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>
      <Feedback>{result}</Feedback>
    </div>
  );
}
