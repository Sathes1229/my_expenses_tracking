'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type Ref } from 'react';
import { Button } from '@/components/button';
import { cx } from '@/components/cx';
import { Dialog } from '@/components/dialog';
import { EmptyState } from '@/components/empty-state';
import { controlClass } from '@/components/field';
import { SubmitButton } from '@/components/submit-button';
import { initialFormState } from '@/lib/form-state';
import { clearChatAction } from './actions';
import { refuse, shown, startGate, withReading, type Availability, type ChatGate } from './availability';

export type ShownMessage = { id: string; role: 'user' | 'assistant'; content: string };

type Pending = { id: string; question: string; answer: string };
type Problem = { text: string; signedOut?: boolean };

const NOT_SENT = 'Your question could not be sent. Check the connection, then send it again.';
const NO_ANSWER = 'The assistant could not answer just now. Your question is back in the box, so you can send it again.';

/** What an error code from POST /api/chat means for the person asking. */
function problemFor(code: unknown, maxChars: number): Problem {
  if (code === 'provider_error') return { text: NO_ANSWER };
  if (code === 'signed_out') return { text: 'You are signed out. Sign in again, then send your question.', signedOut: true };
  if (code === 'invalid_message') {
    return { text: `That question could not be sent. Keep it to ${maxChars.toLocaleString('en')} characters or fewer.` };
  }
  return { text: 'Your question could not be sent. Reload the page, then send it again.' };
}

/**
 * The conversation and the question box. Answers stream in below the list and join it only when
 * complete, so the list (a log region) announces each answer once instead of word by word.
 * Nothing is saved for a question that fails, so its text goes back in the box.
 */
export function Chat({
  initialMessages,
  availability,
  isOwner,
  maxChars,
}: {
  initialMessages: ShownMessage[];
  availability: Availability;
  isOwner: boolean;
  maxChars: number;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  // A refused send shows at once; the page's next different reading replaces it (see withReading).
  const [gate, setGate] = useState<ChatGate>(() => startGate(availability));
  const current = withReading(gate, availability);
  if (current !== gate) setGate(current);
  const [clearing, setClearing] = useState(false);
  const state = shown(current);

  const inflight = useRef<AbortController | null>(null);
  const nextId = useRef(0);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const hadHistory = useRef(initialMessages.length > 0);
  const wasReady = useRef(state === 'ready');
  const justCleared = useRef(false);
  const headingId = useId();
  const fieldId = useId();

  // Leaving the page stops the answer; the server then saves nothing.
  useEffect(() => () => inflight.current?.abort(), []);

  // Open at the latest exchange and the question box, as a conversation is read.
  useEffect(() => {
    if (hadHistory.current) endRef.current?.scrollIntoView({ block: 'end' });
  }, []);

  // The box is replaced by a notice when the assistant stops; focus goes to the notice so it is read.
  useEffect(() => {
    if (state !== 'ready' && wasReady.current) noticeRef.current?.focus();
    wasReady.current = state === 'ready';
  }, [state]);

  // After clearing, the button that opened the dialog is gone, so focus moves somewhere useful.
  useEffect(() => {
    if (clearing || !justCleared.current) return;
    justCleared.current = false;
    (fieldRef.current ?? noticeRef.current ?? headingRef.current)?.focus();
  }, [clearing]);

  function giveBack(question: string, next: Problem) {
    setPending(null);
    setDraft(question);
    setProblem(next);
    fieldRef.current?.focus();
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const question = draft.trim();
    if (!question) {
      setFieldError('Type a question first.');
      fieldRef.current?.focus();
      return;
    }
    setFieldError(null);
    setProblem(null);
    setDraft('');
    const id = `local-${nextId.current++}`;
    setPending({ id, question, answer: '' });
    const controller = new AbortController();
    inflight.current = controller;

    let res: Response;
    try {
      res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: question }),
        signal: controller.signal,
      });
    } catch {
      if (!controller.signal.aborted) giveBack(question, { text: NOT_SENT });
      return;
    }

    if (!res.ok || !res.body) {
      const code: unknown = await res.json().then((body) => body?.error, () => null);
      if (code === 'budget_used' || code === 'not_configured') {
        setPending(null);
        setDraft(question);
        setGate((g) => refuse(g, code === 'budget_used' ? 'used_up' : 'not_configured'));
        router.refresh(); // the budget line above the conversation
      } else {
        giveBack(question, problemFor(code, maxChars));
      }
      return;
    }

    let answer = '';
    try {
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += value;
        setPending({ id, question, answer });
      }
    } catch {
      // The server breaks the stream when the provider fails part way, and saves nothing.
      if (!controller.signal.aborted) giveBack(question, { text: NO_ANSWER });
      return;
    }
    // The question keeps its key, so only the answer is new to the log and only it is announced.
    setMessages((prev) => [
      ...prev,
      { id, role: 'user', content: question },
      { id: `local-${nextId.current++}`, role: 'assistant', content: answer },
    ]);
    setPending(null);
    router.refresh(); // the budget line, and the box if this answer used up the day
  }

  function sendOnCtrlEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const describedBy = [fieldError && `${fieldId}-error`, `${fieldId}-note`].filter(Boolean).join(' ');
  // With nothing to show and no way to ask, the notice below says all there is.
  const showConversation = state === 'ready' || messages.length > 0;

  return (
    <>
      <section aria-labelledby={headingId} hidden={!showConversation} className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 ref={headingRef} id={headingId} tabIndex={-1} className="text-lg font-semibold text-ink">
            Conversation
          </h2>
          {messages.length > 0 && !pending && (
            <Button variant="secondary" onClick={() => setClearing(true)}>
              Clear conversation
            </Button>
          )}
        </div>

        {messages.length === 0 && !pending && (
          <div className="mt-3">
            <EmptyState title="No questions yet.">
              Try asking which budget is running out fastest this month, or where you could spend less.
            </EmptyState>
          </div>
        )}

        <div role="log" aria-labelledby={headingId}>
          {(messages.length > 0 || pending) && (
            <ol className="mt-4 flex flex-col gap-5">
              {messages.map((m) => (
                <Message key={m.id} role={m.role} content={m.content} />
              ))}
              {pending && <Message key={pending.id} role="user" content={pending.question} />}
            </ol>
          )}
        </div>

        {/* Outside the log on purpose: the words arrive here without being read out one by one. */}
        {pending && (
          <div className="mt-5">
            <p className="text-sm font-medium text-muted">Assistant</p>
            {pending.answer ? (
              <p className="mt-1 break-words whitespace-pre-wrap text-ink">{pending.answer}</p>
            ) : (
              <p className="mt-1 flex items-center gap-2 text-muted">
                <span
                  aria-hidden="true"
                  className="size-4 shrink-0 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin"
                />
                Writing an answer…
              </p>
            )}
          </div>
        )}
        <p role="status" className="sr-only">
          {pending ? 'The assistant is writing an answer.' : ''}
        </p>
      </section>

      <div ref={endRef}>
        {state === 'ready' ? (
          <form onSubmit={send} noValidate className="mt-8 flex flex-col gap-1.5">
            {problem && (
              <p
                role="alert"
                className="mb-2 rounded-control border border-danger bg-surface px-3 py-2.5 text-sm font-medium text-danger"
              >
                {problem.text}
                {problem.signedOut && (
                  <>
                    {' '}
                    <Link href="/login">Sign in</Link>
                  </>
                )}
              </p>
            )}
            <label htmlFor={fieldId} className="text-sm font-medium text-ink">
              Your question
            </label>
            {fieldError && (
              <p id={`${fieldId}-error`} className="text-sm font-medium text-danger">
                <span className="sr-only">Error: </span>
                {fieldError}
              </p>
            )}
            <textarea
              ref={fieldRef}
              id={fieldId}
              name="message"
              rows={3}
              maxLength={maxChars}
              value={draft}
              readOnly={pending !== null}
              onChange={(event) => {
                setDraft(event.target.value);
                if (fieldError) setFieldError(null);
              }}
              onKeyDown={sendOnCtrlEnter}
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={describedBy}
              className={cx(controlClass(fieldError ?? undefined), 'resize-y py-2.5 leading-normal')}
            />
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <p id={`${fieldId}-note`} className="text-sm text-muted">
                Suggestions only, not professional financial advice.
              </p>
              <Button type="submit" pending={pending !== null}>
                Send
              </Button>
            </div>
          </form>
        ) : (
          <Unavailable ref={noticeRef} state={state} isOwner={isOwner} unsent={draft.trim()} />
        )}
      </div>

      {clearing && (
        <ClearDialog
          onClose={() => setClearing(false)}
          onCleared={() => {
            justCleared.current = true;
            setMessages([]);
            setClearing(false);
          }}
        />
      )}
    </>
  );
}

