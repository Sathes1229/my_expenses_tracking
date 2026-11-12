# Family Expense Tracker: Design

Date: 2026-11-12
Status: approved by owner, 2026-11-12

Decisions marked "(my call)" were made by the designer, not the owner. The owner can change any of them.

## 1. Intent

The owner wants one place to see where the household's money goes each month and how much budget is left. Family members (spouse, children) get their own logins so they can check the remaining budget before spending and log their own purchases. Friends can be invited too, with a narrower view. The owner also wants a record of money lent to other people, and an AI assistant that reviews spending and suggests improvements.

The owner will not read or change the code. Every decision in the code has to be maintainable by an AI agent working from this document and the repo.

### Success looks like

- Snap a receipt on a phone, and within a few seconds a filled-in transaction appears for review: shop, date, time, receipt number, items with quantity and price, grand total, payment method.
- Anyone in the household opens the dashboard and sees, per budget, how much is left this month.
- The owner is told, inside the app, when a budget passes its threshold in the current month.
- The owner can see at a glance who still owes them money.
- Assistant (chat) spending can never exceed the daily amount the owner set, by more than one request's worth.

### Non-goals (v1)

- Bank or e-wallet account syncing.
- Multiple currencies for expenses. Everything is Malaysian Ringgit (RM). (The AI budget is in US dollars because that is how the AI providers charge.)
- Native mobile apps. The web app must work well in a phone browser instead.
- Email, SMS, or push notifications. Notifications are in-app only in v1.
- More than one household per installation.

### Anti-goals (failure even if it "works")

