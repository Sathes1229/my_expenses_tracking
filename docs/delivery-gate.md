# Delivery gate report

The antislop Delivery Gate for the whole app, run on 13 November 2026 (Task 14). Mode: `during`
(the owner's saved global preference). Each line is PASS or FAIL with the evidence behind it.

## How it was checked

- A production build (`npm run build`, then `next start` on 127.0.0.1:3101) against a scratch
  database and uploads folder set in the process environment. The owner's `.env` and `./data/` were
  not touched (checksums of `./data/` were the same before and after every build).
- Headless Chrome driven over the DevTools protocol by scripts in a scratch folder: real key presses
  (Tab, Shift+Tab, Enter, Space, arrow keys, Escape), real mouse clicks, file upload, touch
  emulation, light and dark through `prefers-color-scheme` and through the app's own theme switch.
- Starting from an empty database: `/setup` made the owner, the owner invited a member and a guest
  from Settings, and each accepted the link in their own browser profile.
- Every page each role can open, at 375px and 1280px, in light and dark: 148 page views, each with a
  check for sideways overflow, every control under 44px, the console, the `h1` and the landmarks.
  The owner's pages again at 320px.
- No AI key exists, so the AI screens show their "not set up" states. See "Not verified" at the end.
- Design direction: spec section 8 and `docs/design-decisions.md`. Design read: household finance
  web app for a family, in a calm banking-style visual language. Dials: ENERGY 1, RHYTHM 2, MOTION 1.

## Result

The first run failed 6 lines. Each was fixed in its own commit, then the gate was run again.
Final state: every line PASS.

| First-run FAIL | Fix | Re-run |
|---|---|---|
| R-03: the "AI" link beside the Settings title was 17px wide | `448b2ae` min width 44px, label centred | 44 x 44px at 375 and 1280 |
| R-03: under 360px the owner's 6-item bottom bar scrolled sideways (347px of labels in 320px), part of Settings was off screen, Home and Debts were 43px wide | `17ef6c5` two rows of three under 360px; page padding and scroll padding reserve the taller bar; current mark moves under its label | 320, 340, 359px: no sideways scroll, items 107 to 120px wide and 44px tall, last control clear of the bar; 360px and up unchanged (one row) |
| C-4: the "Spending by budget" bars grouped by name, so an archived Dining (RM 193.00) and a new Dining (RM 12.00) showed as one bar of RM 205.00, while the Dining budget above said RM 12.00 spent | `8f5b447` group by budget id; an archived budget's bar says "Dining (archived)" | Bars: Dining RM 212.00 (matches its row), Dining (archived) RM 193.00 |
| C-4: after a refused question the assistant's "used up" notice was kept in component state and never cleared without a reload, even after the owner reset today's usage (Next keeps visited pages mounted) | `c867ac4` the refusal holds only until the page reads the assistant again with a different result | 4 unit tests (2 fail on the old rule); browser check needs a key, see "Not verified" |
| R-35: the console logged "404 /favicon.ico" on the first page of every visit | `59cfd63` the root metadata names an empty data URL as the icon | A new browser profile: no favicon request, empty console |
| Copy checklist (sentence case): debt states showed "Partly Paid" through CSS `capitalize` | `56039f2` the words come from a map: Unpaid, Partly paid, Paid | `/debts` shows "Partly paid" |

## Block 1: Hard Gate

| Rule | Final | Evidence |
|---|---|---|
| R-02 em dash | PASS | No U+2014 or U+2013 character anywhere in `src/` (grep); none in this report. |
| R-03 mobile | PASS | FAIL on the first run (two lines above), fixed. Re-run: 148 page views at 375 and 1280 with no page overflow, no element past the edge, no control under 44px. Owner's 11 pages at 320px: the same. Member's and guest's 5-item bottom bar (Home and Profile, both roles, light): one row with no sideways scroll at 320, 340, 359 and 360px (list width equal to the viewport each time, page width equal too); items at 320px are Home 48.3, Transactions 89.2, Budgets 62.2, Assistant 68.3, Profile 52.0px wide, all 56px tall, the narrowest growing to 56.1px at 359px. Exempt by design: radio inputs inside 44px-plus labels (254 x 86px) and the visually hidden file inputs whose labels are the targets (147 x 44px, 153 x 44px); inline links inside a sentence on AI settings (WCAG 2.5.8 inline exception). |
| R-17 numbers | PASS | Every amount is the household's own data. Model prices come from a dated table ("Prices were checked on 2026-11-12") linking each provider's price page. |
| R-18 testimonials | PASS | None exist. |
| R-23 assets | PASS | App name is plain text "My Expenses"; no logo, avatar or icon file. The favicon is declared empty, not invented. |
| R-24 navigation | PASS | Owner: Home, Transactions, Budgets, Debts, Assistant, Settings. Member and guest: Home, Transactions, Budgets, Assistant, Profile. Every item opened its page for that role. |
| R-25 contrast | PASS | Checked with the antislop contrast tool. Light: ink on surface 16.62, muted on canvas 6.52, muted on sunken 6.02, link on canvas 6.91, white on accent 7.61, danger on surface 6.61, warning on surface 5.84, bell badge (canvas on ink) 15.62. Dark: ink on surface 14.04, muted on surface 6.72, muted on canvas 7.28, muted on sunken 5.94, link on canvas 8.81, on-accent on accent 7.40, danger on surface 7.22, warning on surface 8.36, bell badge 15.20. Control borders (non-text, 3:1): 3.50 light, 3.90 dark. No text uses the line or meter tokens (grep). |
| R-26 controls | PASS | Every control was used; see the click-through below. No control without a result. |
| R-27 states | PASS | Empty: "No budgets yet", "No transactions in November 2026.", "Nobody owes you money right now.", "No transactions in November 2026 match these filters", "You have not added any transactions in November 2026." (guest), "Nothing has counted toward today's limit yet." Loading, seen at 1500ms network latency: "Loading transactions…", "Loading budgets…", "Loading the assistant…", "Loading your profile…", "Loading this month…". Error, by renaming a table in the scratch database while signed in: "Could not load the budgets." and "Could not load this month's summary." with Try again, which recovered once the table was back. |
| R-28 FAQ | PASS | None exists. |
| R-32 keyboard | PASS | Login, setup, the transaction form, settings, AI settings, profile, budget and invite dialogs used with keys only (record below). Every focused control showed the 2px accent ring (`:focus-visible`), in dark too (`#7DC2A6`, 8.14 on surface). Escape closed every dialog tried and focus went back to the button that opened it. No `outline: none` in `src/`. |
| R-33 patch scripts | PASS | No script in the repo rewrites source or CSS; every fix in this task is in the source file it belongs to. |
| R-34 themes | PASS | All 148 page views in both themes. The theme switch turned the page dark (`data-theme="dark"`, background `#161513`), kept it after navigation and reload, and switched back. The bell in dark: icon `#EDEAE4` on `#1E1D1A` (14.04), badge "1" readable (15.20); screenshot checked at 375 and 1280. |
| R-35 run and click-through | PASS | FAIL on the first run (favicon 404 in the console), fixed. Built, run and clicked through (record below). Console on the re-run: empty for all 148 page views and every flow, apart from Chrome's verbose hint about password forms without a username field and the React errors caused on purpose by the database fault. |
| R-36 claims | PASS | No security, compliance or speed claims. AI cost is labelled "This is an estimate. Your provider's bill is the real figure." The assistant says "Suggestions only, not professional financial advice." |
| R-37 direction | PASS | Spec section 8 (owner's direction: calm, plain, banking-like) and `docs/design-decisions.md` with dials ENERGY 1, RHYTHM 2, MOTION 1. |
| R-38 real content | PASS | No placeholder people, rows or numbers; every list shows stored data or an empty state. |
| R-39 semantics | PASS | `lang="en"`, a `<title>` per page, `header`, `nav` and `main` on every signed-in page, one `h1` per page with no skipped heading levels (checked on 19 pages), every control named (none unnamed), every field with a visible label, the receipt image has `alt`, `cursor: pointer` set once in the base layer and `not-allowed` when disabled, the spinner only turns under `motion-safe`, transitions off under reduced motion, viewport meta allows zoom. No footer: there is nothing to put in one. |
| R-40 media | PASS | The only image (receipt photo) has `width` and `height`; no hero image; no third-party script; the font is self-hosted. No performance number is reported: not measured. |

## Block 2: Purpose-Gate

| Rule | Final | Evidence |
|---|---|---|
| R-01 gradients, glow | PASS | No gradient, blur or glow in `src/` (grep). One accent with a written reason. |
| R-04 icons | PASS | Five hand-drawn SVGs (bell, camera, plus, close, menu), each with a reason in the design decisions; no icon library. |
| R-06 typography | PASS | IBM Plex Sans with a written reason. Monospace only for the temporary password (1 and l must not look alike) and env variable names. No wide-tracked uppercase labels. |
| R-07 background | PASS | Plain canvas colour; no grid or pattern. |
| R-08 arrows | PASS | No arrow characters in `src/`. |
| R-09 badges | PASS | Only the unread count on the bell and the state words, both carrying real state. |
| R-10 glass | PASS | None. |
| R-12 shadow | PASS | Only the dialog has a shadow (`shadow-overlay`), the one surface above the page. |
| R-13 glow | PASS | None. |
| R-14 cards | PASS | No feature cards; budget rows differ by state, meter and amounts. |
| R-19 motion | PASS | 140ms colour and width changes on state, a spinner while waiting; both off under reduced motion. Matches MOTION 1. |
| R-22 illustrations | PASS | None. |

## Block 3: Liveliness

| Question | Final | Evidence |
|---|---|---|
| Dials set | PASS | ENERGY 1, RHYTHM 2, MOTION 1 in the design decisions. |
| Output matches the dials | PASS | Quiet surfaces, consistent sections with the focal amount as the break, motion only on state. |
| One focal point per screen | PASS | "Left this month" amount on Home, "Total outstanding" on Debts, the amount left per budget for a guest. |
| Structural whitespace | PASS | Section gaps (2.5rem) larger than gaps inside sections; the dashboard splits into two columns from 1024px. |
| One deliberate accent | PASS | Deep green on primary buttons, links and the focus ring only. |
| Identity motif | PASS | The square-ended meter with a threshold tick, on budgets, the dashboard and the AI budget. |
| Design read declared | PASS | Spec section 8. |

## Block 4: Craftsmanship and quality locks

| Question | Final | Evidence |
|---|---|---|
| C-1 intentional | PASS | Every visual choice has a one-line reason in `docs/design-decisions.md`, including the new two-row bottom bar. |
| C-2 working controls | PASS | Click-through below. |
| C-3 content-driven | PASS | Each section is something the spec asks for; no template sections. |
| C-4 resilience | PASS | FAIL on the first run (spending bars, assistant notice), fixed. Every state, theme, width and keyboard path above holds. |
| C-5 evidence | PASS | No testimonials, statistics or claims. |
| R-05 layout | PASS | No hero, card grid, bento or pricing; the dashboard follows what the household decides each month. |
| R-11 radius | PASS | 6px controls, 10px surfaces, round only for the spinner; nothing pill-shaped. |
| R-15 CTAs | PASS | Specific actions: "Scan receipt", "Add manually", "Create invite link", "Record a payment". |
| R-16 buzzwords | PASS | None found in the UI text. |
| R-20 identity | PASS | Plex, warm neutrals, the meter and square marks. |
| R-21 dark mode | PASS | Follows the device until someone picks a theme; both work. |
| R-29 palette | PASS | Warm neutrals plus one accent; amber and red only for states, always with a word. |
| R-30 clone | PASS | Not modelled on another product. |
| R-31 reasons | PASS | Written in `docs/design-decisions.md`. |

## Skill checklists (UI, mobile layout, copy, human)

All yes on the re-run. The mobile checklist failed on the first run on the bottom bar and the AI
link, and the copy checklist on "Partly Paid"; both are in the table at the top. The bottom bar
reserves its own height (last control 31px clear of it at every width tested) and respects the
safe-area insets. No emoji, title case or all-caps in UI text. Errors are text first ("Error:
Enter the total."), never colour alone. Text resizes (no fixed-height text boxes, zoom allowed).

## Click-through record (R-35)

- `/` on an empty database: goes to `/setup`. `/login` on an empty database: goes to `/setup`.
- Setup: empty submit shows three errors, focus on "Your name"; filled in, Enter creates the owner and opens Home.
- Sign out: back to `/login`. Wrong password: "Wrong username or password.", username kept, focus on Password. Right password: Home.
- Budgets: Add a budget (Groceries 800, Dining 200, Petrol 300 at 90%); the hint reads "80% of RM 800.00 is RM 640.00"; a duplicate "dining" shows "Another budget already has that name."; Edit changed Groceries to 850; Archive moved Dining out of the list; a new Dining was added.
- Settings: Create invite link (member, guest), Copy shows "Copied.", Revoke (Keep it, then Revoke invite) shows "Invite revoked. Its link no longer works."; Make member and Make guest change Mei's role with a notice; Reset password shows the temporary password in a dialog, Done closes it; Remove (Keep, then Remove) signs the person out and shows "Temp Person was removed."
- Invite links: member and guest accounts made; a used link says "This invite was already used."; a made-up link says "This invite link does not work."; a signed-in person opening a link is asked to sign out first.
- Temporary password: sign-in goes to "Choose a new password"; saving it opens Home.
- Transactions: Add manually saves and returns to the month list; Apply filters by budget, person and payment method narrows the list and shows the empty message when nothing matches; Previous month and Next month change the month (on Home too); Edit and Save changes; Delete (dialog) removes it and its page then says "That transaction is not available", where Back to transactions opens the list; Cancel on the form opens the list.
- Home: Scan receipt, Add manually, All transactions in November 2026 and Open Debts each open their page; "My Expenses" in the header opens Home.
- Scan receipt (no key): Choose a photo uploads it, the form opens with "Receipt reading is not set up yet, so type the details in below." and the photo; Use a different photo brings the picker back with focus on Choose a photo; saving attaches the photo; "Open the photo in a new tab" serves it (`image/jpeg`, `private, no-store`, `nosniff`); "Type it in without a photo" opens the empty form.
- Debts: Record a debt, Record a payment (an overpayment says "That is more than what is still owed."), Edit, Remove payment.
- Notifications: passing 80% of Dining and 100% of Petrol made notifications for all three people; the bell showed "Notifications, 1 unread"; opening the list cleared the count.
- AI settings: Save limit with "abc" shows the error and focuses the field, "2.50" shows "Limit saved."; with usage seeded in the scratch database, "Reset today's usage" (dialog) cleared it and focus went to "Today's usage was reset. Everyone can use the assistant again."
- Profile: Save name changes "Signed in as"; a wrong current password shows "That is not your current password." Settings links AI, Your profile and Back to Settings each open their page.
- Theme switch: dark and back, kept across pages.
- Signed out: `/transactions` and `/settings` go to `/login`; a receipt URL says "Sign in to see this receipt."

## Keyboard record

- Login: Tab order Username, Password, Sign in, Reset the owner password. Enter in Username with both empty: two errors, focus on Username. Enter with a wrong password: "Wrong username or password.", focus on Password. Enter with the right one: Home.
- Header (1280px): My Expenses, Home, Transactions, Budgets, Debts, Assistant, Settings, Notifications, Dark theme, Sign out; Enter on Sign out signs out. At 375px the bottom bar comes straight after the header controls, before the page.
- Transaction form: Merchant, Total (RM), Date (4 Tabs through its parts), Time (4 Tabs), Paid with (ArrowDown twice: Card), Budget (ArrowDown: Groceries), Receipt number, Note, Add an item (Enter adds Item 1), Item name, Quantity, Price each, Line total, Remove item 1, Add an item (Enter adds Item 2), Remove item 2 (Space removes it; the next Tab lands on Add an item), Save transaction, Cancel; Shift+Tab back to Save, Enter saves. Enter with nothing filled in: two errors, focus on Merchant. Done as the owner at 1280 and the member at 375.
- Settings: AI, Your profile, the role radios (ArrowRight picks Guest, ArrowLeft back to Member), Create invite link (Enter and Space both create; focus goes to the new link with the text selected), Copy (Enter: "Copied."), Revoke (Enter opens the dialog, Escape closes it with focus back on Revoke; Tab, Tab, Enter on Revoke invite confirms and focus goes to the notice), Remove and Reset password the same way.
- AI settings: Back to Settings, Daily limit, Save limit, the three price links. Enter in the field submits.
- Dialogs: Tab moves through Keep and the action button, then (after the browser's own controls) to Close; nothing behind the dialog took focus; Escape closes.

## Not verified

- Step 3, a phone on the home Wi-Fi: not run, it needs the owner's firewall command and a phone. The camera markup was checked instead: with touch emulation (`pointer: coarse`) the scan page offers "Take a photo" on an input with `capture="environment"` and `accept="image/jpeg,image/png,image/webp"`, beside "Choose a photo"; with a mouse only "Choose a photo" shows.
- A real receipt read and real assistant answers: no AI key, and no key was added.
- The assistant's "used up" notice clearing in the browser: reaching it needs a usable chat model, so a key. The rule is covered by unit tests only.
- Docker: not part of this gate run.

## Observations for the final review (not gate failures)

- After archiving a budget with the keyboard, focus falls to the page body and the next Tab leaves the page. Removing a debt payment the same way keeps the order (next Tab: Record a payment).
- `/debts` keeps the title "My Expenses" for the owner (earlier ruling).
- The Transactions month switcher offers Next month from the current month; Home stops at the current month.
- Chrome logs a verbose hint on the password forms (profile, change password) that they have no username field for password managers.
