'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react';
import { Button } from '@/components/button';
import { cx } from '@/components/cx';
import { CameraIcon } from '@/components/icons';
import { BesidePhoto, ReceiptPhoto } from '@/components/receipt-photo';
import { TransactionForm } from '@/components/transaction-form';
import type { ReceiptDraft } from '@/lib/receipt-draft';
import type { TransactionInput } from '@/lib/transaction-types';
import { createTransactionAction } from '../actions';

const ACCEPT = 'image/jpeg,image/png,image/webp';
const NOT_SENT = 'The photo could not be sent. Check the connection and try again.';

type Reason = 'not_configured' | 'unreadable' | 'provider_error';

/** What POST /api/receipts answers. Over JSON the date is a string until it is made a Date again. */
type Answer = {
  uploadId: string;
  draft: { initial: Omit<ReceiptDraft['initial'], 'occurredAt'> & { occurredAt?: string }; warnings: string[] } | null;
  reason?: Reason;
};

type Phase =
  | { step: 'pick'; error?: string; signedOut?: boolean; again?: boolean }
  | { step: 'reading'; preview: string }
  | { step: 'review'; preview: string; uploadId: string; initial: Partial<TransactionInput>; warnings: string[]; reason?: Reason };

function startingValues(answer: Answer): Partial<TransactionInput> {
  // Nothing read: the same starting point as Add manually.
  if (!answer.draft) return { occurredAt: new Date() };
  const { occurredAt, ...rest } = answer.draft.initial;
  return occurredAt ? { ...rest, occurredAt: new Date(occurredAt) } : rest;
}

function errorText(answer: unknown): string {
  if (typeof answer === 'object' && answer !== null && 'error' in answer && typeof answer.error === 'string') return answer.error;
  return NOT_SENT;
}

/**
 * Pick or take a photo, wait while it is read, then check the filled-in form beside the photo.
 * The upload is stored as soon as it is picked, but nothing becomes a transaction until Save.
 */
