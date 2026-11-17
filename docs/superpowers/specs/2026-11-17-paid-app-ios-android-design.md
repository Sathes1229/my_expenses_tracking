# My Expenses as a paid app for iPhone and Android

Approved direction from the owner on 2026-11-17. It builds on `2026-11-12-expense-tracker-design.md`
(the household app as it is today) and `2026-11-15-guest-budget-names-only-design.md` (what guests
see). Where this document and those disagree, this one wins.

## 1. Intent

The owner wants to sell My Expenses to families and individuals in Malaysia, as an app in the App
Store and the Play Store, with a free plan and a paid plan. People should find it useful enough to
pay for it.

What they pay for is the AI: the assistant that answers questions about their spending, and receipt
scanning that fills in an entry from a photo. Around that, three features make the app worth keeping:
budget categories they set up themselves, a monthly report, and export to Excel.

Today the app serves **one household on one server**: one owner, members and guests who join through
invite links, the owner resets passwords, and one AI key is shared. It runs in Docker on a Contabo VPS
at `https://myexpenses.sathes7.duckdns.org`, with SQLite and Better Auth (username sign-in).

### Success looks like

- A family in Malaysia finds the app in either store, signs up, and records spending on day one.
- They try the assistant and receipt scanning on the free plan and see why the paid plan is worth it.
- A household that pays gets the paid features on every phone and in the browser, whoever paid where.
- The owner's own household keeps working through every phase, with its data intact.

### Non-goals

- Working offline.
- Rewriting the app as a native app (approach B below).
- Linking bank accounts or importing statements.
- Currencies other than ringgit.
- Languages other than Bahasa Melayu and English.

### Anti-goals (failure even if it "works")

- One household seeing another household's data, in a page, an export, the assistant or a photo.
- Apple rejecting the app as "just a website".
- AI costs growing faster than subscription income: free users must not be able to run up a bill.
- A guest seeing household figures through any new feature (reports, export, assistant, push).
- Losing or mixing up the owner's existing household data during the move to many households.

## 2. Constraints

- **Development machine is Windows.** Android builds run on it. iOS builds need macOS and Xcode, so
  they run on a hosted macOS build service or a borrowed Mac.
- **Store accounts.** Apple Developer Program (about USD 99 a year) and Google Play Console (about USD
  25 once). Selling subscriptions also needs each store's paid-apps agreement, bank and tax details.
- **Apple review.** Apple rejects apps that only wrap a website (guideline 4.2), so the iOS app needs
  real phone features. Apps that let people create an account must let them delete it in the app.
  Review needs a working demo account.
- **Store payment rules.** In the iOS and Android apps, a subscription that unlocks features must be
  sold through Apple's and Google's own billing. In Malaysia the iOS app may not point people to a
  cheaper web payment. The stores take a cut (15% for small developers, as far as we know).
- **Google Play.** New personal developer accounts must run a closed test with about 12 testers for
  14 days before the app can go public.
- **Privacy law.** Malaysia's PDPA applies: a privacy notice, consent, and a way to delete data.
- **Receipt scanning needs a model that reads images.** The household's DeepSeek key cannot, so
  scanning has never run on the live site. The models list already has image-capable models (Claude
  Haiku 5.5, GPT-6 Luna). Each scan costs a little; the price of the paid plan has to cover it.
- **One server.** SQLite on one Contabo VPS (6 vCPU, 11 GiB RAM) is enough for the first paying
  households. Off-server backups become a must once other people's data lives there.
- **Next.js 16** with breaking changes: read `node_modules/next/dist/docs/` before writing code
  (see `AGENTS.md`).

## 3. Approaches considered

| | A. Wrap the existing app (Capacitor) | B. New native app (React Native or Expo) | C. Stay a web app, Android only in Play Store |
|---|---|---|---|
| What | iPhone and Android apps that open the live site, plus phone features: push notifications, camera, in-app purchase | Rewrite every screen as a phone app; the server only serves data | As now; Android wrapped for Play Store, iPhone keeps "Add to Home Screen" |
| Work | Medium; the existing, tested code is reused | Most; every screen is built twice (web and app) | Least |
| Updates | Most changes go live without store review | Every change goes through review | Live at once |
| Subscriptions | Apple, Google and web | Apple, Google and web | No in-app purchase on iPhone; not in the App Store |
| Risk | Apple may call it a website; push and in-app purchase answer that | Longest time to the first paying customer | iPhone users cannot find it |

**Picked: A.** It reaches both stores with the least work and keeps everything already built and
tested. Push notifications for budget alerts and in-app purchase give Apple a reason to accept it.
B only pays off if the app had to work offline, which is a non-goal. C misses iPhone users, who are
a large share in Malaysia.

## 4. Product decisions (made by the owner)

### Who it is for

- **Families and individuals in Malaysia.** An individual is a household of one: an owner with no
  members. A family is what exists today: owner, members and guests.

### Free and paid plans: "a taste of AI first"

- **Free plan:** expenses, budgets and categories, the monthly report, members and guests, and a
  small AI allowance each month (for example 5 receipt scans and 10 assistant questions).
