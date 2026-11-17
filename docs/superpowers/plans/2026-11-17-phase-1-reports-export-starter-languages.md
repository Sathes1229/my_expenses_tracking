# Phase 1: Reports, Excel Export, Starter Budgets and Two Languages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a monthly Reports page, export to Excel, starter budgets for an empty household, and Bahasa Melayu next to English on every screen of today's app.

**Architecture:** Languages use typed message catalogs (`src/i18n/messages/en.ts`, `ms.ts`), plain strings with `{placeholders}`, chosen per request from the person's saved choice, then a `lang` cookie, then `Accept-Language`. No locale in the URL, so links, invite links and the later phone apps keep their addresses. Errors thrown by `src/lib` carry a catalog key, so actions show them in the viewer's language. Reports are computed on the server from the same reads as Home and drawn as plain SVG. Export is a route handler that writes `.xlsx` with `exceljs`.

**Tech Stack:** Next.js 16.4 App Router (Cache Components), React 19.3, TypeScript, Tailwind 4, Drizzle + better-sqlite3, Better Auth 1.7, Vitest (node env, no DOM tooling), `exceljs@4.4.0` (new).

**Spec:** `docs/superpowers/specs/2026-11-17-paid-app-ios-android-design.md`, sections 4 and 6.

## Global Constraints

- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code (`AGENTS.md`).
- Two languages only: `en` and `ms`. Every visible string, `aria-label`, `sr-only` text, `alt`, `placeholder` and page title exists in both catalogs. TypeScript must fail the build if `ms` lacks a key `en` has.
- English copy that exists today stays word for word, so existing tests keep passing. New copy follows the existing tone: plain, short, says what happened and what to do. No em dashes or en dashes in any copy.
- Malay glossary, used the same way everywhere: Home = Utama, Transactions = Transaksi, Budgets = Bajet, Reports = Laporan, Debts = Hutang, Assistant = Pembantu, Settings = Tetapan, Profile = Profil, Notifications = Notifikasi, Owner = Pemilik, Member = Ahli, Guest = Tetamu, Receipt = Resit, Uncategorised = Tanpa kategori, Paid with = Dibayar dengan, Cash = Tunai, Card = Kad, QR = QR, Other = Lain-lain, Sign in = Log masuk, Sign out = Log keluar, Save = Simpan, Cancel = Batal, Delete = Padam, Edit = Sunting, Near limit = Hampir had, Over = Terlebih, On track = Terkawal.
- Household text is never translated: budget names, merchants, notes, people's names.
- Money is `RM 1,234.50` in both languages (`formatRM`). Month names follow the language ("Ogos 2026" / "August 2026").
- Role rules hold in every new read: a guest's report, export and assistant hold no household figures; tests check returned data, not only what renders.
- Phone first: every new screen works at 360px wide with 44px tap targets and no sideways scrolling, in both languages.
- Never stage `.env`, `data/`, `*.db` or upload files. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Push to `origin main` after each task.
- `npm test`, `npx tsc --noEmit` and `npx eslint` pass at the end of every task.

## Review Focus

1. **Seven menu items in Malay on a 360px phone** (owner: Utama, Transaksi, Bajet, Laporan, Hutang, Pembantu, Tetapan): every item visible and one tap away, no sideways scrolling. Checked in the browser in Task 4.
2. **A report whose previous month has no spending** (a new household, or January after an empty December): no percent and no division by zero; the summary says last month had no spending. Pinned by `changeSummary` tests in Task 4.
3. **Formula-like text in an export** (a merchant or note starting with `=`, `+`, `-` or `@`): written as plain text cells, never as formulas. Pinned in Task 5.
4. **Export of a month with no transactions, or with filters that match nothing:** a valid workbook with headings and a zero total, not an error. Pinned in Task 5.
5. **Language from unusual headers:** `ms-MY,ms;q=0.9,en;q=0.8` gives `ms`; `zh-CN,ms;q=0.5` gives `ms`; `en-US` gives `en`; an empty or malformed header gives `en`; a saved choice beats the cookie, which beats the header. Pinned in Task 1.