- API keys or the `.env` file ending up in GitHub.
- Receipt data saved without the user seeing and confirming it (AI misreads must be fixable before saving).
- A member or guest being able to change budgets, settings, or invite people.
- A guest seeing other people's transactions, in any screen or through the assistant.
- A UI that is unusable on a phone screen.
- A UI that looks AI-generated ("vibe coded", in the owner's words).

## 2. Constraints

- **Phase 1, local:** runs on the owner's Windows 11 PC. Other household devices reach it over the home Wi-Fi at `http://<PC LAN IP>:<port>` (currently `192.168.10.86`). The server must bind to `0.0.0.0`, not only `localhost`. Plain HTTP on the LAN is acceptable in phase 1.
- **Phase 2, hosted:** moves to the owner's server behind their own domain with HTTPS. Must deploy as a Docker container with a mounted data volume. No code changes should be needed to move, only environment variables.
- Installed on the PC: Node.js 26, npm, Python 3.14, Docker. No PHP, no Rust.
- **Secrets:** all API keys and secrets live in `.env`. A committed `.env.example` lists every variable with empty values. `.gitignore` must exclude `.env*` (except `.env.example`), the database file, and uploaded receipt images.
- **Repo:** https://github.com/Sathes1229/my_expenses_tracking.git, branch `main`. All work is committed and pushed there.
- Timezone for "this month", "today" and receipt dates: `Asia/Kuala_Lumpur`. Months are calendar months.

## 3. Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| **Next.js (TypeScript), full-stack** | Node already installed, runs natively on Windows. The Vercel AI SDK gives one interface over Anthropic, OpenAI and DeepSeek, including image input and streaming. Auth, invites and notifications need a few libraries assembled. | **Chosen by owner.** |
| Laravel (PHP) | Login, notifications, encrypted fields and uploads built in. PHP must be installed first; multi-provider AI relies on a smaller third-party package. Best if the owner knew PHP. | Not chosen: owner won't touch code, and AI support is the specialised part. |
| Rust (Axum etc.) | Very fast, single binary. Logins, invites, uploads and forms built largely from scratch. Speed is not the bottleneck for a household app. | Not chosen. |

## 4. Users and roles

Login is by **username + password** (the owner said each person has their own username). No email address is required.

Three roles. **Owner** is the one person who set the app up. **Member** is for family. **Guest** is for friends (owner's decision: guests see budget names and what is left, plus their own entries, and nothing of other people's spending).

| Capability | Owner | Member | Guest |
|---|---|---|---|
| See each budget's name, remaining amount and state (fine / past threshold / over) | yes | yes | yes |
| See each budget's allocation and amount spent | yes | yes | no |
| See household totals, charts, other people's transactions | yes | yes | no |
| Add transactions (receipt or manual); they count against the household budgets | yes | yes | yes |
| See, edit, delete transactions | any | see all, edit/delete only their own | only their own |
| Create / edit / delete budgets | yes | no | no |
| Budget threshold notifications | yes | yes (my call) | yes (my call: it is the same information as "remaining") |
| Debts (money lent) | yes | no, private to owner (my call) | no |
| AI assistant | yes | yes | yes, but it only knows what the guest can see |
| Settings: invites, people, AI provider, AI budget | yes | no | no |
| Change own display name and password | yes | yes | yes |

**Rule for the builder:** visibility is enforced on the server for every query, not by hiding things in the UI. The assistant's context for a user is built from exactly what that user is allowed to see.

- **First run:** if no user exists, the app shows a one-time "create owner account" screen. After that, sign-up is closed; new accounts only come through invites.
- **Invites:** owner creates an invite in Settings, chooses **Member or Guest**, and gets a link to copy. The link is single-use and expires after 7 days (my call). Whoever opens it picks a display name, username and password. No email is sent; the owner shares the link themselves (WhatsApp etc.).
- Owner can revoke an unused invite, change a person's role between Member and Guest, and remove a person. Removing a person keeps their past transactions (shown with their name) so totals don't change.
- **Forgotten passwords (my call):** the owner can reset anyone's password from Settings; the app shows a one-time temporary password that must be changed at next login. If the owner forgets their own password, they set `OWNER_RESET_TOKEN` in `.env`, restart, and use it once on a reset page.
- **Login protection (my call):** failed logins are rate-limited per username and IP from day one, since phase 2 is on the public internet.

## 5. Features

### 5.1 Dashboard (home)

For owner and members, for the current month:
- Each budget: allocation, spent, remaining, and a clear state (fine / past threshold / over budget).
- Total spent this month vs total allocated.
- Spending by budget category (a simple chart).
- Recent transactions (who, where, amount, payment method).
- Debts summary for the owner only: total outstanding and the people who owe.
- Primary actions: **Scan receipt** and **Add manually**.
- Access to the AI assistant.
- Month switcher to look at previous months.

For guests: each budget's name, remaining amount and state; their own recent transactions; the same two primary actions; the assistant.

### 5.2 Transactions

Fields:
- Merchant / company name
- Date and time
- Receipt number (optional)
- Line items: name, quantity, unit price, line total (optional; a manual entry may have none)
- Grand total (required)
- Payment method: **QR, Cash, Card, Other** (my call: "Other" covers bank transfer etc.)
- Budget category (required, picked from the owner's budgets; "Uncategorised" exists as a fallback and has no allocation)
- Note (optional)
- Receipt image (if scanned)
- Created by (the user who added it)

**Receipt flow:**
1. User uploads or photographs a receipt (phone camera via the file input).
2. The image is sent to the configured vision-capable AI provider, which returns structured data matching the fields above.
3. A review form opens pre-filled. The user corrects anything wrong, picks the budget category (AI may suggest one from the existing budget names), and saves.
4. If reading fails or no vision provider is configured, the user gets a clear message and the same form opens empty with the image attached, so they can type it in.

The original image is kept on disk and viewable from the transaction by anyone allowed to see that transaction.

**Manual flow:** the same form, empty, without an image.

Transactions list with filters by month, budget, person and payment method (guests see only their own, so no person filter).

### 5.3 Budgets

Owner creates budgets, each with:
- Name (e.g. Groceries, Petrol, School)
- Monthly allocation in RM
- Threshold, as a **percentage of the allocation**, default 80% (my call; the UI also shows the RM value it equals)

Budgets repeat every month automatically with the same allocation. Changing an allocation applies from the current month onward (my call; past months keep the value they had).

### 5.4 Notifications

- Triggered when a saved or edited transaction pushes a budget's month-to-date spending past its threshold, and again when it passes 100%.
- Each budget notifies at most once per level per month (no repeats for every later transaction).
- Shown as an unread badge on a bell, a notification list, and a banner on the dashboard while the budget is over threshold.
- Wording for guests must not reveal amounts they cannot otherwise see (state and remaining only).
- In-app only in v1.

### 5.5 Debts (owner only)

- Record: person's name, amount lent, date lent, optional note, optional due date.
- Partial repayments: record each payment with amount and date. Outstanding = lent minus repaid.
- Status: unpaid / partly paid / paid (derived from the amounts).
- List grouped by person with total outstanding per person.
- Debts are separate from budgets: lending money does not count as spending against a budget.

### 5.6 AI assistant ("financial consultant")

- A chat page. The user asks questions in their own words (English or Malay; the assistant answers in the language used).
- Each request includes a compact summary for context, limited to what that user may see:
  - Owner and members: budgets and allocations, spending per category for the last 3 months, top merchants, payment method split. Owner only: debt totals.
  - Guests: budget names with remaining amount and state, and the guest's own transactions.
  - Never raw receipt images.
- The assistant gives advice on spending and budgets. It must not present itself as a licensed financial advisor.
- Chat history is saved per user and private to that user.

### 5.7 Daily AI budget (owner's decision)

The owner sets one **daily AI budget in US dollars, shared by everyone** (default US$1.00). **It caps the assistant (chat) only** (owner's decision).

- Every assistant message records its token usage and an estimated cost. Cost is tokens multiplied by that model's price from a price table kept in the app.
- **Receipt reading is never capped or blocked** and does not count against this budget.
- When today's total reaches the budget, the assistant stops accepting new messages for everyone, owner included, and says the daily AI budget is used up and will be available again tomorrow.
- The count starts again at midnight, `Asia/Kuala_Lumpur`.
- The owner can, in Settings, at any time:
  - **Reset today's usage** so everyone can continue.
  - **Change the daily amount**, effective immediately.
- A request that starts while under budget is allowed to finish even if it goes slightly over. Each request has a capped answer length so the overshoot stays small.
- Everyone sees whether the assistant is available today and roughly how much is left. The owner also sees today's usage total and per person (my call).
- The cost is an estimate. The AI provider's own bill is the real figure. The Settings page says so.

### 5.8 Settings (owner)

- **People & invites:** list people and roles, create/revoke invites, change role, reset password, remove.
- **AI provider:** choose provider and model separately for:
  - **Chat:** Anthropic, OpenAI, or DeepSeek.
  - **Receipt reading:** Anthropic or OpenAI only (DeepSeek's API is text-only, so it is not offered here).
  - Only providers whose key is present in `.env` can be selected. The page shows which keys are configured (yes/no, never the key itself).
  - Models are picked from a fixed list per provider, each with a known price, so cost can always be calculated (my call: no free-text model names).
- **AI budget:** daily amount, today's usage, reset button (5.7).
- **Profile:** change own display name and password (everyone gets this part).

## 6. Secrets and configuration

`.env` (never committed), with `.env.example` committed:

- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`: any may be empty.
- `OWNER_RESET_TOKEN`: normally empty (section 4).
- Auth secret, app base URL, database path, uploads path, and any other secret the builder needs.

API keys are entered by editing `.env` and restarting the app, not through the UI. This follows the owner's instruction that keys live in `.env`. The Settings page only selects which configured provider and model to use.

## 7. Technical decisions

- **Framework:** Next.js (App Router), TypeScript.
- **AI:** Vercel AI SDK with the Anthropic, OpenAI and DeepSeek providers. Structured output (schema-validated) for receipt extraction; streaming for chat. Token usage from each assistant response feeds the daily AI budget.
- **Database:** SQLite file, accessed through a typed ORM with migrations. One file, easy to back up and move to the server.
- **Auth:** an established auth library supporting username + password and secure sessions. No hand-rolled password hashing.
- **Uploads:** stored on local disk under a configurable directory, served only to logged-in users who may see the transaction.
- **Deployment, phase 2 (my call):** Dockerfile + compose file; the database and uploads live on a mounted volume. The image must build for both x86-64 and ARM64. The compose file does not bundle a TLS proxy; the deploy notes include a short Caddy example for HTTPS on the owner's domain, to use if the server has no proxy already. The app assumes it may be reachable from the public internet.

## 8. UI direction

Owner's direction: **calm and plain, like a banking app. No colour preferences. It must not look "vibe coded".**

- Design read: household finance web app for a family, in a calm banking-style visual language, dials ENERGY 1 / RHYTHM 2 / MOTION 1.
- The numbers are the focal point: amounts left, amounts spent. Tabular figures, clear hierarchy, generous spacing.
- Restrained palette chosen by the builder: neutrals plus one accent. Budget states use colour together with text or an icon, never colour alone.
- Explicitly avoid the common AI-generated look: purple/blue gradients, glass blur, glow, pill-shaped everything, sparkle icons, emoji as icons, decorative badges, identical card grids, template animations.
- Motion limited to state changes and feedback.
- Mobile-first: most receipt scans happen on a phone. Must also work on desktop.
- UI text in English (my call).
- Light and dark mode with a working toggle.
- App name shown as plain text "My Expenses" until the owner chooses a name. No generated logo.
- The antislop rules and their Delivery Gate apply to all UI work.

## 9. Left to the builder

- Exact library choices within section 7 (auth library, ORM, chart library, UI component approach), as long as they are mainstream and maintained.
- The fixed model list per provider and its price table.
- Image size limits and compression before sending to the AI.
- The answer-length cap per AI request.
- Page structure and navigation beyond the areas named here (Dashboard, Transactions, Budgets, Debts, Assistant, Settings).
- Exact colours and typeface within section 8.
- Test strategy.