export function ReceiptScanner({ budgets, isOwner }: { budgets: { id: string; name: string }[]; isOwner: boolean }) {
  const [phase, setPhase] = useState<Phase>({ step: 'pick' });
  const statusRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const chooseRef = useRef<HTMLInputElement>(null);

  // The local copy of the photo is freed once it is no longer on screen.
  const preview = phase.step === 'pick' ? null : phase.preview;
  useEffect(() => (preview ? () => URL.revokeObjectURL(preview) : undefined), [preview]);

  // The picker buttons go away while reading, so focus is put somewhere useful when the step changes.
  useEffect(() => {
    if (phase.step === 'review') statusRef.current?.focus();
    else if (phase.step === 'pick' && phase.error) errorRef.current?.focus();
    else if (phase.step === 'pick' && phase.again) chooseRef.current?.focus();
  }, [phase]);

  async function read(file: File) {
    const local = URL.createObjectURL(file);
    setPhase({ step: 'reading', preview: local });
    const body = new FormData();
    body.append('image', file);
    try {
      const res = await fetch('/api/receipts', { method: 'POST', body });
      const answer: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setPhase({ step: 'pick', error: errorText(answer), signedOut: res.status === 401 });
        return;
      }
      const a = answer as Answer;
      setPhase({
        step: 'review',
        preview: local,
        uploadId: a.uploadId,
        initial: startingValues(a),
        warnings: a.draft?.warnings ?? [],
        reason: a.draft ? undefined : a.reason,
      });
    } catch {
      setPhase({ step: 'pick', error: NOT_SENT });
    }
  }

  return (
    <div className="mt-6">
      {/* One live region for the whole flow, so "Reading" and the outcome are both announced. Takes no room while empty. */}
      <div ref={statusRef} tabIndex={-1} role="status" className="mb-6 w-fit max-w-xl empty:mb-0">
        <Status phase={phase} isOwner={isOwner} />
      </div>

      {phase.step === 'pick' && (
        <div className="flex max-w-xl flex-col gap-4">
          <p className="text-ink">
            Photograph the whole receipt, flat and in good light. What can be read from it fills in the form for you to
            check. Nothing is saved until you press Save transaction.
          </p>
          {phase.error && (
            <p
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className="rounded-control border border-danger bg-surface px-3 py-2.5 text-sm font-medium text-danger"
            >
              {phase.error}
              {phase.signedOut && (
                <>
                  {' '}
                  <Link href="/login">Sign in</Link>
                </>
              )}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {/* Opens the camera straight away, so it is only offered where there is one: phones and tablets. */}
            <PhotoPicker label="Take a photo" camera onPick={read} className="hidden pointer-coarse:flex" />
            <PhotoPicker label="Choose a photo" onPick={read} inputRef={chooseRef} />
          </div>
          <p className="text-sm text-muted">JPEG, PNG or WebP, up to 15 MB. Reading starts as soon as you pick one.</p>
          <Link href="/transactions/new" className="inline-flex min-h-11 w-fit items-center">
            Type it in without a photo
          </Link>
        </div>
      )}

      {phase.step === 'reading' && (
        <div className="w-full max-w-xs">
          <ReceiptPhoto src={phase.preview} alt="The receipt photo being read" fullSizeLink={false} />
        </div>
      )}

      {phase.step === 'review' && (
        <BesidePhoto
          photo={
            <>
              <ReceiptPhoto
                src={phase.preview}
                alt={phase.initial.merchant ? `Receipt from ${phase.initial.merchant}` : 'The receipt photo you chose'}
              />
              <div>
                <Button variant="secondary" onClick={() => setPhase({ step: 'pick', again: true })}>
                  Use a different photo
                </Button>
              </div>
            </>
          }
        >
          <TransactionForm
            key={phase.uploadId}
            action={createTransactionAction}
            budgets={budgets}
            initial={phase.initial}
            warnings={phase.warnings}
            hidden={{ receiptUploadId: phase.uploadId }}
            submitLabel="Save transaction"
            cancelHref="/transactions"
          />
        </BesidePhoto>
      )}
    </div>
  );
}

function Status({ phase, isOwner }: { phase: Phase; isOwner: boolean }) {
  if (phase.step === 'reading') {
    return (
      <div>
        <p className="flex items-center gap-2 font-semibold text-ink">
          <span
            aria-hidden="true"
            className="size-4 shrink-0 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin"
          />
          Reading your receipt…
        </p>
        <p className="mt-1 text-muted">This can take up to a minute.</p>
      </div>
    );
  }
  if (phase.step !== 'review') return null;
  if (!phase.reason) return <p className="text-ink">Filled in from the photo. Check each field against the receipt, then save.</p>;
  let why: ReactNode;
  if (phase.reason === 'not_configured') {
    why = isOwner ? (
      <>
        Receipt reading is not set up yet, so type the details in below, or choose a receipt model in{' '}
        <Link href="/settings/ai">AI settings</Link>.
      </>
    ) : (
      'Receipt reading is not set up yet, so type the details in below.'
    );
  } else if (phase.reason === 'unreadable') {
    why = 'The photo could not be read as a receipt, so type the details in below.';
  } else {
    why = 'The AI service did not answer, so type the details in below.';
  }
  return <p className="rounded-control border border-line-strong bg-surface px-3 py-3 text-ink">{why}</p>;
}

const pickerLook = cx(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 py-2 text-center text-base font-medium transition-state active:translate-y-px',
  // The input itself is visually hidden, so its focus ring is drawn on the label that stands for it.
  'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
);
const primaryLook = 'bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-hover';
// Second to "Take a photo" on touch screens; the only way in with a mouse, so primary there.
const chooseLook =
  'border border-line-strong bg-surface text-ink hover:bg-sunken active:bg-sunken ' +
  'pointer-fine:border-transparent pointer-fine:bg-accent pointer-fine:text-on-accent pointer-fine:hover:bg-accent-hover pointer-fine:active:bg-accent-hover';

/** A file input under a visible label styled as a button; the label is what people see and press. */
function PhotoPicker({
  label,
  camera = false,
  onPick,
  className,
  inputRef,
}: {
  label: string;
  camera?: boolean;
  onPick: (file: File) => void;
  className?: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const id = useId();
  return (
    <div className={className}>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={ACCEPT}
        capture={camera ? 'environment' : undefined}
        className="peer sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared so the same photo can be picked again after an error.
          event.target.value = '';
          if (file) onPick(file);
        }}
      />
      <label htmlFor={id} className={cx(pickerLook, camera ? primaryLook : chooseLook)}>
        {camera && <CameraIcon />}
        {label}
      </label>
    </div>
  );
}