---

### Task 1: Language foundation and the Profile switch

**Files:**
- Create: `src/i18n/locale.ts`, `src/i18n/format.ts`, `src/i18n/messages/en.ts`, `src/i18n/messages/ms.ts`, `src/i18n/messages/index.ts`, `src/i18n/server.ts`, `src/i18n/client.tsx`
- Modify: `src/db/schema.ts` (user table), `src/lib/auth/auth.ts` (additionalFields), `src/lib/auth/viewer.ts` (SessionState), `src/lib/time.ts`, `src/app/layout.tsx`, `src/app/(app)/settings/profile/actions.ts`, `src/app/(app)/settings/profile/page.tsx`, `src/app/(app)/settings/profile/profile-forms.tsx`
- Create: `drizzle/0002_*.sql` (via `npm run db:generate`)
- Test: `tests/i18n/locale.test.ts`, `tests/i18n/catalog.test.ts`, `tests/i18n/hardcoded-copy.test.ts`, `tests/time.test.ts`, `tests/auth/profile-language.test.ts`

**Interfaces:**
- Produces:
  - `type Locale = 'en' | 'ms'`; `LOCALES: readonly Locale[]`; `isLocale(v: unknown): v is Locale`; `LOCALE_COOKIE = 'lang'` (in `src/i18n/locale.ts`, no server imports)
  - `matchLocale(acceptLanguage: string | null): Locale` and `resolveLocale(input: { saved: Locale | null; cookie: string | undefined; acceptLanguage: string | null }): Locale`
  - `type Messages` (the shape of `en`, every leaf a string); `messages: Record<Locale, Messages>` in `src/i18n/messages/index.ts`
  - `fmt(template: string, params?: Record<string, string | number>): string` replaces `{name}` placeholders (in `src/i18n/format.ts`)
  - `getLocale(): Promise<Locale>` and `getMessages(): Promise<Messages>` in `src/i18n/server.ts` (server only)
  - `I18nProvider({ locale, children })`, `useLocale(): Locale`, `useMessages(): Messages` in `src/i18n/client.tsx` (`'use client'`; the provider passes only the locale string, the catalog is imported on the client)
  - `monthLabel(month: string, locale: Locale = 'en')`, `formatWhen(d: Date, locale: Locale = 'en')`, `formatWhenLong(d: Date, locale: Locale = 'en')` in `src/lib/time.ts` (`ms` uses `ms-MY` with the same options)
  - `SessionState.locale: Locale | null` (the saved choice; `null` when never chosen)
  - `setLanguageAction(prev: FormState, formData: FormData): Promise<FormState>` reading field `locale`
  - `PENDING: string[]` in `tests/i18n/hardcoded-copy.test.ts`: the screens not yet translated; later tasks remove their files from it

- [ ] **Step 1: Write the failing tests**

`tests/i18n/locale.test.ts`:
- `matchLocale` returns `ms` for `'ms-MY,ms;q=0.9,en;q=0.8'`, `ms` for `'zh-CN,ms;q=0.5'`, `en` for `'en-US'`, `en` for `'fr-FR'`, `en` for `''`, `null` and `';;q=abc'`, and respects q-values (`'en;q=0.4,ms;q=0.8'` gives `ms`).
- `resolveLocale` returns `saved` when set, else a valid `cookie`, else `matchLocale(acceptLanguage)`; an invalid cookie value (`'xx'`) is ignored.

`tests/i18n/catalog.test.ts`:
- every leaf in `messages.en` and `messages.ms` is a non-empty string, and the two catalogs have the same key paths;
- for each key, the `{placeholders}` in `ms` are the same set as in `en`;
- no value in either catalog contains an em dash (U+2014) or an en dash (U+2013);
- `fmt('Hi {name}, {n} left', { name: 'Aminah', n: 3 })` is `'Hi Aminah, 3 left'`, and a missing param leaves `{name}` in place.

