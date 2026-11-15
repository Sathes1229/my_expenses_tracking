# Guests See Budget Names Only: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A guest receives budget names and their own entries, and no budget amount, remaining amount, state or alert.

**Architecture:** The reads in `src/lib` stop serving budget figures to guests (refuse, or return nothing), so no page or prompt can leak them; the pages then render a names-only view and drop their guest branches.

**Tech Stack:** Next.js 16 App Router (server components), Drizzle + better-sqlite3, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-15-guest-budget-names-only-design.md`

## Global Constraints

- Owner and member views and data do not change.
- A guest's page data and assistant prompt hold no amount, remaining amount or state of any budget.
- Guest wording everywhere: "Sees budget names and their own entries." (invite form detail); other guest descriptions say the same thing in their own sentence.
- Read `node_modules/next/dist/docs/` before changing page code (AGENTS.md).

## Review Focus

1. A guest opens `/notifications` by typing the address: expect the not-found page, never an alert list.
2. A guest when no budget exists: home shows the two actions and their recent entries, never "The owner has not set up any budgets yet." as if it concerned them.
3. A member made guest while an alert is unread: on their next request the bell badge is gone (role is read per request).
4. The add and edit forms for a guest still list every active budget name (unchanged `listBudgetNames`).
5. The server-rendered Budgets page for a guest carries no `remainingSen`, `state`, `allocationSen` in its payload.

Task 1's `unreadCount` test covers 3; 1, 2, 4 and 5 are checked in Task 3's run-through.

---

### Task 1: The reads stop serving budget figures and alerts to guests

**Files:**
- Modify: `src/lib/budgets.ts` (`BudgetSummary`, `listBudgetSummaries`)
- Modify: `src/lib/dashboard.ts` (`getDashboard`)
- Modify: `src/lib/notifications.ts` (`listNotifications`, `unreadCount`, `markAllRead`)
- Test: `tests/budgets.test.ts`, `tests/dashboard.test.ts`, `tests/notifications.test.ts`

**Interfaces:**
- Produces: `listBudgetSummaries(viewer, month)` throws `ForbiddenError` for a guest. `BudgetSummary` keeps `id, name, remainingSen, state` and makes `allocationSen: number; spentSen: number; thresholdPct: number` required.
- Produces: `getDashboard(guest, month)` returns `budgets: []` without calling `listBudgetSummaries`.
- Produces: `listNotifications(guest)` → `[]`, `unreadCount(guest)` → `0`, `markAllRead(guest)` writes nothing.

- [ ] **Step 1: Replace the guest tests**

In `tests/budgets.test.ts`, replace `'gives guests only id, name, remaining and state'` with `'refuses guests'`: `await expect(listBudgetSummaries(guest, '2026-11')).rejects.toBeInstanceOf(ForbiddenError)`; keep the member assertions in a member-only test.

In `tests/dashboard.test.ts`, rename the guest test to `'gives a guest their own transactions and no budget figures'`: `expect(g.budgets).toEqual([])`, keep the `recent` assertions, and add `'remainingSen'`, `'state'`, `'thresholdPct'` to the `hidden` list checked against `JSON.stringify(g)`.

In `tests/notifications.test.ts`, replace the guest line in `'alerts once at the threshold…'` with: after the over-budget alert exists, `expect(await listNotifications(guest)).toEqual([])`, `expect(await unreadCount(guest)).toBe(0)`; then `await markAllRead(guest)` and assert the owner's `unreadCount` is unchanged and no `notification_reads` row exists for the guest.

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run tests/budgets.test.ts tests/dashboard.test.ts tests/notifications.test.ts`
Expected: the three changed tests FAIL.

- [ ] **Step 3: Implement**

`listBudgetSummaries`: `if (viewer.role === 'guest') throw new ForbiddenError();` before any read; drop the guest branch. `getDashboard`: for a guest, return `{ month, budgets: [], recent }` from `listTransactions` alone. Notifications: early-return `[]`, `0`, and nothing for a guest. Fix the doc comments that describe the old guest view.

- [ ] **Step 4: Run them and see them pass, plus the type check**