function Message({ role, content }: { role: ShownMessage['role']; content: string }) {
  const mine = role === 'user';
  return (
    <li className={cx('max-w-[85%] min-w-0', mine ? 'self-end rounded-surface bg-sunken px-4 py-3' : 'self-start')}>
      <p className="text-sm font-medium text-muted">{mine ? 'You' : 'Assistant'}</p>
      <p className="mt-1 break-words whitespace-pre-wrap text-ink">{content}</p>
    </li>
  );
}

function Unavailable({
  ref,
  state,
  isOwner,
  unsent,
}: {
  ref: Ref<HTMLDivElement>;
  state: Exclude<Availability, 'ready'>;
  isOwner: boolean;
  unsent: string;
}) {
  return (
    <div ref={ref} tabIndex={-1} className="mt-8 rounded-surface border border-line-strong bg-surface px-5 py-4">
      {state === 'used_up' ? (
        <>
          <p className="font-semibold text-ink">Today&apos;s assistant budget is used up. It will be available again tomorrow.</p>
          {isOwner && (
            <p className="mt-1 text-muted">
              To let everyone carry on today, reset today&apos;s usage or raise the daily limit in{' '}
              <Link href="/settings/ai">AI settings</Link>.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="font-semibold text-ink">The assistant isn&apos;t set up yet.</p>
          {isOwner && (
            <p className="mt-1 text-muted">
              Choose a model for the assistant in <Link href="/settings/ai">AI settings</Link>. If no AI key has been
              added yet, that page shows how.
            </p>
          )}
        </>
      )}
      {unsent && (
        <>
          <p className="mt-4 text-sm font-medium text-muted">Your question was not sent:</p>
          <p className="mt-1 break-words whitespace-pre-wrap text-ink">{unsent}</p>
        </>
      )}
    </div>
  );
}

function ClearDialog({ onClose, onCleared }: { onClose: () => void; onCleared: () => void }) {
  const [state, action] = useActionState(clearChatAction, initialFormState);
  const cleared = useRef(onCleared);
  useEffect(() => {
    if (state.done) cleared.current();
  }, [state.done]);
  return (
    <Dialog open onClose={onClose} title="Clear this conversation?">
      <form action={action} className="flex flex-col gap-4">
        <p className="text-muted">
          Your questions and the answers are deleted. Nobody else can see them, and this cannot be undone.
        </p>
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Keep it
          </Button>
          <SubmitButton variant="danger">Clear conversation</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}