`tests/time.test.ts` (add): `monthLabel('2026-08', 'ms')` is `'Ogos 2026'`, `monthLabel('2026-03', 'ms')` is `'Mac 2026'`, and `monthLabel('2026-08')` is still `'August 2026'`.

`tests/i18n/hardcoded-copy.test.ts`: scans every `.tsx` under `src/app` and `src/components` (skip `src/app/styleguide`) for JSX text with two or more letters outside `{}` and for `aria-label`, `title`, `placeholder` and `alt` string attributes with letters. Files in `PENDING` are skipped; the test fails listing `file:line` for any other hit. An `ALLOWED` set holds text that is the same in both languages (`'My Expenses'`, `'RM'`, `'QR'`, `'Developed by Sathes'`). Start `PENDING` with every file that has hits today, and assert separately that each `PENDING` entry still exists.

`tests/auth/profile-language.test.ts` (use `tests/helpers/session.ts` the way other action tests do): saving `locale=ms` stores `ms` on the user row; `locale=xx` returns a form message and stores nothing.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/i18n tests/time.test.ts tests/auth/profile-language.test.ts`
Expected: FAIL (modules not found, `monthLabel` ignores the locale).

- [ ] **Step 3: Add the user column**

Add `locale: text('locale')` (nullable) to the `user` table in `src/db/schema.ts`, and `locale: { type: 'string', required: false, input: false }` to Better Auth `additionalFields`. Run `npm run db:generate` and commit the generated migration. Read `locale` in `stateFromHeaders` into `SessionState.locale` (an invalid stored value counts as `null`).

- [ ] **Step 4: Implement the i18n modules**

`en.ts` exports `const en = { common: {...}, profile: { language: {...} } }` holding only the keys this task uses; `ms.ts` is typed `Messages` so a missing key fails `tsc`. `getLocale()` reads the session state, the `lang` cookie and the `accept-language` header (`next/headers`) and calls `resolveLocale`. Root `src/app/layout.tsx` sets `<html lang>` to the locale and wraps the body in `I18nProvider`.

- [ ] **Step 5: Add the language switch to Profile**

A form under the name form: heading "Language" / "Bahasa", two radio choices "Bahasa Melayu" and "English", button "Save language" / "Simpan bahasa", status "Language saved." / "Bahasa disimpan.". `setLanguageAction` checks `isLocale`, updates `user.locale`, sets the `lang` cookie (path `/`, one year, `sameSite: 'lax'`, `httpOnly`, `secure` when `APP_URL` is https) and calls `refresh()`. The Profile page and this form read their copy from the catalog.

- [ ] **Step 6: Run the tests**

Run: `npm test && npx tsc --noEmit && npx eslint`
Expected: all pass.

- [ ] **Step 7: Commit and push**

```bash
git add src/i18n src/db/schema.ts src/lib/auth src/lib/time.ts src/app/layout.tsx "src/app/(app)/settings/profile" drizzle tests
git commit -m "feat: language foundation and a language switch in Profile"
git push origin main
```

### Task 2: Error messages in the viewer's language

**Files:**
- Modify: `src/lib/errors.ts`, every `src/lib/**/*.ts` that throws `ValidationError` or `ForbiddenError` with a message (about 70 sites: `ai/models.ts`, `ai/providers.ts`, `ai/settings.ts`, `auth/accounts.ts`, `auth/invites.ts`, `auth/owner-reset.ts`, `auth/people.ts`, `auth/viewer.ts`, `budgets.ts`, `debts.ts`, `transactions.ts`, `uploads.ts`), `src/lib/form-state.ts`, every `src/app/**/actions.ts`, `src/app/api/receipts/route.ts`, `src/app/api/chat/route.ts`, `src/i18n/messages/en.ts`, `ms.ts`
- Test: `tests/i18n/errors.test.ts`

**Interfaces:**
- Consumes: `Locale`, `messages`, `fmt`, `getLocale` (Task 1)
- Produces:
  - `type ErrorKey = keyof Messages['errors']`
  - `new ValidationError(field: string, key: ErrorKey, params?: Record<string, string | number>)`; `.message` is the English text (`fmt(messages.en.errors[key], params)`), plus `.key` and `.params`
  - `new ForbiddenError(key: ErrorKey = 'notAllowed', params?)` with the same fields
  - `errorText(error: AppError, locale: Locale): string`: the catalog text for a keyed error, else `error.message`
  - `repeatError(password, repeat, locale: Locale = 'en')` and `waitText(seconds, locale: Locale = 'en')` in `src/lib/form-state.ts`

- [ ] **Step 1: Write the failing test**

`tests/i18n/errors.test.ts`:
- `new ValidationError('total', 'totalMax', { max: 'RM 1,000,000.00' }).message` is `'Enter a total up to RM 1,000,000.00.'`;
- `errorText` of that error for `'ms'` is the Malay catalog text with `RM 1,000,000.00` filled in;
- `errorText(new AppError('bad_request', 'plain'), 'ms')` is `'plain'`;
- `waitText(90, 'ms')` is `'2 minit'` and `repeatError('a', 'b', 'ms')` is the Malay "not the same" text.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/i18n/errors.test.ts`
Expected: FAIL (constructor takes a message, no `errorText`).

