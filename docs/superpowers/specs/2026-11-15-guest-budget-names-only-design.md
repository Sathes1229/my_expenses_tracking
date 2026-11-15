# Guests see budget names only

Small change, approved by the owner on 2026-11-15. It replaces the guest rows of the role table in
`2026-11-12-expense-tracker-design.md` (section 3, and the guest lines of 5.5 and 5.6).

## Why

Guests are friends of the household. The owner found that a guest could see what is left in each
budget, which shows indirectly how much the family has spent. Members are family and see
everything; guests should not learn anything about the household's spending.

## What a guest sees

| Place | Before | After |
|---|---|---|
| Budgets page | Name, what is left, state | Names only |
| Home | "Left in each budget" with amounts and state | No budget section: only their own recent transactions and the two actions |
| Transactions | Their own | Unchanged; the add and edit forms still offer every budget name |
| Assistant | Budget names, what is left and state, their own spending | Budget names and their own spending only |
| Notifications | Threshold and over-budget alerts | None (the alert itself says a budget is over) |
| Wording | "Sees budget names, what is left and their own entries." | "Sees budget names and their own entries." (invite form, people list, invite page) |

Unchanged: a guest's entries still count against the household budgets, and owner and members see
them. Only the owner manages people, invites, budgets and debts (owner's call, kept; the owner may
revisit whether members should manage too).

## Approaches

- **Strip the figures on the server (picked).** The reads that serve a guest stop computing or
  returning remaining amounts, states and alerts, so nothing reaches a guest's browser.
- Hide the figures in the pages only. Rejected: the amounts would still be sent in the page data
  and could be read from it.
- Give guests their own budgets. Rejected: not asked for; guests share the household budgets.

## Constraints

- A guest's page data and assistant prompt must hold no amount, remaining amount or state of any
  budget. Tests check the returned data, not only what is rendered.
- Owner and member views do not change.

## Left to the builder

The exact shape of the guest budget type, how the empty home page reads for a guest, and the
unread badge (it must show nothing for guests).
