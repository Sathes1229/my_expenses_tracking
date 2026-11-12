# Design decisions

Every visual decision in the app, with the one-line reason for it. The tokens live in
`src/app/globals.css`; the components in `src/components/`; `/styleguide` (development only)
shows them all. Change a value here and in `globals.css` together.

## Direction

- Owner's direction: calm and plain, like a banking app; no colour preferences; it must not look vibe coded.
- Design read: household finance web app for a family, in a calm banking-style visual language.
- Dials: ENERGY 1 (quiet), RHYTHM 2 (consistent, with a few deliberate breaks such as the focal amount), MOTION 1 (state changes only).

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Typeface | IBM Plex Sans (variable, through `next/font`, self-hosted) | Made for dense, legible interfaces, has true tabular figures, and reads institutional, which suits a banking-style tool. |
| Figures | `tabular-nums` on every amount (`<Money>`) | Amounts in a column line up digit for digit, so they can be compared at a glance. |
| Palette | Warm neutral scale plus one deep blue-green accent | Warm neutrals feel calmer than cold grey; a single accent keeps actions and links unmistakable. |
| Accent use | Primary buttons, links, focus ring. Nothing else | An accent that appears everywhere stops pointing at anything. |
| State colours | Amber for near limit, red for over, always with a word | Semantic only, so colour never carries meaning alone. |
| "On track" | Neutral grey, not green | Only states that need attention get colour, so problems stand out in a list of budgets. |
| Radius | 6px on controls, 10px on surfaces, nothing pill-shaped | Two radii tell controls from containers; pills read as the generic AI look. |
| Shadow | Only on overlays (the dialog) | Shadow marks the one thing that sits above the page; everything else lies flat. |
| Identity motif | The meter: a thin square-ended bar with a tick at the threshold | One instrument-like mark, repeated for budgets, the dashboard and the AI budget only, so it stays meaningful. |
| Meter fill | Ink until the threshold, amber from it, red past the allocation | Same rule as the budget state, so bar and word always agree. |
| Square details | Square state marker, square-ended meter, square-capped icons | Echo the flat terminals of Plex, giving the app one consistent voice. |
| Focal point | The amount that matters on each screen, set in `text-focal` (34 to 44px, semibold) | The page title is 24px; the remaining or total amount is what people open the screen for. |
| Theme | Light and dark through CSS variables; follows the device until someone picks one with `ThemeToggle` | No brand reason to force either; the choice is stored per device and applied before first paint. |
| Motion | 140ms colour and width transitions on hover, press and meter changes; none under reduced motion | Feedback that a state changed, never decoration; the focus ring appears instantly. |
| Icons | Five hand-drawn inline SVGs (bell, camera, plus, close, menu), no icon library | Used only where an icon is faster to read than a word; a library would add the default look. |
| Tap targets | Every control at least 44px tall | Most receipts are scanned on a phone. |
| Field layout | Visible label, hint under it, error above the control | The label never disappears; a phone keyboard cannot cover the error. |
| Controls | Native `<select>` and `<dialog>` | Phones show their own picker; the browser handles focus trapping and Escape. |
| Palette lock | Tailwind's default colours, radii and shadows are switched off | Every screen can only use these tokens, so later pages stay consistent. |
| Navigation | Bottom bar below 1024px, a row in the header from 1024px; text labels, no icons | The main places stay one thumb tap away on a phone; below 1024px the header row would wrap. Words are clearer than new icons. |
| Current page | A 3px square ink bar (on top of the item in the bottom bar, under the label in the header) plus `aria-current` | Marks where you are without relying on colour, and echoes the square meter ends. |
| Dashboard layout | One column on phones; from 1024px the budget picture on the left, latest transactions and debts in a 20rem column beside it | The month reads top to bottom by importance on a phone and without scrolling on a wide screen. |
| Spending bars | Plain 10px bars in `meter-fill`, no track, scaled to the largest amount, the RM amount written beside each | A picture of numbers already on screen; no track and no tick keep them distinct from the meter. |
| Attention banner | A surface with a 1px red border when a budget is over, amber when only near limit, each budget named with its state word | Calls out what needs a look before the full list, with the word carrying the meaning. |

## Colour tokens

| Token | Light | Dark | Used for |
|---|---|---|---|
| `canvas` | `#F5F4F0` | `#161513` | Page background |
| `surface` | `#FCFBF8` | `#1E1D1A` | Cards, fields, dialogs |
| `sunken` | `#EDEBE5` | `#292724` | Hover and disabled fills |
| `line` | `#E2DFD7` | `#33312C` | Dividers (decorative) |
| `line-strong` | `#8C8679` | `#7F796E` | Control borders |
| `ink` | `#1D1B17` | `#EDEAE4` | Text, meter tick |
| `muted` | `#5C574E` | `#A9A397` | Secondary text, hints, "On track" |
| `accent` | `#1F5E4B` | `#7DC2A6` | Primary action, links, focus ring |
| `accent-hover` | `#174B3C` | `#98D2BB` | Primary hover and press |
| `on-accent` | `#FFFFFF` | `#0E2A20` | Text on the accent |
| `danger` | `#A3341F` | `#F0907D` | Destructive action, errors, "Over" |
| `danger-hover` | `#862A18` | `#F5AA9B` | Danger hover and press |
| `on-danger` | `#FFFFFF` | `#2B0E08` | Text on danger |
| `warning` | `#8A5800` | `#E2AE55` | "Near limit" |
| `meter-track` | `#DCD8CF` | `#3A3833` | Meter, unused part |
| `meter-fill` | `#3B3832` | `#CFCAC0` | Meter, used part (on track) |

## Contrast (WCAG 2.x, checked with the antislop contrast tool)

Text needs 4.5:1; borders, focus ring and meter parts need 3:1.

| Pair | Light | Dark |
|---|---|---|
| ink on canvas | 15.62 | 15.20 |
| ink on surface | 16.62 | 14.04 |
| ink on sunken | 14.42 | 12.40 |
| muted on canvas | 6.52 | 7.28 |
| muted on surface | 6.93 | 6.72 |
| muted on sunken | 6.02 | 5.94 |
| accent (links) on canvas | 6.91 | 8.81 |
| accent (links) on surface | 7.35 | 8.14 |
| accent (links) on sunken | 6.38 | 7.19 |
| on-accent on accent | 7.61 | 7.40 |
| on-accent on accent-hover | 9.96 | 8.95 |
| on-danger on danger | 6.84 | 7.69 |
| on-danger on danger-hover | 8.91 | 9.50 |
| danger (error text) on canvas | 6.22 | 7.81 |
| danger (error text) on surface | 6.61 | 7.22 |
| warning on canvas | 5.49 | 9.05 |
| warning on surface | 5.84 | 8.36 |
| line-strong (control border) on canvas | 3.29 | 4.23 |
| line-strong (control border) on surface | 3.50 | 3.90 |
| meter-fill on meter-track | 8.21 | 7.17 |
| warning fill on meter-track | 4.25 | 5.81 |
| danger fill on meter-track | 4.81 | 5.01 |
| ink tick on meter-track | 12.09 | 9.75 |
| meter-fill (spending bar) on canvas | 10.61 | 11.18 |
| meter-fill (spending bar) on surface | 11.29 | 10.32 |

The focus ring is the accent, so it meets 3:1 against canvas and surface by the link rows above.
Where the tick crosses an amber fill the two are close in light (2.85), but the tick reaches 4px
above and below the bar onto the surface (16.62 light, 14.04 dark), so it always shows.
The meter track itself is quiet on purpose; every meter sits beside the amounts written as text.