- [ ] **Step 3: Convert every throw site**

Each English message becomes an `errors` key in `en.ts` with the exact same English text (placeholders for the parts built from values), and its Malay text in `ms.ts`. Each throw passes the key and params. The English `.message` must be unchanged so the existing tests pass untouched.

- [ ] **Step 4: Show errors in the viewer's language**

In every action's error handling, use `errorText(error, await getLocale())` where it used `error.message`; form-level messages the actions build themselves (for example `'Choose Member or Guest.'`) also move to the catalog. Route handlers that return a message in JSON do the same.

- [ ] **Step 5: Run the tests**

Run: `npm test && npx tsc --noEmit && npx eslint`
Expected: all pass, including every existing test that asserts an English message.

- [ ] **Step 6: Commit and push**

```bash
git add src tests
git commit -m "feat: show error messages in the viewer's language"
git push origin main
```

### Task 3: Monthly report data

**Files:**
- Create: `src/lib/reports.ts`
- Test: `tests/reports.test.ts`

**Interfaces:**
- Consumes: `listTransactions`, `listBudgetSummaries` (or the active budget ids), `shiftMonth`, `monthRange`, `dayKey`, `latestMonth` (existing)
- Produces:
```ts
export type ReportRow = { id: string | null; name: string; archived: boolean; thisSen: number; lastSen: number };
export type DailyPoint = { day: number; thisSen: number | null; lastSen: number | null };
export type MonthReport = {
  month: string;            // 'YYYY-MM'
  previous: string;         // shiftMonth(month, -1)
  totalSen: number;
  previousTotalSen: number;
  byBudget: ReportRow[];    // budgets with spending in either month; thisSen desc, then name
  daily: DailyPoint[];      // cumulative, day 1..max(days in month, days in previous)
  sameDay: { day: number; thisSen: number; lastSen: number } | null; // current month only
};
export async function getMonthReport(viewer: Viewer, month: string, now?: Date): Promise<MonthReport>;
```
  `id: null` is Uncategorised (`name` is `''`; the page shows the translated label). `archived` is true for a budget with spending that is no longer active. In `daily`, `thisSen` is `null` after today when `month` is the current month and after the month's last day; `lastSen` is `null` after the previous month's last day. `sameDay.day` is today's day of the month, capped at the previous month's length.

- [ ] **Step 1: Write the failing tests**

