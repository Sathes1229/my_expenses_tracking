'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { CloseIcon } from './icons';

type DialogProps = {
  open: boolean;
  /** Called once the dialog has closed: Escape, the close button, or `open` set to false. */
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/**
 * A modal on the native <dialog>: the browser traps focus, closes it on Escape and
 * returns focus to the control that opened it. The only surface with a shadow, because
 * it is the only one that sits above the page.
 */
export function Dialog({ open, onClose, title, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    if (!dialog.open) dialog.showModal();
    // If the page is hidden by a route change or unmounted while the dialog is open,
    // leave the top layer; a modal left open would keep the next page inert.
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // The native close event is queued, so check the dialog is still closed: in development
      // React runs effects twice and the dialog may already be open again.
      onClose={() => {
        if (!ref.current?.open) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-surface border border-line bg-surface p-5 text-ink shadow-overlay backdrop:bg-[rgb(0_0_0/0.45)]"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id={titleId} className="pt-2 text-lg font-semibold">
          {title}
        </h2>
        <button
          type="button"
          aria-label="Close"
          onClick={() => ref.current?.close()}
          className="-mt-1 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-control text-muted transition-state hover:bg-sunken hover:text-ink"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="mt-3">{children}</div>
    </dialog>
  );
}