- **Paid plan:** a large AI allowance with a fair-use limit, and export to Excel.
- **One subscription per household.** The owner pays; every member and guest of that household gets
  the paid features.
- The allowance numbers and the prices (monthly and yearly, in RM) are settings that can change
  without a code change. They are not fixed yet.
- Allowances reset on the 1st of each month, Malaysia time.
- When an allowance runs out, the app shows what was used and how to subscribe. Everything else keeps
  working.

### New features

- **Your own budget categories.** Owners already create, edit and archive budgets with a name, an
  amount and a warning level. New: a household starts from a set of common Malaysian categories it
  can rename or remove, so the app is not empty on day one.
- **Monthly report.** A new Reports page (see 6.1). Free.
- **Export to Excel.** A spreadsheet of the transactions in view (see 6.2). Paid.

### Language

- **Bahasa Melayu and English.** Every screen, message, e-mail and store listing exists in both.
- The first language follows the phone or browser; each person can switch in Profile.
- The assistant already answers in either language.

## 5. Phases

Each phase ships on its own and keeps the owner's household working.

1. **New features on today's app:** monthly report, Excel export, starter categories, two languages.
   These help the owner's household straight away and need no billing.
2. **Many households on one server:** sign-up, separate data per household, password reset by e-mail,
   account deletion, privacy notice and terms.
3. **Free and paid plans:** monthly AI allowances, subscriptions through Apple, Google and the web,
   one paid status per household.
4. **Store apps:** Capacitor apps for iOS and Android with push notifications, then TestFlight and the
   Play closed test, then store review.

Phase 1 is specified in full below. Phases 2 to 4 have their decisions recorded here, and each gets
its own short design pass before it is built, for the parts listed under "Still to decide".

## 6. Phase 1 in detail

### 6.1 Monthly report

A new page, **Reports**, in the menu after Budgets, for the owner and members. Guests get the same
404 they get for Notifications, since the report shows household figures. Months move with
"Previous month" and "Next month" like Transactions, stopping at the latest month an entry can be in
(`latestMonth()` in `src/lib/time.ts`).

The layout the owner picked (option A with the line from option C):

```
November 2026 report
Compared with October 2026
+--------------------------------------+
| Spent this month                     |
| RM 1,474.40                          |
| RM 162.40 (12%) more than October    |
+--------------------------------------+
| By budget                            |
| Groceries      RM 525.00   +45.00    |
| [=========== November ]              |
| [==========  October  ]              |
| Utilities      RM 410.00   +15.00    |
| ...                                  |
+--------------------------------------+
| Spending so far, day by day          |
| [cumulative line, November]          |
| [cumulative line, October]           |
| By 17 Nov you spent RM 1,474.40.     |
| By 17 Oct you had spent RM 690.00.   |
+--------------------------------------+
```

- **Summary:** total spent in the month, and the difference from the previous month's total in RM
  and percent (up, down or the same). With no entries last month, it says so instead of a percent.
- **By budget:** one row per budget with spending in either month, including Uncategorised and
  budgets archived since (grouped the way Home groups them, by budget id). Each row has the amount,
  the change in RM, and two bars on one scale: this month and last month. Sorted by this month's
  spending, largest first.
- **Day by day:** two cumulative lines on one chart, this month and last month, by day of the month.
  In the current month the line stops at today. Below it, one sentence comparing the two months up to
  the same day. My call: this sentence is the fair comparison mid-month, since the summary compares
  against all of last month.
- Figures are built on the server from the same reads as Home, so role rules hold.
- Charts have a text alternative: the same numbers as a table or list for screen readers.
- Works at phone width first (the stores will show it in a phone frame).

### 6.2 Export to Excel

- A button **Export to Excel** on Transactions. It exports the month and filters in view, as an
  `.xlsx` file named like `my-expenses-2026-11.xlsx`.
- **Sheet "Transactions":** date, time, merchant, total (RM, as a number), budget, paid with, added by,
  receipt number, note. One row per transaction, newest first, and a total row.
- **Sheet "Items":** date, merchant, item, quantity, unit price, line total, for transactions that
  have items.
- It uses the same visibility rules as the Transactions list: a guest's export holds only their own
  entries.
- Column headings follow the person's language.
- In phase 1 every signed-in person can export. Phase 3 limits it to the paid plan.

### 6.3 Starter categories

- When a household has no budgets, Budgets shows **"Start with common budgets"**: a list of common
  categories with a tick box and an amount for each. The owner ticks the ones they want, fills in
  amounts and saves; each becomes an ordinary budget they can rename, change or archive.
- The starter list, in the owner's language: Groceries / Barang dapur, Petrol / Minyak kereta,
  Eating out / Makan luar, Utilities / Bil utiliti, Phone and internet / Telefon dan internet,
  Children's school / Persekolahan anak, Transport and tolls / Pengangkutan dan tol,
  Health / Kesihatan. My call; the owner can change the list.
- Budget names are stored as typed. A budget made from the Malay list keeps its Malay name if the
  person later switches to English.

### 6.4 Two languages