In `tests/reports.test.ts`, with the helpers other lib tests use (`resetDb`, `createAccount`, `createBudget`, `createTransaction`, `vi.setSystemTime`):
- `totals this month and last month, grouped by budget, with Uncategorised and archived budgets`: assert `totalSen`, `previousTotalSen`, and `byBudget` order and values, a row with `id: null`, and a row with `archived: true`.
- `includes a guest's entries in the household figures`: a guest's entry counts in the member's report.
- `builds cumulative daily lines and stops this month at today`: system time 17 Nov 2026; `daily[16].thisSen` is the spend up to 17 Nov, `daily[17].thisSen` is `null`, `daily[29].lastSen` is October's spend to the 30th, `daily[30].lastSen` is October's total and `daily.length` is 31.
- `compares to the same day last month, capped at last month's length`: on 31 Dec, `sameDay.day` is 30 against November.
- `has no sameDay for a past month`.
- `refuses a guest`: rejects with `ForbiddenError`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/reports.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `getMonthReport` in `src/lib/reports.ts`**

Two `listTransactions` calls (this month and the previous one) and the active budgets; group by budget id like `getDashboard`; days come from `dayKey(occurredAt)` on the Malaysia clock.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/reports.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit and push**

```bash
git add src/lib/reports.ts tests/reports.test.ts
git commit -m "feat: monthly report figures"
git push origin main
```

### Task 4: Reports page and menu

**Files:**
- Create: `src/app/(app)/reports/page.tsx`, `src/app/(app)/reports/not-found.tsx`, `src/app/(app)/reports/error.tsx`, `src/app/(app)/reports/report-charts.tsx`, `src/lib/report-text.ts`
- Modify: `src/app/(app)/layout.tsx`, `src/app/(app)/main-nav.tsx`, `src/i18n/messages/en.ts`, `ms.ts`
- Test: `tests/report-text.test.ts`

**Interfaces:**
- Consumes: `getMonthReport`, `MonthReport` (Task 3); `getMessages`, `getLocale`, `monthLabel(month, locale)` (Task 1); `latestMonth`, `parseMonthParam`, `shiftMonth` (existing)
- Produces: `changeSummary(totalSen: number, previousTotalSen: number): { kind: 'more' | 'less' | 'same' | 'noPrevious'; diffSen: number; percent: number | null }` in `src/lib/report-text.ts` (`percent` rounded to a whole number, `null` when `previousTotalSen` is 0)

- [ ] **Step 1: Write the failing test**

`tests/report-text.test.ts`: `changeSummary(147440, 131200)` is `{ kind: 'more', diffSen: 16240, percent: 12 }`; `changeSummary(100, 200)` is `{ kind: 'less', diffSen: 100, percent: 50 }`; `changeSummary(500, 500)` is `same` with `percent: 0`; `changeSummary(500, 0)` is `noPrevious` with `percent: null`; `changeSummary(0, 0)` is `noPrevious`.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/report-text.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `changeSummary`**

- [ ] **Step 4: Build the page**

`/reports?month=YYYY-MM`, laid out as in spec 6.1: summary box, "By budget" with paired bars on one scale (this month dark, last month light, legend), then "Spending so far, day by day" with two cumulative lines and the same-day sentence. Month navigation like Transactions (clamped to `latestMonth()`, no Next month past it). A guest gets `notFound()` and the styled `not-found.tsx` worded like Notifications'. Charts are server-rendered SVG in `report-charts.tsx` (no chart library); the line chart has `role="img"` and an `aria-label` that states both totals, and every figure in the bars is also visible text. An empty month shows an empty state with the add buttons, like Transactions. Every string comes from a new `reports` catalog namespace in both languages.

- [ ] **Step 5: Add Reports to the menu**

In `layout.tsx` insert `{ href: '/reports', label: Reports }` after Budgets for owner and member (not guest); nav labels come from the catalog. In `main-nav.tsx` the two-row bottom bar uses `ceil(items / 2)` columns (owner 7 items: 4 then 3; member 6: 3 then 3) instead of a fixed 3. Then measure in the browser at 360px, 390px and 430px in both languages: if the one-row bar needs sideways scrolling at any of these widths, raise the two-row breakpoint (`22.5rem` today) to the narrowest width where the Malay labels fit in one row.

