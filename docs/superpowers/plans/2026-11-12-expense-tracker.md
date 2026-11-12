# Family Expense Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a household expense tracker (budgets, receipt scanning, manual entries, debts, invites with roles, AI assistant with a daily chat budget) that runs on the owner's PC for the home network and later in Docker on their server.

**Architecture:** One Next.js App Router app. All data access goes through functions in `src/lib/` that take a `Viewer` (who is asking, and their role) and enforce visibility there; pages, server actions and route handlers are thin wrappers and never query the database directly. SQLite file via Drizzle. Money is stored as integer sen, AI cost as integer micro-USD.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Drizzle ORM + better-sqlite3, Better Auth (username plugin), AI SDK 7 (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/deepseek`), Zod 4, sharp, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-12-expense-tracker-design.md`. Read it before any task.

## Global Constraints

- **Library versions are newer than most training data** (Next 16, AI SDK 7, Better Auth 1.7, Zod 4, Tailwind 4, Vitest 5). Read the installed package's current official docs before using its API. Do not write these APIs from memory.
- **Anthropic model IDs and prices:** load the `claude-api` skill before choosing them. Never from memory.
- **Secrets:** all keys live in `.env`; `.env.example` is committed with empty values; never log or render a key. Before every commit run `git status --short` and confirm no `.env`, `data/`, or upload file is staged.
- **Commits:** after each task, commit and `git push origin main`. End commit messages with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- **Visibility is enforced in `src/lib/`**, on the server, for every query. Hiding something in the UI is never the only protection.
- **Timezone:** `Asia/Kuala_Lumpur` for "today", "this month" and receipt dates. Months are calendar months.
- **Currency:** RM for expenses, stored as integer sen. AI budget in USD, stored as integer micro-USD.
- **Server binds to `0.0.0.0`** in dev and production. Default port 3000.
- **UI rules:** before any UI work load the `antislop` skill plus `antislop-ui`, `antislop-layoutmobile`, `antislop-copywriting`, `antislop-human` (mode: `during`, from global preference). Direction: calm and plain like a banking app, must not look AI-generated; dials ENERGY 1 / RHYTHM 2 / MOTION 1. No em dash in any UI text. Mobile-first; tap targets at least 44px; WCAG AA contrast in light and dark; every data view has empty, loading and error states; every control works and is keyboard reachable.
- **UI text is English.** App name is the plain text "My Expenses". No generated logo.
- **Do not change Windows firewall or other system settings.** Document the command for the owner instead.

## Review Focus

Inputs the spec implies but does not spell out, most likely to bite first. Each has a pinning test in the task named.

1. **Receipt photos as phones produce them:** 12 MB images, HEIC, a photo that is not a receipt. Expected: image is shrunk and re-encoded, unsupported types get a clear message, and the form still opens for typing. (Task 11)
2. **AI output that disagrees with itself:** items that do not add up to the total, missing date, negative quantity, a budget name that does not exist. Expected: the review form shows what was read with a visible warning; nothing is saved without the user confirming. (Task 11)
3. **Money typed the way people type it:** `12`, `12.5`, `1,234.50`, `RM12.50`, `12.345`, `-5`, empty. Expected: parsed exactly to sen or rejected with a message; no floating point drift. (Task 1)
4. **Month edges and moved transactions:** a purchase at 00:30 on the 1st (Malaysia time) counts in the new month; editing a transaction's date or budget updates both the old and new budget and month. (Tasks 1, 6, 7)
5. **Access that changes while someone is logged in:** a removed person, or a member changed to guest, loses access on their next request; an invite link that is expired, used, or opened by two people at once. (Task 4)

## Phases (owner's request)

The tasks are built one at a time, grouped into four phases. **Work stops at the end of each phase.** The owner opens the app, tries what that phase added, and says to continue before the next phase starts. Each task is still committed and pushed as it finishes.

| Phase | Tasks | What the owner can try at the end |
|---|---|---|
| **1. Foundation and login** | 1 to 4 | Open the app on this PC, create the owner account, see the look in light and dark, invite one person as Member and one as Guest, sign in as each, reset a password, remove a person. |
| **2. Money tracking** | 5 to 9 | Set budgets with thresholds, add expenses by hand, get a warning when a budget passes its threshold, record debts and part payments, and see it all on the dashboard as owner, member and guest. |
| **3. AI features** | 10 to 12 | Choose the AI provider, scan a real receipt and correct it before saving, chat with the assistant, set the daily assistant budget and reset it. Needs at least one Anthropic or OpenAI key in `.env`. |
| **4. Ready for the server** | 13 to 14 | Run it in Docker, read the README, use it from a phone on home Wi-Fi, and read the final check report. |

At each phase end, report to the owner: what was built, what to click to try it, anything not verified, and what the next phase adds.

---

## File Structure

```
src/
  app/
    layout.tsx, globals.css
    setup/, login/, invite/[token]/, reset-owner/, change-password/   signed-out pages
    (app)/layout.tsx          signed-in shell: nav, bell, theme toggle, role guard
    (app)/page.tsx            dashboard
    (app)/transactions/       list, new, [id]
    (app)/budgets/  (app)/debts/  (app)/assistant/  (app)/notifications/
    (app)/settings/           people, ai, profile
    api/auth/[...all]/route.ts   api/receipts/route.ts   api/receipts/[id]/route.ts   api/chat/route.ts
    styleguide/page.tsx       component preview, development only
  components/                 Button, Field, Select, Money, Meter, StateTag, EmptyState, ErrorState, Dialog, ThemeToggle, PageHeader, icons
  db/schema.ts  db/client.ts  db/migrate.ts
  lib/
    env.ts  errors.ts  money.ts  time.ts  uploads.ts
    auth/auth.ts  auth/viewer.ts  auth/accounts.ts  auth/throttle.ts  auth/owner-reset.ts  auth/invites.ts  auth/people.ts
    budgets.ts  transactions.ts  notifications.ts  debts.ts  dashboard.ts
    ai/models.ts  ai/providers.ts  ai/settings.ts  ai/receipt.ts  ai/budget.ts  ai/context.ts  ai/chat.ts
tests/                        mirrors src/lib, plus tests/helpers/db.ts
```

Shared types used across tasks (defined where noted, imported everywhere else):

```ts
// src/lib/auth/viewer.ts
export type Role = 'owner' | 'member' | 'guest';
export type Viewer = { id: string; role: Role; displayName: string };
// src/lib/errors.ts
export class ForbiddenError extends Error {}
export class ValidationError extends Error { constructor(public field: string, message: string) }
```

---

### Task 1: Project foundation

**Files:**
- Create: Next.js app at repo root (keep existing `.gitignore` and `docs/`), `.env.example`, `vitest.config.ts`, `src/lib/env.ts`, `src/lib/errors.ts`, `src/lib/money.ts`, `src/lib/time.ts`, `src/db/schema.ts`, `src/db/client.ts`, `src/db/migrate.ts`, `drizzle.config.ts`, `tests/helpers/db.ts`
- Test: `tests/money.test.ts`, `tests/time.test.ts`, `tests/db.test.ts`

**Produces:**
- `env`: `{ DATABASE_PATH (default ./data/app.db), UPLOADS_DIR (default ./data/uploads), BETTER_AUTH_SECRET, APP_URL, ANTHROPIC_API_KEY?, OPENAI_API_KEY?, DEEPSEEK_API_KEY?, OWNER_RESET_TOKEN? }`. Empty strings count as unset.
- `parseRM(text: string): number | null`, `formatRM(sen: number): string`
- `TZ = 'Asia/Kuala_Lumpur'`, `monthKey(d: Date): string` ("2026-11"), `dayKey(d: Date): string` ("2026-11-12"), `monthRange(month: string): { start: Date; end: Date }` (end exclusive), `fromLocalDateTime(date: string, time: string): Date`, `monthLabel(month: string): string` ("November 2026")
- `db` (Drizzle instance), `runMigrations(): void`, test helper `resetDb(): Promise<void>` (empties every table)
- npm scripts: `dev` (`next dev -H 0.0.0.0`), `build`, `start` (`next start -H 0.0.0.0`), `test` (`vitest run`), `db:generate`, `db:migrate`

**Schema (all app tables, created now so later tasks only add logic).** IDs are text UUIDs; timestamps are integer ms.
- `invites`: id, tokenHash (unique), role, createdBy, createdAt, expiresAt, usedAt, usedBy, revokedAt
- `loginAttempts`: id, key, at, success
- `budgets`: id, name, thresholdPct, archivedAt, createdAt
- `budgetAllocations`: budgetId, fromMonth, allocationSen; primary key (budgetId, fromMonth)
- `transactions`: id, merchant, occurredAt, receiptNumber, totalSen, paymentMethod, budgetId (null = Uncategorised), note, createdBy, createdAt, updatedAt
- `transactionItems`: id, transactionId, position, name, quantity (real), unitPriceSen, lineTotalSen
- `receiptUploads`: id, path, uploadedBy, createdAt, transactionId (null until saved)
- `notifications`: id, budgetId, month, level ('threshold' | 'over'), createdAt; unique (budgetId, month, level)
- `notificationReads`: notificationId, userId, readAt; primary key (notificationId, userId)
- `debts`: id, personName, amountSen, lentOn, dueOn, note, createdAt
- `debtPayments`: id, debtId, amountSen, paidOn
- `chatMessages`: id, userId, role ('user' | 'assistant'), content, createdAt
- `aiUsage`: id, userId, day, model, inputTokens, outputTokens, costMicroUsd, createdAt
- `settings`: key (primary), value (JSON text)

- [ ] **Step 1:** Scaffold with `create-next-app` (TypeScript, App Router, Tailwind, `src/` dir, no example content kept). Install drizzle-orm, better-sqlite3, drizzle-kit, zod, vitest. If better-sqlite3 has no prebuilt binary for this Node version on Windows, use `@libsql/client` with a `file:` URL instead and note it in the README.
- [ ] **Step 2:** Write failing tests.

```ts
// tests/money.test.ts
expect(parseRM('12')).toBe(1200);
expect(parseRM('12.5')).toBe(1250);
expect(parseRM('1,234.50')).toBe(123450);
expect(parseRM('RM12.50')).toBe(1250);
expect(parseRM(' rm 0.07 ')).toBe(7);
expect(parseRM('12.345')).toBeNull();
expect(parseRM('-5')).toBeNull();
expect(parseRM('')).toBeNull();
expect(parseRM('abc')).toBeNull();
expect(formatRM(123450)).toBe('RM 1,234.50');
expect(formatRM(-500)).toBe('-RM 5.00');
// tests/time.test.ts  (2026-10-31T16:30:00Z is 00:30 on 1 Nov in Malaysia)
expect(monthKey(new Date('2026-10-31T16:30:00Z'))).toBe('2026-11');
expect(dayKey(new Date('2026-10-31T16:30:00Z'))).toBe('2026-11-01');
expect(monthRange('2026-11').start.toISOString()).toBe('2026-10-31T16:00:00.000Z');
expect(monthRange('2026-11').end.toISOString()).toBe('2026-11-30T16:00:00.000Z');
expect(fromLocalDateTime('2026-11-01', '00:30').toISOString()).toBe('2026-10-31T16:30:00.000Z');
// tests/db.test.ts
// runMigrations() on an empty file creates every table listed above; running it twice does not throw.
```

- [ ] **Step 3:** Run `npm test`. Expected: FAIL (modules missing).
- [ ] **Step 4:** Implement `env.ts`, `errors.ts`, `money.ts` (string and integer arithmetic only, no floats), `time.ts` (`Intl.DateTimeFormat` with `TZ`), schema, client, migrate. Vitest setup points `DATABASE_PATH` at a temp file per worker and runs migrations once.
- [ ] **Step 5:** Run `npm test`. Expected: PASS.
- [ ] **Step 6:** Write `.env.example` with every variable above, empty, each with a one-line comment. Confirm `.gitignore` already excludes `.env*`, `/data/`.
- [ ] **Step 7:** Run `npm run dev`, open `http://localhost:3000`. Expected: a plain page with the text "My Expenses", no console errors.
- [ ] **Step 8:** Commit and push: `chore: scaffold app, database schema, money and time helpers`.

---

### Task 2: Design system and shared components

**Files:**
- Create: `src/app/globals.css` (tokens), `src/app/layout.tsx`, `src/components/*` as listed in File Structure, `src/app/styleguide/page.tsx`, `docs/design-decisions.md`
- Test: `tests/components/meter.test.ts`

**Produces:**
- `<Button variant="primary" | "secondary" | "danger" | "quiet" pending?>`, `<Field label error hint>` (always a visible label), `<Select>`, `<Money sen />` (tabular figures, uses `formatRM`), `<StateTag state="fine" | "tight" | "over" />` (colour plus word: "On track", "Near limit", "Over"), `<Meter value max threshold? />`, `<EmptyState title action? />`, `<ErrorState title retry? />`, `<Dialog>` (native `<dialog>`, closes on Escape), `<ThemeToggle />`, `<PageHeader title action? />`
- `meterParts(value: number, max: number, thresholdPct?: number): { fillPct: number; thresholdPct: number | null; over: boolean }` (pure, clamps fill to 0..100)

**Decisions, each with its reason (also recorded in `docs/design-decisions.md`):**
- Typeface: IBM Plex Sans through `next/font`. Reason: made for dense, legible interfaces with true tabular figures, and reads institutional, which suits a banking-style tool.
- Palette: a warm neutral scale plus **one** accent (a deep, muted green or blue-green) for primary actions and links. State colours (amber for near limit, red for over) are semantic only and always paired with a word. Exact values are the builder's choice; verify every text/background pair with the antislop contrast tool in both themes.
- Radius: 6px controls, 10px surfaces. No pill shapes. Shadow only on overlays (dialog, menu).
- Identity motif: the **meter**, a thin horizontal bar with a tick at the threshold. Used for budgets, the dashboard and the AI budget, nowhere else.
- Focal point per screen: the amount that matters there (remaining, total, outstanding), set larger than everything else.
- Theme: light and dark through CSS variables and `prefers-color-scheme`, with `ThemeToggle` storing the choice. Reason: no brand reason to force either.
- Motion: 120 to 160 ms transitions on state changes only, off under `prefers-reduced-motion`.
- Icons: a small hand-picked inline SVG set in `components/icons.tsx`, only where a label alone is slower to read (bell, camera, plus, close, menu). No icon library.

- [ ] **Step 1:** Write failing test.

```ts
expect(meterParts(40, 100, 80)).toEqual({ fillPct: 40, thresholdPct: 80, over: false });
expect(meterParts(130, 100, 80)).toEqual({ fillPct: 100, thresholdPct: 80, over: true });
expect(meterParts(10, 0)).toEqual({ fillPct: 0, thresholdPct: null, over: false });
```

- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement tokens, base layer (`cursor: pointer` on enabled controls, visible focus ring, `html lang="en"`), components, and the styleguide page showing every component in every state. The styleguide returns 404 in production.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Open `/styleguide` at 375px and 1280px, light and dark. Expected: no horizontal scroll, all contrast checks pass, every control reachable by Tab with a visible focus ring, Dialog closes on Escape.
- [ ] **Step 6:** Commit and push: `feat: design tokens and shared components`.

---

### Task 3: Accounts, login and the owner

**Files:**
- Create: `src/lib/auth/auth.ts`, `viewer.ts`, `accounts.ts`, `throttle.ts`, `owner-reset.ts`, `src/app/api/auth/[...all]/route.ts`, pages `setup`, `login`, `change-password`, `reset-owner`, `src/app/(app)/layout.tsx`
- Modify: `src/db/schema.ts` (Better Auth tables; user gets `role`, `mustChangePassword`, `removedAt`)
- Test: `tests/auth/accounts.test.ts`, `throttle.test.ts`, `owner-reset.test.ts`

**Produces:**
- `getViewer(): Promise<Viewer | null>` (null when signed out or `removedAt` set), `requireViewer(): Promise<Viewer>` (redirects to `/login`), `requireOwner(): Promise<Viewer>` (throws `ForbiddenError` otherwise)
- `hasAnyUser(): Promise<boolean>`
- `usernameError(username: string): string | null` (3 to 30 characters from `a-z 0-9 . _`; compared lower-cased)
- `passwordError(password: string): string | null` (minimum 8 characters)
- `createAccount(input: { username: string; displayName: string; password: string; role: Role; mustChangePassword?: boolean }): Promise<{ id: string }>` (the only way accounts are created)
- `signIn(username: string, password: string, ip: string): Promise<{ ok: true } | { ok: false; reason: 'invalid' | 'locked'; retryAfterSec?: number }>`
- `checkLoginAllowed(username, ip)`, `recordLoginAttempt(username, ip, success)`. Limits: 5 failures per username, 20 per IP, in a rolling 15 minutes.
- `resetOwnerPassword(token: string, newPassword: string): Promise<'ok' | 'invalid' | 'used' | 'disabled'>`

**Behaviour:**
- Better Auth with the username plugin; an internal placeholder email is generated per user and never shown. Public sign-up through the Better Auth endpoint must be refused; `createAccount` is the only path.
- `/setup` works only while `hasAnyUser()` is false and creates the owner. Afterwards it redirects to `/login`.
- A user with `mustChangePassword` is sent to `/change-password` from every signed-in page until done.
- `/reset-owner`: `'disabled'` when `OWNER_RESET_TOKEN` is unset; compare in constant time; on success store a hash of the token in `settings` so the same token returns `'used'` next time; sign out all owner sessions.
- The signed-in layout calls `requireViewer()`; it is the guard for every page under `(app)`.

- [ ] **Step 1:** Write failing tests.

```ts
// accounts
expect(usernameError('ab')).not.toBeNull();
expect(usernameError('Siti.01')).toBeNull();
expect(passwordError('short')).not.toBeNull();
await createAccount({ username: 'Owner', displayName: 'O', password: 'password1', role: 'owner' });
await expect(createAccount({ username: 'owner', displayName: 'X', password: 'password1', role: 'member' })).rejects.toThrow(ValidationError);
expect(await hasAnyUser()).toBe(true);
// public sign-up endpoint: POST to the Better Auth sign-up route returns a non-2xx status
// throttle
for (let i = 0; i < 5; i++) await recordLoginAttempt('siti', '1.1.1.1', false);
expect((await checkLoginAllowed('siti', '2.2.2.2')).allowed).toBe(false);
expect((await checkLoginAllowed('ali', '2.2.2.2')).allowed).toBe(true);
// a success does not clear the lock early; attempts older than 15 minutes are ignored (fake timers)
// owner reset
expect(await resetOwnerPassword('x', 'newpassword1')).toBe('disabled');       // token unset
expect(await resetOwnerPassword('wrong', 'newpassword1')).toBe('invalid');    // token set to 'abc123'
expect(await resetOwnerPassword('abc123', 'newpassword1')).toBe('ok');
expect(await resetOwnerPassword('abc123', 'another12')).toBe('used');
```

- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement, following the current Better Auth docs for the Drizzle adapter, username plugin and server-side user creation.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** In the browser: fresh database opens `/setup`; create owner; sign out; wrong password shows "Wrong username or password."; six wrong tries shows a locked message with the wait time; correct login reaches an empty signed-in page; `/setup` now redirects to `/login`.
- [ ] **Step 6:** Commit and push: `feat: owner setup, login, throttling, owner password reset`.

---

### Task 4: People, invites and roles

**Files:**
- Create: `src/lib/auth/invites.ts`, `people.ts`, pages `invite/[token]`, `(app)/settings/page.tsx` (People section), `(app)/settings/profile/page.tsx`
- Test: `tests/auth/invites.test.ts`, `people.test.ts`

**Consumes:** `Viewer`, `requireOwner`, `createAccount`, `usernameError`, `passwordError`.
**Produces:**
- `createInvite(owner: Viewer, role: 'member' | 'guest'): Promise<{ id: string; token: string }>` (token shown once; only its hash is stored; expires in 7 days)
- `listInvites(owner): Promise<{ id; role; createdAt; expiresAt; status: 'open' | 'used' | 'expired' | 'revoked' }[]>`, `revokeInvite(owner, id)`
- `inviteStatus(token: string): Promise<{ status: 'valid' | 'expired' | 'used' | 'revoked' | 'unknown'; role?: 'member' | 'guest' }>`
- `acceptInvite(token, input: { displayName; username; password }): Promise<{ ok: true } | { ok: false; reason: 'expired' | 'used' | 'revoked' | 'unknown' }>` (marking the invite used and creating the account happen in one database transaction)
- `listPeople(owner)`, `changeRole(owner, userId, role: 'member' | 'guest')`, `resetPassword(owner, userId): Promise<{ tempPassword: string }>` (sets `mustChangePassword`, ends that user's sessions), `removePerson(owner, userId)` (sets `removedAt`, ends sessions, keeps their transactions), `updateProfile(viewer, { displayName })`, `changeOwnPassword(viewer, current, next)`
- All owner functions throw `ForbiddenError` for a non-owner. The owner cannot be removed or have their role changed.

- [ ] **Step 1:** Write failing tests.

```ts
const { token } = await createInvite(owner, 'guest');
expect((await inviteStatus(token)).status).toBe('valid');
// Review Focus 5: two people open the same link
const [a, b] = await Promise.all([
  acceptInvite(token, { displayName: 'A', username: 'aaa', password: 'password1' }),
  acceptInvite(token, { displayName: 'B', username: 'bbb', password: 'password1' }),
]);
expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
expect((await inviteStatus(token)).status).toBe('used');
// expired after 7 days (fake timers) -> 'expired'; revoked -> 'revoked'; random token -> 'unknown'
await expect(createInvite(member, 'guest')).rejects.toThrow(ForbiddenError);
// Review Focus 5: access changes mid-session
await removePerson(owner, memberId);          // their session token now resolves to no viewer
await changeRole(owner, otherId, 'guest');    // viewer for that session now has role 'guest'
await expect(removePerson(owner, owner.id)).rejects.toThrow(ValidationError);
const { tempPassword } = await resetPassword(owner, otherId);  // old password fails, temp works, mustChangePassword true
```

- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement. `getViewer` must read role and `removedAt` from the database on each request, not from a cached session payload.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Build the pages. Settings (owner only) lists people with role, and offers: create invite (choose Member or Guest, then a copyable link), revoke, change role, reset password (shows the temporary password once), remove (confirm dialog). `/invite/[token]` shows a sign-up form when valid and a plain message for each other status. Profile page for everyone.
- [ ] **Step 6:** In the browser, in a second private window: accept an invite as a guest, confirm the link no longer works, confirm a member opening `/settings` sees only Profile.
- [ ] **Step 7:** Commit and push: `feat: invites, roles and people management`.

---

### Task 5: Budgets

**Files:**
- Create: `src/lib/budgets.ts`, `src/app/(app)/budgets/page.tsx` and its form components
- Test: `tests/budgets.test.ts`

**Produces:**
- `type BudgetState = 'fine' | 'tight' | 'over'`
- `budgetState(spentSen: number, allocationSen: number, thresholdPct: number): BudgetState` ('over' when spent > allocation; 'tight' when spent × 100 >= allocation × thresholdPct; allocation 0 with nothing spent is 'fine')
- `type BudgetSummary = { id: string; name: string; remainingSen: number; state: BudgetState; allocationSen?: number; spentSen?: number; thresholdPct?: number }` (the three optional fields are **absent** for guests)
- `createBudget(owner, { name, allocationSen, thresholdPct = 80 }): Promise<{ id }>`, `updateBudget(owner, id, { name?, allocationSen?, thresholdPct? })`, `archiveBudget(owner, id)`
- `allocationFor(budgetId: string, month: string): Promise<number>` (the row with the greatest `fromMonth` that is <= month; 0 if none)
- `spentFor(budgetId: string | null, month: string): Promise<number>`
- `listBudgetSummaries(viewer: Viewer, month: string): Promise<BudgetSummary[]>`
- `listBudgetNames(viewer): Promise<{ id: string; name: string }[]>` (active budgets, for pickers; all roles)

**Rules:** name required and unique among active budgets; allocation >= 0; threshold 1 to 100. `updateBudget` with a new allocation writes a `budgetAllocations` row for the **current** month, so earlier months keep their value. Archived budgets disappear from pickers and from the current month but stay on past transactions.

- [ ] **Step 1:** Write failing tests.

```ts
expect(budgetState(7999, 10000, 80)).toBe('fine');
expect(budgetState(8000, 10000, 80)).toBe('tight');
expect(budgetState(10000, 10000, 80)).toBe('tight');
expect(budgetState(10001, 10000, 80)).toBe('over');
// allocation history
const { id } = await createBudget(owner, { name: 'Groceries', allocationSen: 80000 });   // in 2026-10 (fake timers)
await updateBudget(owner, id, { allocationSen: 100000 });                                 // in 2026-11
expect(await allocationFor(id, '2026-10')).toBe(80000);
expect(await allocationFor(id, '2026-11')).toBe(100000);
// guest view carries no allocation or spent
const g = (await listBudgetSummaries(guest, '2026-11'))[0];
expect(g).toEqual({ id, name: 'Groceries', remainingSen: 100000, state: 'fine' });
const m = (await listBudgetSummaries(member, '2026-11'))[0];
expect(m.allocationSen).toBe(100000);
await expect(createBudget(member, { name: 'X', allocationSen: 1 })).rejects.toThrow(ForbiddenError);
await expect(createBudget(owner, { name: 'groceries', allocationSen: 1 })).rejects.toThrow(ValidationError);
```

- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement `budgets.ts`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Build `/budgets`. Owner: list with Meter, add, edit, archive (confirm). The threshold field shows the RM value it equals as the owner types. Member: same list, read only. Guest: name, remaining, StateTag only. Empty state for the owner: "No budgets yet" with an "Add a budget" action; for others: "No budgets have been set up yet."
- [ ] **Step 6:** In the browser as owner, member and guest: check each view, at 375px and 1280px.
- [ ] **Step 7:** Commit and push: `feat: budgets with monthly allocations and thresholds`.

---

### Task 6: Transactions (manual entry)

**Files:**
- Create: `src/lib/transactions.ts`, `src/app/(app)/transactions/page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `src/components/TransactionForm.tsx`
- Test: `tests/transactions.test.ts`

**Produces:**

```ts
export type PaymentMethod = 'qr' | 'cash' | 'card' | 'other';
export type ItemInput = { name: string; quantity: number; unitPriceSen: number; lineTotalSen: number };
export type TransactionInput = {
  merchant: string; occurredAt: Date; receiptNumber?: string; totalSen: number;
  paymentMethod: PaymentMethod; budgetId: string | null; note?: string;
  items: ItemInput[]; receiptUploadId?: string;
};
export type TransactionRow = { id; merchant; occurredAt: Date; totalSen; paymentMethod; budgetName: string; createdById; createdByName; hasReceipt: boolean; canEdit: boolean };
export type TransactionDetail = TransactionRow & { receiptNumber?; note?; budgetId: string | null; items: ItemInput[]; receiptUploadId?: string };
export type TransactionFilter = { month: string; budgetId?: string | null; personId?: string; paymentMethod?: PaymentMethod };
createTransaction(viewer, input): Promise<{ id: string }>
updateTransaction(viewer, id, input): Promise<void>
deleteTransaction(viewer, id): Promise<void>
getTransaction(viewer, id): Promise<TransactionDetail | null>     // null when it does not exist OR the viewer may not see it
listTransactions(viewer, filter): Promise<TransactionRow[]>       // newest first
```

**Rules:** merchant required; `totalSen` > 0; `occurredAt` not more than 1 day in the future; `budgetId` must be an active budget or null (shown as "Uncategorised"); item quantity > 0. Owner edits and deletes any; members and guests only their own, otherwise `ForbiddenError`. Members see all; guests see only their own, and for a guest `personId` in the filter is ignored. `TransactionForm` is used for new, edit and (Task 11) receipt review; it takes `initial?: Partial<TransactionInput>` and `warnings?: string[]`. The form shows a live note when items do not add up to the total, but does not block saving.

- [ ] **Step 1:** Write failing tests.

```ts
const { id } = await createTransaction(member, { merchant: 'Tesco', occurredAt: d('2026-11-03'), totalSen: 4550, paymentMethod: 'qr', budgetId: groceries, items: [] });
expect(await getTransaction(guest, id)).toBeNull();                       // guest cannot see others'
expect((await listTransactions(guest, { month: '2026-11' }))).toHaveLength(0);
expect((await listTransactions(member2, { month: '2026-11' }))[0].canEdit).toBe(false);
await expect(updateTransaction(member2, id, input)).rejects.toThrow(ForbiddenError);
await updateTransaction(owner, id, { ...input, totalSen: 5000 });         // owner may edit any
// guest's own entry counts against the household budget
await createTransaction(guest, { ...input, totalSen: 1000, budgetId: groceries });
expect(await spentFor(groceries, '2026-11')).toBe(6000);
// Review Focus 4: 00:30 on 1 Nov Malaysia time belongs to November
await createTransaction(owner, { ...input, occurredAt: new Date('2026-10-31T16:30:00Z') });
expect((await listTransactions(owner, { month: '2026-10' }))).toHaveLength(0);
await expect(createTransaction(owner, { ...input, totalSen: 0 })).rejects.toThrow(ValidationError);
await expect(createTransaction(owner, { ...input, budgetId: 'nope' })).rejects.toThrow(ValidationError);
// filter by paymentMethod, budgetId (null = Uncategorised) and personId each narrow the list
```

- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement `transactions.ts`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Build the pages: list with month switcher and filters (no person filter for guests), new, detail with edit and delete (confirm dialog) when `canEdit`. Amount fields accept what `parseRM` accepts and show its error otherwise. Empty state: "No transactions in November 2026" with "Add manually".
- [ ] **Step 6:** In the browser at 375px: add a manual transaction with two items, edit it, delete it; confirm a guest sees only their own.
- [ ] **Step 7:** Commit and push: `feat: transactions with manual entry and role-based visibility`.

---

### Task 7: Budget notifications

**Files:**
- Create: `src/lib/notifications.ts`, `src/app/(app)/notifications/page.tsx`
- Modify: `src/lib/transactions.ts` (call `evaluateBudgetAlerts`), `src/app/(app)/layout.tsx` (bell with unread count)
- Test: `tests/notifications.test.ts`

**Consumes:** `allocationFor`, `spentFor`, `budgetState`, `monthKey`, `monthLabel`.
**Produces:**
- `evaluateBudgetAlerts(budgetId: string | null, month: string): Promise<void>` (no-op for null or allocation 0; inserts 'threshold' when state is 'tight' or 'over', and 'over' when state is 'over'; the unique index makes repeats harmless)
- `listNotifications(viewer): Promise<{ id; text: string; createdAt: Date; read: boolean }[]>` (last 60 days, newest first), `unreadCount(viewer): Promise<number>`, `markAllRead(viewer): Promise<void>`
- Text, the same for every role and with no amounts: `"{budget} has passed its warning level for {Month YYYY}."` and `"{budget} is over budget for {Month YYYY}."`

`createTransaction`, `updateTransaction` and `deleteTransaction` call `evaluateBudgetAlerts` for the affected budget and month; `updateTransaction` calls it for both the old and the new budget and month.

- [ ] **Step 1:** Write failing tests.

```ts
// allocation RM 100, threshold 80%
await createTransaction(owner, tx(7900));  expect(await listNotifications(owner)).toHaveLength(0);
await createTransaction(owner, tx(200));   expect((await listNotifications(owner))[0].text).toBe('Groceries has passed its warning level for November 2026.');
await createTransaction(owner, tx(100));   expect(await listNotifications(owner)).toHaveLength(1);      // no repeat
await createTransaction(owner, tx(2000));  expect(await listNotifications(owner)).toHaveLength(2);      // now over
expect((await listNotifications(guest)).map(n => n.text).join(' ')).not.toMatch(/RM|\d+\.\d\d/);
// Review Focus 4: moving a transaction into another budget alerts the new budget
await updateTransaction(owner, petrolTxId, { ...input, budgetId: school, totalSen: 9000 });   // school allocation RM 100
expect((await listNotifications(owner)).some(n => n.text.startsWith('School has passed'))).toBe(true);
// one jump from under threshold to over 100% creates both notifications
expect(await unreadCount(member)).toBeGreaterThan(0); await markAllRead(member); expect(await unreadCount(member)).toBe(0);
expect(await unreadCount(owner)).toBeGreaterThan(0);   // read state is per person
```

- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement and wire into `transactions.ts`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS (including Task 6 tests).
- [ ] **Step 5:** Add the bell to the shell with the unread count (accessible name "Notifications, 2 unread") and the notifications page (opening it marks all read). Empty state: "Nothing to report. You'll see a note here when a budget passes its warning level."
- [ ] **Step 6:** In the browser: push a budget past its threshold and confirm the badge appears for another signed-in person after a refresh.
- [ ] **Step 7:** Commit and push: `feat: in-app budget threshold notifications`.

---

### Task 8: Debts (owner only)

**Files:**
- Create: `src/lib/debts.ts`, `src/app/(app)/debts/page.tsx` and form components
- Test: `tests/debts.test.ts`

**Produces:**
- `debtStatus(amountSen: number, repaidSen: number): 'unpaid' | 'partly paid' | 'paid'`
- `createDebt(owner, { personName, amountSen, lentOn: string, dueOn?: string, note?: string }): Promise<{ id }>`, `updateDebt(owner, id, same)`, `deleteDebt(owner, id)`
- `addPayment(owner, debtId, { amountSen, paidOn: string }): Promise<void>`, `deletePayment(owner, paymentId)`
- `listDebts(owner): Promise<{ personName: string; outstandingSen: number; debts: { id; amountSen; repaidSen; outstandingSen; status; lentOn; dueOn?; note?; payments: { id; amountSen; paidOn }[] }[] }[]>` (grouped by person name, case-insensitive, largest outstanding first)
- `debtTotals(owner): Promise<{ outstandingSen: number; people: { name: string; outstandingSen: number }[] }>`
- Every function throws `ForbiddenError` for members and guests. A payment larger than the outstanding amount, or <= 0, throws `ValidationError`.

- [ ] **Step 1:** Write failing tests.

```ts
expect(debtStatus(10000, 0)).toBe('unpaid');
expect(debtStatus(10000, 4000)).toBe('partly paid');
expect(debtStatus(10000, 10000)).toBe('paid');
const { id } = await createDebt(owner, { personName: 'Ali', amountSen: 50000, lentOn: '2026-11-01' });
await addPayment(owner, id, { amountSen: 20000, paidOn: '2026-11-10' });
expect((await debtTotals(owner)).outstandingSen).toBe(30000);
await expect(addPayment(owner, id, { amountSen: 30001, paidOn: '2026-11-11' })).rejects.toThrow(ValidationError);
await expect(listDebts(member)).rejects.toThrow(ForbiddenError);
await expect(listDebts(guest)).rejects.toThrow(ForbiddenError);
// a debt does not change any budget's spent amount
```

- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement `debts.ts`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Build `/debts`: total outstanding as the focal figure, people grouped beneath, each debt with status word, payments, "Record a payment", edit, delete. The page and its nav item do not exist for members and guests (direct URL returns 404). Empty state: "Nobody owes you money right now." with "Record a debt".
- [ ] **Step 6:** In the browser as owner at 375px: record a debt, two part payments until paid. As member: `/debts` is 404 and not in the nav.
- [ ] **Step 7:** Commit and push: `feat: debts with part payments, owner only`.

---

### Task 9: Dashboard and navigation

**Files:**
- Create: `src/lib/dashboard.ts`, `src/app/(app)/page.tsx`
- Modify: `src/app/(app)/layout.tsx` (final navigation)
- Test: `tests/dashboard.test.ts`

**Consumes:** `listBudgetSummaries`, `listTransactions`, `debtTotals`.
**Produces:**

```ts
export type Dashboard = {
  month: string; budgets: BudgetSummary[]; recent: TransactionRow[];          // recent: latest 8 the viewer may see
  totals?: { spentSen: number; allocatedSen: number };                         // absent for guests
  byBudget?: { name: string; spentSen: number }[];                             // absent for guests; includes Uncategorised when > 0
  debts?: { outstandingSen: number; people: { name: string; outstandingSen: number }[] };   // owner only
};
getDashboard(viewer: Viewer, month: string): Promise<Dashboard>
```

- [ ] **Step 1:** Write failing tests.

```ts
const g = await getDashboard(guest, '2026-11');
expect(g.totals).toBeUndefined(); expect(g.byBudget).toBeUndefined(); expect(g.debts).toBeUndefined();
expect(g.recent.every(t => t.createdById === guest.id)).toBe(true);
expect(Object.keys(g.budgets[0]).sort()).toEqual(['id', 'name', 'remainingSen', 'state']);
const m = await getDashboard(member, '2026-11');
expect(m.totals).toEqual({ spentSen: 6000, allocatedSen: 100000 }); expect(m.debts).toBeUndefined();
expect((await getDashboard(owner, '2026-11')).debts?.outstandingSen).toBe(30000);
```

- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement `dashboard.ts`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Build the dashboard. Focal point: total left this month (owner and members) or the budget list (guests). Then: banner listing budgets that are near limit or over; budgets with Meter and StateTag; "Spending by budget" as plain horizontal bars with the RM amount written beside each (no chart library); recent transactions; for the owner, debts outstanding with a link to `/debts`. Actions "Scan receipt" (links to the Task 11 route; until then it is not rendered) and "Add manually". Month switcher. Empty state for a brand new household guides the owner to add a first budget.
- [ ] **Step 6:** Finalise navigation: bottom bar on phones, side or top navigation on wide screens. Items shown only if the page exists for that role. Every item leads to a real page.
- [ ] **Step 7:** In the browser as each role at 375px and 1280px, light and dark: no overflow, focal figure clear, guest sees no totals.
- [ ] **Step 8:** Commit and push: `feat: role-aware dashboard and navigation`.

---

### Task 10: AI providers and settings

**Files:**
- Create: `src/lib/ai/models.ts`, `providers.ts`, `settings.ts`, `src/app/(app)/settings/ai/page.tsx`
- Test: `tests/ai/models.test.ts`, `settings.test.ts`

**Produces:**
- `type Provider = 'anthropic' | 'openai' | 'deepseek'`
- `type ModelInfo = { id: string; provider: Provider; label: string; vision: boolean; inputUsdPerMTok: number; outputUsdPerMTok: number }`
- `MODELS: ModelInfo[]`, `PRICES_CHECKED_ON: string`, `PRICE_SOURCES: Record<Provider, string>` (pricing page URLs)
- `costMicroUsd(modelId: string, inputTokens: number, outputTokens: number): number` (`Math.ceil(inputTokens × inputUsdPerMTok + outputTokens × outputUsdPerMTok)`; USD per million tokens times tokens is already micro-USD)
- `configuredProviders(): Provider[]` (those whose key is set in `env`), `languageModel(modelId: string)` (the AI SDK model object)
- `getAiSettings(): Promise<{ chatModel: string | null; receiptModel: string | null; dailyBudgetMicroUsd: number }>` (budget defaults to 1_000_000; a stored model whose provider key is no longer configured is returned as null)
- `setChatModel(owner, modelId)`, `setReceiptModel(owner, modelId)` (rejects a model with `vision: false`), `setDailyBudget(owner, usd: string)` (0.01 to 1000, two decimals): all owner only, all reject unknown models and unconfigured providers with `ValidationError`

- [ ] **Step 1:** Load the `claude-api` skill for current Anthropic model IDs and prices. Look up current OpenAI and DeepSeek model IDs and prices on their official pricing pages. Fill `MODELS` with two or three sensible models per provider (one cheap, one stronger). DeepSeek models have `vision: false`. Record the date and URLs.
- [ ] **Step 2:** Write failing tests.

```ts
// with a fixture model at 3 USD in / 15 USD out per million tokens
expect(costMicroUsd('fixture', 1000, 500)).toBe(10500);
expect(MODELS.filter(m => m.provider === 'deepseek').every(m => !m.vision)).toBe(true);
expect(MODELS.every(m => m.inputUsdPerMTok > 0 && m.outputUsdPerMTok > 0)).toBe(true);
// only ANTHROPIC_API_KEY set
expect(configuredProviders()).toEqual(['anthropic']);
await expect(setChatModel(owner, anOpenAiModel)).rejects.toThrow(ValidationError);
await expect(setReceiptModel(owner, aDeepSeekModel)).rejects.toThrow(ValidationError);
await expect(setChatModel(member, anAnthropicModel)).rejects.toThrow(ForbiddenError);
expect((await getAiSettings()).dailyBudgetMicroUsd).toBe(1_000_000);
await setDailyBudget(owner, '2.50'); expect((await getAiSettings()).dailyBudgetMicroUsd).toBe(2_500_000);
await expect(setDailyBudget(owner, '0')).rejects.toThrow(ValidationError);
```

- [ ] **Step 3:** Run `npm test`. Expected: FAIL.
- [ ] **Step 4:** Implement.
- [ ] **Step 5:** Run `npm test`. Expected: PASS.
- [ ] **Step 6:** Build `/settings/ai` (owner only): for each provider, "Key found in .env" or "No key in .env" (never the key); a model picker for the assistant and one for receipt reading (vision models only, with one line saying DeepSeek cannot read images); the daily budget amount. When no provider has a key, the page explains: add a key to the `.env` file, restart the app, then choose a model here. Today's usage and the reset button arrive in Task 12.
- [ ] **Step 7:** In the browser: with no keys, with one key, pick models, change the budget, reload and confirm it persisted.
- [ ] **Step 8:** Commit and push: `feat: AI provider selection and model price table`.

---

### Task 11: Receipt scanning

**Files:**
- Create: `src/lib/uploads.ts`, `src/lib/ai/receipt.ts`, `src/app/api/receipts/route.ts`, `src/app/api/receipts/[id]/route.ts`, `src/app/(app)/transactions/scan/page.tsx`
- Modify: `src/lib/transactions.ts` (link `receiptUploadId` on save), transaction detail page (show the image), dashboard (render "Scan receipt")
- Test: `tests/uploads.test.ts`, `tests/ai/receipt.test.ts`

**Consumes:** `languageModel`, `getAiSettings`, `listBudgetNames`, `TransactionForm`, `getTransaction`.
**Produces:**
- `saveReceiptImage(viewer, file: { bytes: Buffer; mime: string }): Promise<{ uploadId: string }>`: accepts JPEG, PNG, WebP up to 15 MB; anything else throws `ValidationError('image', ...)`. Re-encodes with sharp to JPEG, longest edge 1600px, auto-rotated, metadata stripped. Stored under `${UPLOADS_DIR}/receipts/`.
- `readReceiptImage(viewer, uploadId): Promise<Buffer | null>`: allowed for the uploader while unlinked; once linked, for whoever `getTransaction` allows. Otherwise null.
- `type ReceiptDraft = { initial: Partial<TransactionInput>; warnings: string[] }`
- `toDraft(raw: unknown, budgets: { id: string; name: string }[]): ReceiptDraft`: pure. Converts RM decimals to sen with `parseRM`, drops items with quantity <= 0 or missing numbers, maps a suggested budget name to its id (case-insensitive, unknown name ignored), and adds warnings: `"The items add up to RM X but the total reads RM Y."`, `"No date was found on the receipt."`, `"No total was found on the receipt."`.
- `extractReceipt(image: Buffer, budgets): Promise<{ ok: true; draft: ReceiptDraft } | { ok: false; reason: 'not_configured' | 'unreadable' | 'provider_error' }>`: asks the receipt model for an object with: merchant, date (YYYY-MM-DD), time (HH:mm), receiptNumber, items[{ name, quantity, unitPrice, lineTotal }], total, paymentMethod (qr / cash / card / other), suggestedBudget (one of the given names), isReceipt (boolean). All fields nullable. `isReceipt: false` returns `'unreadable'`. Never counted against the AI budget.
- `POST /api/receipts` (multipart field `image`) → `200 { uploadId, draft | null, reason? }`; `400 { error }` for a bad file. `GET /api/receipts/[id]` → the JPEG or 404.

- [ ] **Step 1:** Write failing tests.

```ts
// Review Focus 1
await expect(saveReceiptImage(owner, { bytes: heicFixture, mime: 'image/heic' })).rejects.toThrow(ValidationError);
await expect(saveReceiptImage(owner, { bytes: Buffer.alloc(16 * 1024 * 1024), mime: 'image/jpeg' })).rejects.toThrow(ValidationError);
const { uploadId } = await saveReceiptImage(owner, { bytes: bigJpeg4000px, mime: 'image/jpeg' });
const meta = await sharp(await readReceiptImage(owner, uploadId)).metadata();
expect(Math.max(meta.width!, meta.height!)).toBe(1600); expect(meta.exif).toBeUndefined();
expect(await readReceiptImage(guest, uploadId)).toBeNull();          // someone else's pending upload
// after the owner links it to a transaction: member can read it, guest still cannot
// Review Focus 2
const d = toDraft({ merchant: 'KK Mart', date: null, total: 12.5, paymentMethod: 'qr', suggestedBudget: 'Holidays',
  items: [{ name: 'Milk', quantity: 2, unitPrice: 3.2, lineTotal: 6.4 }, { name: 'Bad', quantity: -1, unitPrice: 1, lineTotal: 1 }] }, [{ id: 'b1', name: 'Groceries' }]);
expect(d.initial.totalSen).toBe(1250); expect(d.initial.items).toHaveLength(1); expect(d.initial.budgetId).toBeUndefined();
expect(d.warnings).toContain('The items add up to RM 6.40 but the total reads RM 12.50.');
expect(d.warnings).toContain('No date was found on the receipt.');
expect(toDraft({ suggestedBudget: 'groceries' }, [{ id: 'b1', name: 'Groceries' }]).initial.budgetId).toBe('b1');
expect((await extractReceipt(img, [])).ok).toBe(false);              // no receipt model configured -> 'not_configured'
// provider throws (mocked model) -> { ok: false, reason: 'provider_error' }; isReceipt false -> 'unreadable'
```

- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement, using the AI SDK's current structured-output call with an image input. Tests mock `languageModel`; no real API calls in tests.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Build `/transactions/scan`: a file input `accept="image/jpeg,image/png,image/webp"` with `capture="environment"` offered on phones, a "Reading your receipt" state, then `TransactionForm` pre-filled with the image shown beside (desktop) or above (phone) the form and any warnings listed at the top. On `not_configured`, `unreadable` or `provider_error` the form opens empty with the image attached and one plain sentence explaining why. Nothing is saved until the user presses Save.
- [ ] **Step 6:** In the browser with a real key and a real receipt photo: scan, correct a field, save, open the transaction and view the image. Then with the key removed: the manual fallback appears. If no key is available, say so and verify only the fallback path.
- [ ] **Step 7:** Commit and push: `feat: receipt scanning with review before saving`.

---

### Task 12: Assistant and the daily AI budget

**Files:**
- Create: `src/lib/ai/budget.ts`, `context.ts`, `chat.ts`, `src/app/api/chat/route.ts`, `src/app/(app)/assistant/page.tsx`
- Modify: `src/app/(app)/settings/ai/page.tsx` (usage today, per person, reset button)
- Test: `tests/ai/budget.test.ts`, `context.test.ts`, `chat.test.ts`

**Consumes:** `getAiSettings`, `costMicroUsd`, `languageModel`, `getDashboard`, `listTransactions`, `debtTotals`, `dayKey`.
**Produces:**
- `getAiBudgetStatus(): Promise<{ budgetMicroUsd: number; usedMicroUsd: number; available: boolean }>`: used = sum of `aiUsage.costMicroUsd` for today's `dayKey` created after `settings.aiUsageResetAt` (if set); `available = used < budget`
- `recordChatUsage(userId: string, modelId: string, inputTokens: number, outputTokens: number): Promise<void>`
- `resetTodayUsage(owner): Promise<void>` (sets `aiUsageResetAt` to now), `usageByPersonToday(owner): Promise<{ name: string; usedMicroUsd: number }[]>`
- `buildAssistantContext(viewer: Viewer): Promise<string>`: owner and members: budgets with allocation and spent this month, spending per budget for the last 3 months, top 5 merchants, payment method split; owner additionally: debt totals by person. Guests: budget names with remaining and state, and their own transactions for the last 3 months. Built only from functions that already enforce visibility.
- `listChat(viewer): Promise<{ id; role; content; createdAt }[]>`, `clearChat(viewer): Promise<void>`
- `POST /api/chat` body `{ message: string }` → streamed text. `401` signed out; `409 { error: 'not_configured' }`; `429 { error: 'budget_used' }` when `available` is false; `502 { error: 'provider_error' }`.
- Constants: `MAX_OUTPUT_TOKENS = 800`, `HISTORY_MESSAGES = 20`, message length limit 2000 characters.

**System prompt must state:** you help a Malaysian household understand its spending and budgets; amounts are in RM; answer in the language the person writes in (English or Malay); give practical suggestions grounded in the figures provided; you are not a licensed financial adviser and do not give investment advice; if the figures do not contain the answer, say so.

The route saves the user message, streams the answer, then on finish saves the assistant message and calls `recordChatUsage` with the token counts the provider reports. If the provider fails, no usage is recorded and the user's text is returned to the input box.

- [ ] **Step 1:** Write failing tests.

```ts
// budget US$1.00
await recordChatUsage(member.id, 'fixture', 100_000, 40_000);          // 0.90
expect((await getAiBudgetStatus()).available).toBe(true);
await recordChatUsage(guest.id, 'fixture', 10_000, 6_000);             // +0.12 -> 1.02, the overshoot is allowed
expect(await getAiBudgetStatus()).toMatchObject({ usedMicroUsd: 1_020_000, available: false });
await resetTodayUsage(owner); expect((await getAiBudgetStatus()).usedMicroUsd).toBe(0);
await expect(resetTodayUsage(member)).rejects.toThrow(ForbiddenError);
// usage recorded at 23:59 Malaysia time is not counted at 00:01 the next day (fake timers)
// raising the budget with setDailyBudget makes available true again
// context
const g = await buildAssistantContext(guest);
expect(g).not.toContain('Tesco');            // a member's merchant
expect(g).not.toMatch(/Ali/);                // a debtor
expect(await buildAssistantContext(member)).not.toMatch(/Ali/);
expect(await buildAssistantContext(owner)).toMatch(/Ali/);
// chat route (model mocked): budget used -> 429 and no message saved; success -> user + assistant messages saved and one aiUsage row;
// provider error -> 502, no aiUsage row; listChat(member) never returns another person's messages
```

- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Implement, using the AI SDK's current streaming and usage-reporting API.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Build `/assistant`: message list, input, streaming answers, "Clear conversation" (confirm). A small Meter with "About 40% of today's assistant budget left" for members and guests, and the USD figures for the owner. When the budget is used up the input is replaced by: "Today's assistant budget is used up. It will be available again tomorrow." (owner also gets a link to Settings). When not configured: owner sees how to set it up; others see "The assistant isn't set up yet." A one-line note under the input: "Suggestions only, not professional financial advice."
- [ ] **Step 6:** Extend `/settings/ai`: used today in USD against the budget, usage per person, "Reset today's usage" (confirm), and the sentence "This is an estimate. Your provider's bill is the real figure."
- [ ] **Step 7:** In the browser with a real key: ask a question in English and one in Malay; set the budget to US$0.01, send a message, confirm the next is blocked for a second signed-in person; reset and confirm it works again. If no key is available, say so and verify the not-configured and budget-used states with seeded data.
- [ ] **Step 8:** Commit and push: `feat: AI assistant with shared daily budget`.

---

### Task 13: Running it at home and on the server

**Files:**
- Create: `Dockerfile`, `compose.yaml`, `.dockerignore`, `README.md`, `docs/deploy.md`, `src/instrumentation.ts`
- Modify: `next.config.*` (`output: 'standalone'`)

- [ ] **Step 1:** `instrumentation.ts` runs `runMigrations()` and creates `UPLOADS_DIR` at server start, so a fresh install or an updated one needs no manual database step.
- [ ] **Step 2:** Dockerfile: multi-stage, Node LTS base that exists for both `linux/amd64` and `linux/arm64`, runs as a non-root user, `HOSTNAME=0.0.0.0`, data at `/data`. `compose.yaml`: one service, port 3000, a named volume at `/data`, `env_file: .env`, `DATABASE_PATH=/data/app.db`, `UPLOADS_DIR=/data/uploads`, `restart: unless-stopped`. `.dockerignore` excludes `.env*`, `data/`, `node_modules`, `.next`, `.git`.
- [ ] **Step 3:** Run `docker compose build` then `docker compose up -d`, open `http://localhost:3000`. Expected: the setup page; after creating an owner and restarting the container, the data is still there. Then `docker compose down`.
- [ ] **Step 4:** Write `README.md` for the owner, in plain language: how to start and stop it on this PC; the address family use on home Wi-Fi and how to find the PC's IP; the one PowerShell command (run as Administrator, by the owner) that lets other devices reach port 3000; how to put AI keys in `.env` and restart; how to reset a forgotten owner password with `OWNER_RESET_TOKEN`; how to back up (copy the `data` folder).
- [ ] **Step 5:** Write `docs/deploy.md`: copy the repo and `.env` to the server, set `APP_URL` to the domain, `docker compose up -d`, and a short Caddy example for HTTPS when the server has no reverse proxy.
- [ ] **Step 6:** Commit and push: `chore: Docker setup, README and deployment notes`.

---

### Task 14: Whole-app verification

- [ ] **Step 1:** Run `npm test` and `npm run build`. Expected: all pass, no type errors.
- [ ] **Step 2:** Start from an empty database and click through the whole app in the browser as owner, member and guest, at 375px and 1280px, in light and dark, with keyboard only on at least the login, transaction form and settings. Record each control and what it did. Check the console for errors.
- [ ] **Step 3:** From a phone on the home Wi-Fi (or report that this needs the owner's firewall command first): open the app by IP, sign in, scan a receipt with the camera.
- [ ] **Step 4:** Confirm the guest boundary by hand: as a guest, try the URLs of a member's transaction, its receipt image, `/debts`, `/settings`, `/settings/ai`. Expected: 404 or redirect for each.
- [ ] **Step 5:** Run `git ls-files | grep -iE "\.env$|\.db$|data/|uploads/"`. Expected: no output.
- [ ] **Step 6:** Run the antislop Delivery Gate and write the PASS/FAIL report, with evidence per line, to `docs/delivery-gate.md`. Fix every FAIL and re-run.
- [ ] **Step 7:** Commit and push: `docs: delivery gate report`.