- Every piece of text on every existing and new screen, in both languages: pages, buttons, form
  errors, empty states, dialogs, the sign-in and invite pages, alerts, and page titles.
- First visit: the language comes from the browser or phone. After sign-in, each person's choice is
  saved on their account and used on every device. A switch in Profile changes it.
- Month names follow the language (for example "Ogos 2026" and "August 2026"). Money stays
  "RM 1,234.50" in both.
- Server error messages that reach a form (for example "Enter a total up to RM 1,000,000.00.") are
  translated too.
- Budget names, merchant names and notes are the household's own text and are never translated.
- The assistant keeps answering in the language of the question.

## 7. Phases 2 to 4: decided and still to decide

### Phase 2: many households

Decided:
- Many households on one server. Every person belongs to exactly one household, and every read,
  write, export, report, photo and assistant context is limited to the viewer's household.
- Anyone can sign up from the sign-in page; signing up creates a new household with them as owner.
  Members and guests still join through invite links.
- Public sign-up sits behind a switch that stays **off** until phase 3's monthly AI allowances are
  live and the privacy notice and terms are final. Until then only invited people join, so strangers
  cannot use the business's AI with no limit. My call.
- A person belongs to one household. Someone who already has a household and opens an invite to
  another one is told so. If they are alone in their household, they can leave it to join: their old
  household and its entries are deleted after a clear warning (entries are not moved). If others are
  in it, they must first hand it over. Owners can hand the household to a member ("Make owner"). My
  call.
- AI controls move from household owners to the operator: model choice and one business-wide daily
  spending cap, which now covers receipt scans as well as the assistant (this replaces section 5.7 of
  the 2026-11-12 design, where scans were never blocked). Owners keep the view of their household's
  usage by person. My call.
- Debts stays for every household, owner only, free (it costs nothing to run). The owner's assistant
  keeps the debt totals. My call.
- The owner's current household, with all its data, becomes the first household. The QA test people
  and entries on the live site are removed before public launch (see the "Live QA test data" note
  the owner asked to keep for now).
- Password reset by e-mail, in both languages. The owner's reset for members and guests stays.
- Delete account inside the app. A member or guest deleting themselves leaves their entries under
  their name, like Remove today. An owner deleting the account deletes the whole household after a
  clear warning.
- Privacy notice and terms pages in both languages, linked from sign-up and Profile.
- AI keys belong to the business, not to households. Receipt scanning uses an image-capable model.
- Daily off-server backups of the database and receipt photos.

Still to decide in the phase 2 design:
- Sign-in by e-mail for everyone, or keep usernames for invited members and guests.
- E-mail sending service.
- How the operator (the business owner) sees households and subscriptions.
- A proper domain name for a paid product instead of the DuckDNS address.
- Whose legal name the privacy notice and terms carry: the owner as an individual or a registered
  business. The notice must name who controls the data and say that receipts and questions go to AI
  providers outside Malaysia. The builder drafts both texts; a lawyer reviews them before public
  sign-up is switched on.

### Phase 3: free and paid plans

Decided:
- Plans Free and Paid, one status per household, the allowances and paid-only features in section 4.
- AI use is counted per household per month (questions and scans). The existing daily AI spending
  cap stays as a safety net for the business.
- Subscriptions can be bought in the iOS app (Apple), in the Android app (Google), and on the web.
  A household that paid anywhere is Paid everywhere.
- The iOS app does not mention or link to web payment.
- The operator can mark a household **Paid at no charge**: the owner's own household (so it keeps
  every feature it has today) and the demo household for store review. My call.
- A guest's assistant questions and scans count against the household's allowance, like everyone
  else's. When the allowance runs out, a guest sees only that the household's AI allowance for the
  month is used up, with no figures; the owner and members see the usage. My call.

Still to decide in the phase 3 design:
- Prices, monthly and yearly.
- Web payment provider (FPX and cards in Malaysia).
- Whether to use a subscription service that merges Apple, Google and web purchases, or build it.
- What happens to a household's data and allowances when a subscription ends.

### Phase 4: store apps

Decided:
- Capacitor apps for iOS and Android that open the live site.
- Phone features: push notifications for budget alerts (to owners and members only, never guests),
  the camera for receipts, in-app purchase, and invite links that open in the app.
- Android builds on the Windows machine; iOS builds on a hosted macOS build service.
- iOS goes to TestFlight first, Android to the Play closed test (about 12 testers for 14 days), then
  both to public review with a demo household.

Still to decide in the phase 4 design:
- Developer accounts as an individual or as a registered business (a business account needs company
  registration and a D-U-N-S number for Apple). This should match the legal name chosen in phase 2.
- App name and store listing text in both languages, screenshots and privacy labels.

## 8. Left to the builder

- Libraries: the chart library, the Excel writer, the translation setup (check the Next.js 16 docs
  first), Capacitor plugins.
- Database changes and migrations for each phase, and how the household id reaches every query.
- The exact text of every message, in both languages, following the existing tone (plain, short,
  says what happened and what to do).
- Tests for every rule here, including that a guest's report and export data hold no household
  figures, the way the guest tests check returned data and not only what is shown.