- [ ] **Step 6: Run the tests and check the page**

Run: `npm test && npx tsc --noEmit && npx eslint`, then `npm run build` and check `/reports` on the local test copy as owner, member and guest, in English and Malay, at 360px.
Expected: tests pass; the page matches spec 6.1; a guest sees 404; the menu passes Review Focus 1.

- [ ] **Step 7: Commit and push**

```bash
git add "src/app/(app)/reports" "src/app/(app)/layout.tsx" "src/app/(app)/main-nav.tsx" src/lib/report-text.ts src/i18n tests/report-text.test.ts
git commit -m "feat: monthly report page with comparison and daily chart"
git push origin main
```

### Task 5: Export to Excel

**Files:**
- Create: `src/lib/transaction-filter.ts`, `src/lib/export.ts`, `src/app/api/export/route.ts`
- Modify: `package.json` (add `exceljs@4.4.0`), `src/lib/transactions.ts` (items for many ids), `src/app/(app)/transactions/page.tsx`, `src/i18n/messages/en.ts`, `ms.ts`
- Test: `tests/transaction-filter.test.ts`, `tests/export.test.ts`

**Interfaces:**
- Consumes: `listTransactions`, `TransactionFilter`, `PAYMENT_METHODS`, `parseMonthParam`, `latestMonth`, `dayKey`, `timeKey`, `formatRM` (existing); `Locale`, `messages` (Task 1)
- Produces:
  - `filterFromQuery(viewer: Viewer, query: Record<string, string | string[] | undefined>): { filter: TransactionFilter; choices: { budget: string; person: string; method: string } }` (the parsing now inline in `transactions/page.tsx`, moved here; a guest's `person` is always ignored; the month is clamped to `latestMonth()`)
  - `listItemsFor(transactionIds: string[]): Promise<Map<string, ItemInput[]>>` in `src/lib/transactions.ts`, ordered by `position`
  - `buildTransactionsWorkbook(viewer: Viewer, filter: TransactionFilter, locale: Locale): Promise<Buffer>`
  - `GET /api/export?month&budget&person&method` returning the workbook

- [ ] **Step 1: Write the failing tests**

`tests/transaction-filter.test.ts`: the cases the page handles today (bad month falls back, a month past `latestMonth()` is clamped, an unknown method is dropped, `budget=none` means Uncategorised, a guest's `person` is ignored).

`tests/export.test.ts` (read the buffer back with `exceljs`):
- sheets are named `Transactions` and `Items` in `en`, `Transaksi` and `Item` in `ms`;
- the header row is date, time, merchant, total, budget, paid with, added by, receipt number, note in the requested language;
- one row per transaction, newest first; the total cell is a number (`12.5`, not text) with an `RM` number format; the last row is the total of the column;
- an Uncategorised row shows the translated Uncategorised label and payment methods are translated;
- the Items sheet has one row per item with date, merchant, item, quantity, unit price and line total;
- a guest's workbook holds only their own rows;
- a merchant `=HYPERLINK("http://x","y")` and a note `+cmd` are string cells with exactly that text (Review Focus 3);
- a month with no transactions gives both sheets with headings and a total of 0 (Review Focus 4).

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/transaction-filter.test.ts tests/export.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`npm install exceljs@4.4.0`. Move the filter parsing into `filterFromQuery` and use it in `transactions/page.tsx`. `buildTransactionsWorkbook` writes dates as `dayKey` text and times as `timeKey` text, so Excel never shifts them by time zone. The route uses `stateFromHeaders`: 401 when signed out, 403 for a temporary password (as `src/app/api/receipts/[id]/route.ts` does), the viewer's locale for the language, and headers `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition: attachment; filename="my-expenses-YYYY-MM.xlsx"`, `Cache-Control: private, no-store`.

- [ ] **Step 4: Add the button**

On Transactions, when the list has rows, an "Export to Excel" / "Eksport ke Excel" link next to the total line, pointing at `/api/export` with the month and filters in view. Phase 1 shows it to everyone signed in.

- [ ] **Step 5: Run the tests and try it**

Run: `npm test && npx tsc --noEmit && npx eslint`, then on the local test copy download an export as a member and as a guest and open each in Excel or LibreOffice.
Expected: tests pass; the files open with the sheets and columns above.

- [ ] **Step 6: Commit and push**

```bash
git add package.json package-lock.json src/lib/transaction-filter.ts src/lib/export.ts src/lib/transactions.ts src/app/api/export "src/app/(app)/transactions/page.tsx" src/i18n tests
git commit -m "feat: export transactions to Excel"
git push origin main
```

### Task 6: Starter budgets

**Files:**
- Create: `src/lib/starter-budgets.ts`, `src/lib/starter-form-data.ts`, `src/app/(app)/budgets/starter-budgets.tsx`
- Modify: `src/lib/budgets.ts` (if needed for one transaction), `src/app/(app)/budgets/actions.ts`, `src/app/(app)/budgets/page.tsx`, `src/i18n/messages/en.ts`, `ms.ts`
- Test: `tests/starter-budgets.test.ts`, `tests/starter-form-data.test.ts`

**Interfaces:**
- Consumes: `createBudget` rules (existing); `messages`, `Locale` (Task 1); `ValidationError` keys (Task 2)
- Produces:
  - `STARTER_KEYS = ['groceries', 'petrol', 'eatingOut', 'utilities', 'phoneInternet', 'school', 'transport', 'health'] as const`; names in the `starter.names` catalog namespace: Groceries / Barang dapur, Petrol / Minyak kereta, Eating out / Makan luar, Utilities / Bil utiliti, Phone and internet / Telefon dan internet, Children's school / Persekolahan anak, Transport and tolls / Pengangkutan dan tol, Health / Kesihatan
  - `parseStarterForm(formData: FormData): { ok: true; picks: { name: string; allocationSen: number }[] } | { ok: false; errors: Record<string, string> }` (fields `pick` = key, repeated; `name_<key>`; `amount_<key>`)
  - `createStarterBudgets(owner: Viewer, picks: { name: string; allocationSen: number }[]): Promise<void>`: all or nothing
  - `createStarterBudgetsAction(prev: FormState, formData: FormData): Promise<FormState>`

- [ ] **Step 1: Write the failing tests**

`tests/starter-form-data.test.ts`: two ticked rows with amounts give two picks with the submitted names; a ticked row with no amount or a bad amount gives an error under `amount_<key>`; nothing ticked gives a form error; unticked rows are ignored even with amounts.

`tests/starter-budgets.test.ts`: creates each pick as a budget with its allocation for the current month; Malay names are stored as typed (`Barang dapur`); a second pick that breaks a budget rule (for example a duplicate name) leaves no budgets at all; a member is refused with `ForbiddenError`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/starter-form-data.test.ts tests/starter-budgets.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the lib functions and the action**

All picks are created in one database transaction (refactor `createBudget`'s body into a function that takes `tx` if needed).

- [ ] **Step 4: Show the picker**

On Budgets, for the owner, when the household has no budgets at all (none active, none archived; my call), show "Start with common budgets" / "Mula dengan bajet biasa": one row per starter key with a tick box, the name in the owner's language and an amount field, and a "Create budgets" / "Cipta bajet" button. The usual "Add a budget" stays available. Members see today's empty state. Errors show under each amount, using the existing field components.

- [ ] **Step 5: Run the tests and try it**

Run: `npm test && npx tsc --noEmit && npx eslint`, then on a fresh scratch database create starter budgets in Malay at 360px.
Expected: tests pass; the budgets appear with Malay names.

- [ ] **Step 6: Commit and push**

```bash
git add src/lib/starter-budgets.ts src/lib/starter-form-data.ts src/lib/budgets.ts "src/app/(app)/budgets" src/i18n tests
git commit -m "feat: start an empty household with common budgets"
git push origin main
```

### Tasks 7 to 10: Translate today's screens

Each task below follows the same steps. The files listed are its share of `PENDING`.

- [ ] **Step 1:** Remove the task's files from `PENDING` in `tests/i18n/hardcoded-copy.test.ts`.
- [ ] **Step 2:** Run `npx vitest run tests/i18n/hardcoded-copy.test.ts`. Expected: FAIL listing those files' strings.
- [ ] **Step 3:** Move every string into a catalog namespace for the area, English unchanged, Malay per the glossary; client components use `useMessages()`, server components `getMessages()`; page titles move from `export const metadata` to `generateMetadata` using the locale; dates use the locale-aware `time.ts` functions.
- [ ] **Step 4:** Run `npm test && npx tsc --noEmit && npx eslint`. Expected: all pass.
- [ ] **Step 5:** Check the area's screens on the local test copy in Malay at 360px (no clipped or overflowing labels).
- [ ] **Step 6:** Commit `feat: <area> in Bahasa Melayu` and push.

### Task 7: Sign-in and public pages

`src/app/login/*`, `src/app/setup/*`, `src/app/invite/[token]/*`, `src/app/change-password/*`, `src/app/reset-owner/*`, `src/app/error.tsx`, `src/components/auth-frame.tsx`, `src/components/error-state.tsx`. Signed-out pages use the cookie or `Accept-Language`.

### Task 8: App shell, Home, Budgets and Notifications

`src/app/(app)/layout.tsx`, `src/app/(app)/error.tsx`, `src/app/(app)/page.tsx`, `src/app/(app)/budgets/*`, `src/app/(app)/notifications/*`, `src/components/notification-bell.tsx`, `meter.tsx`, `state-tag.tsx`, `page-header.tsx`, `empty-state.tsx`, `theme-toggle.tsx`. Also: `getDashboard` returns `archived: boolean` on each `byBudget` entry instead of putting "(archived)" in the name, and pages show the translated "(archived)" and "Uncategorised" labels for `id: null` or archived rows (update `tests/dashboard.test.ts` to the new field). Alert sentences ("Utilities is over budget for November 2026.") come from the catalog with `{budget}` and `{month}`.

### Task 9: Transactions

`src/app/(app)/transactions/*` (list, new, scan, `[id]`, delete), `src/components/transaction-form.tsx`, `receipt-photo.tsx`, `select.tsx`, `field.tsx`, `form-alert.tsx`, `submit-button.tsx`, `copy-field.tsx`, `dialog.tsx`. `PAYMENT_LABELS` become catalog entries (`QR`, `Cash`/`Tunai`, `Card`/`Kad`, `Other`/`Lain-lain`), and the receipt reader's failure messages are translated. The transaction detail page's "(archived)" suffix uses the catalog.

### Task 10: Assistant, Debts, Settings and Profile

`src/app/(app)/assistant/*`, `src/app/(app)/debts/*`, `src/app/(app)/settings/*` (people, invites, AI, profile), `src/app/sign-out.ts`. The assistant's prompt to the model (`src/lib/ai/context.ts`) stays English; it already answers in the language of the question. At the end of this task `PENDING` is empty, and the test asserts that.

### Task 11: README and a full check

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** Add short README sections: "Reports", "Export to Excel", "Starting with common budgets" and "Language" (how the first language is chosen and where to switch). Fix the outdated "Put it on a phone's home screen" section, which still describes the home Wi-Fi address instead of `https://myexpenses.sathes7.duckdns.org`.
- [ ] **Step 2:** Run `npm test && npx tsc --noEmit && npx eslint && npm run build`. Expected: all pass.
- [ ] **Step 3:** On the local test copy, walk owner, member and guest through Home, Transactions (with an export), Budgets, Reports, Assistant and Profile in both languages at 360px and at desktop width. Expected: no English left on a Malay screen except household text and the allowed words; a guest sees no Reports and no household figures.
- [ ] **Step 4:** Commit `docs: reports, export, starter budgets and language in the README` and push. Deploying to the live server is a separate step the owner approves.