Run: `npx vitest run tests/budgets.test.ts tests/dashboard.test.ts tests/notifications.test.ts && npx tsc --noEmit`
Expected: PASS; tsc reports the guest-only branches in the pages and `src/lib/ai/context.ts` that Tasks 2 and 3 remove (note them, do not fix here).

- [ ] **Step 5: Commit** `fix: stop sending budget figures and alerts to guests`

### Task 2: The assistant tells a guest budget names only

**Files:**
- Modify: `src/lib/ai/context.ts` (`WHO.guest`, `guestLines`, `buildAssistantContext`)
- Test: `tests/ai/context.test.ts`

**Interfaces:**
- Consumes: `listBudgetNames(viewer)` from `src/lib/budgets.ts` (unchanged); `listBudgetSummaries` throws for guests (Task 1).
- Produces: `guestLines(names: { id: string; name: string }[], months, rowsByMonth, span)`.

- [ ] **Step 1: Change the guest test** to `"gives a guest budget names and their own spending, and nobody else's"`: keep every current `not.toContain`, add `expect(g).not.toContain('RM 760.00')` (what is left in Groceries), `expect(g).not.toMatch(/\bleft\b|over budget|near (the )?limit|on track/i)`, keep `toContain('Groceries')`, `'Mamak Corner'`, `'Kopitiam'`.
- [ ] **Step 2: Run** `npx vitest run tests/ai/context.test.ts`. Expected: the guest test FAILS.
- [ ] **Step 3: Implement.** For a guest, `buildAssistantContext` reads `listBudgetNames` instead of `listBudgetSummaries`; `guestLines` writes `Budgets this household uses:` and one `- "<name>"` line each (or `There are no budgets yet.`). `WHO.guest`: "The person asking is a guest of the household. They see the budget names and only their own spending. Nothing else is shared with them, so it is not given here."
- [ ] **Step 4: Run** `npx vitest run tests/ai && npx tsc --noEmit`. Expected: PASS, and no tsc error left in `src/lib`.
- [ ] **Step 5: Commit** `fix: give the assistant only budget names for a guest`

### Task 3: Pages and wording for the names-only guest

**Files:**
- Modify: `src/app/(app)/page.tsx` (no budget section, `NoBudgets` or `NeedsAttention` for a guest; `Budgets` loses its guest branch)
- Modify: `src/app/(app)/budgets/page.tsx` (guest: `listBudgetNames` and a names list), `src/app/(app)/budgets/budget-list.tsx` (drop the `!== undefined` guards and the guest comment)
- Modify: `src/app/(app)/layout.tsx` (no bell for a guest), `src/app/(app)/notifications/page.tsx` (`notFound()` for a guest, as Debts does for members)
- Modify copy: `src/app/(app)/settings/invite-section.tsx:138`, `src/app/(app)/settings/people-list.tsx:51`, `src/app/invite/[token]/page.tsx:20`
- Modify: `docs/superpowers/specs/2026-11-12-expense-tracker-design.md` guest rows (sections 3, 5.5, 5.6): point to the new spec

**Interfaces:**
- Consumes: Task 1's `getDashboard` (empty `budgets` for a guest), `listBudgetNames`.

- [ ] **Step 1: Implement the pages.** Guest Budgets page: same header and month line, then the names in the existing list styling (`divide-y` list, name only), or the existing empty state when there are none. Copy: invite form detail "For friends. Sees budget names and their own entries."; people list "Guests see budget names and only their own entries."; invite page "As a guest you see the budget names and the entries you add yourself."
- [ ] **Step 2: Run the whole suite, lint, types and build**

Run: `npm test && npm run lint && npx tsc --noEmit && npm run build` (stop the app on port 3100 first if it is running from this folder; it is not, since the app moved to the server)
Expected: all pass, build clean.

- [ ] **Step 3: Run-through as a guest** on a scratch database (`DATABASE_PATH` and `UPLOADS_DIR` under the scratchpad, never `./data`): create an owner, a budget with spending by the owner, and a guest; sign in as the guest at phone width and check Home (actions and own entries only, no budget section), Budgets (names only), add form (budget names listed), no bell, `/notifications` not found, Assistant page loads. Check the Budgets page HTML for `remainingSen`, `allocationSen`, `"state"`: none present.
- [ ] **Step 4: Commit** `feat: show guests budget names only`, push to `origin main`.
