# Bovogo Admin — Design Brief

Input for the Stitch redesign (`upload_design_md` → `create_design_system_from_design_md`),
and the human-readable spec for implementing its output.

Every colour value below was **computed and validated**, not picked by eye — see
[Validation](#validation) for what was run and what failed. Do not substitute
"close enough" hexes; the failing ones are recorded so they don't get retried.

---

## 1. What this product is

An internal operations console for **WeGotcha LLC** staff running **Bovogo**, a Texas
intercity carpooling service. Not a customer surface. Its users are a small ops team
doing four jobs:

- **Watching** — is the marketplace healthy right now?
- **Adjudicating** — a Sailor reported something; a Voyager's documents look wrong.
- **Unblocking** — a payout is stuck; a ticket is aging.
- **Auditing** — what happened, who did it, when.

Design consequence: this is a **working tool for repeat users**, not a landing page.
Density is a feature. Discoverability matters less than speed on the twentieth visit.
Nothing here should be optimised for first impressions.

## 2. Brand

Bovogo's palette is warm, natural and green-biased rather than grey. As shipped in the
mobile app (`mobile/artifacts/mobile/constants/colors.ts`) it is a **light** palette —
cream ground, forest ink, gold accent — and it independently converged with the original
MVP's colours, so it is real and ownable rather than arbitrary.

The admin runs dark (§3), which changes what each colour can do:

| Role | Hex | On cream (mobile) | On the dark admin |
|---|---|---|---|
| Forest | `#1B3D2F` | 11.16:1 — the workhorse ink | 1.39:1 — **unusable** |
| Gold | `#C4954A` | 2.53:1 — fill only | 6.15:1 — usable as text |
| Cream | `#F8F7F3` | page ground | 15.56:1 — becomes the ink |
| Sage | `#8A9A8D` | 2.76:1 — fill only | 5.63:1 — secondary text |

The admin **inverts** the mobile palette's roles rather than reusing them. Cream stops
being the ground and becomes the ink; forest stops being the ink and drops out entirely.
Gold and sage, which are decorative-only on mobile, become legitimate text colours here.
Don't copy `colors.ts` values across by name — the names mean different things per theme.

The product voice lives in `mobile/artifacts/mobile/constants/voice.ts`: second person,
present tense, concrete over abstract, one line under ~12 words. **All lines are
original** — never quote films, songs or books. The admin uses a drier register than
the consumer app (staff don't need to be charmed on every screen) but empty states and
errors should still sound like the same company.

## 3. Theme — dark (settled 2026-08-17)

**The admin is dark.** Ground is a deep forest `#12211B`, not the neutral grey the
current dashboard uses — the brand's green bias carries into the dark theme even though
its light values don't.

This is a deliberate trade, and implementers should understand what was traded so they
don't try to "fix" it later:

- **Forest `#1B3D2F` cannot appear on dark.** It measures 1.39:1 against the ground —
  invisible. The brand's primary colour is simply absent from this theme; forest's role
  as ink is taken by cream `#F8F7F3` (15.56:1), inverting the light palette.
- **The chart gold is re-stepped.** `#C4954A` doesn't hold in the dark lightness band as
  a series colour, so series slot 2 is `#C67F20`. Gold's *identity* use is unaffected —
  `#C4954A` reads 6.15:1 as text on the ground, better than it manages on cream.

What dark buys in return is real: ops staff work long shifts in this tool, and three
brand values that **fail** on cream work unchanged here — sage `#8A9A8D` becomes a usable
secondary text colour (5.63:1, versus 2.76:1 on cream), and the mobile app's `warning
#D97706` and `info #0EA5E9` pass as text as-is (5.24:1, 6.02:1) where the light theme
would have needed darker custom steps. The dark theme is in that sense *closer* to the
shipped mobile tokens than a light admin would have been.

## 4. Tokens

Tailwind v4, CSS-first — there is no `tailwind.config.js`. These go in an `@theme`
block in `admin/src/index.css`, which is currently 7 lines with no tokens at all.

Contrast figures below are stated against **both** surfaces, because the admin renders
status and meta text directly on cards as well as on the page ground, and the card is
the stricter of the two.

```css
@import "tailwindcss";

@theme {
  /* surfaces — deep forest, not neutral grey */
  --color-ground:       #12211B;   /* page plane */
  --color-card:         #1E2C26;   /* raised surface */
  --color-inset:        #27342E;   /* wells, table zebra */

  /* lines */
  --color-border:       #2E3B35;
  --color-grid:         #263029;   /* hairline, one shade off ground */

  /* ink                                   ground / card */
  --color-ink:          #F8F7F3;   /* 15.56 / 13.57  primary */
  --color-ink-soft:     #8A9A8D;   /*  5.63 /  4.91  secondary — brand sage, works here */
  --color-ink-faint:    #5F6D62;   /*  3.06 /  2.67  DECORATIVE ONLY — never text */

  /* brand */
  --color-gold:         #C4954A;   /*  6.15 /  5.37  usable as text on dark */
  --color-sage:         #8A9A8D;
  /* forest #1B3D2F is 1.39:1 here — unusable, deliberately absent */

  /* status — always ship with an icon + label, never colour alone */
  --color-good:         #589D79;   /*  5.17 /  4.51 */
  --color-warning:      #D97706;   /*  5.24 /  4.57  brand value, unchanged */
  --color-critical:     #D2766B;   /*  5.20 /  4.53 */
  --color-info:         #0EA5E9;   /*  6.02 /  5.25  brand value, unchanged */

  /* chart series — validated all-pairs on ground, fixed order, never cycle */
  --color-series-1:     #2C9C74;
  --color-series-2:     #C67F20;
  --color-series-3:     #5D93E4;
}
```

Two notes for whoever implements this:

**`good` and `critical` are stepped up from the mobile values.** Mobile's `success
#1A7A4A` and `destructive #C0392B` measure 3.12:1 and 3.07:1 on the ground — fine as
fills or icons, but the admin renders status as bare text (`<span
className="text-red-400">Banned</span>` in `Users.tsx` today), so they need to clear
4.5:1. `#589D79` and `#D2766B` do, on the card surface as well as the ground. Same hues,
lighter step, because the job is different.

**Surface separation is intentionally subtle** — card sits 1.15:1 off the ground, inset
1.12:1 off the card. On dark, elevation should be carried by that small tonal step plus
the `--color-border` hairline, not by shadows. Shadows on a dark ground either disappear
or turn into grey halos.

### Where gold goes

Gold is the brand's signature and the theme's only warm accent, so it has to be spent
deliberately or it stops meaning anything. It marks **the current position and the
primary action, and nothing else**:

- the active sidebar item (replacing today's `bg-indigo-600`)
- the one primary button per screen — search, save, confirm
- focus rings
- the selected tab or filter chip

It is explicitly **not** a status colour, not a chart series in the UI chrome, and not a
decorative accent on cards. Everything else is ink, surface and hairline. A screen with
gold in five places has no primary action.

## 5. Typography

System sans throughout: `system-ui, -apple-system, "Segoe UI", sans-serif`. No display
or serif face anywhere, including on large numbers.

| Role | Size / weight |
|---|---|
| Page title | 24px / 700 |
| Section head | 15px / 600 |
| Body & table cell | 14px / 400 |
| Meta, axis, caption | 12px / 400, `--color-ink-soft` |
| Stat tile value | 30px / 700, **proportional figures** |
| Table numerics | 14px, `font-variant-numeric: tabular-nums` |

`tabular-nums` belongs in table columns and axis ticks where digits align vertically —
**not** on standalone stat-tile values, where equal-width digits make small numbers
look loose.

## 6. Information architecture — the main structural fix

The sidebar is currently **16 undifferentiated links** in one flat list
(`admin/src/components/Layout.tsx`). Sixteen equally-weighted items means the ops team
scans the whole list every time. Group them into six labelled sections:

| Group | Screens |
|---|---|
| **Overview** | Dashboard |
| **Marketplace** | Trips · Bookings |
| **People** | Users · Driver Docs · Driver Earnings |
| **Money** | Payments · Subscriptions |
| **Trust & Safety** | Safety · Trust & Safety · Compliance Logs · Audit Log |
| **Support** | Support Tickets · Support Agents · Notifications |
| **System** | System Config |

Replace the emoji glyphs with a single consistent line-icon set — mixed-metaphor emoji
(📊 👥 🚗 💰 🛡️) render inconsistently across platforms and read as placeholder.

The sidebar should carry **live counts on the queues that age**: open tickets, pending
payouts, open incidents, documents awaiting review. That is the difference between a
console someone checks and one someone works from.

## 7. Dashboard — the second structural fix

Currently **17 identical stat tiles** in a flat 4-column grid, each with a decorative
coloured dot whose hue carries no meaning (users blue, trips-today pink-400,
trips-this-month pink-500). Seventeen equally-weighted numbers means none of them read,
and the colour burns the one free channel on nothing.

Restructure into three tiers:

**Tier 1 — the health line.** Four hero figures, large, that answer "is the marketplace
alive today": Active Trips · Bookings Today · Revenue This Month · Open Incidents. Each
with a period-over-period delta.

**Tier 2 — the queues.** Anything with a number that should be going *down*, rendered as
actionable rows rather than tiles, each linking to its screen: pending payouts, open
tickets, pending tickets, documents awaiting review. A queue count is a to-do, not a
statistic.

**Tier 3 — the rest.** Totals and cumulative counts, demoted to a compact table. Total
users, total drivers, new this month, active 7d, trips this month, total tickets,
active agents. These are context, not signal.

Charts (Trips 7d, Revenue 7d) are **single-series** — so one colour each
(`--color-series-1`), no legend, the title names the series. Rules:

- Thin marks, 4px rounded data-ends anchored to the baseline, 2px gap between adjacent bars.
- Hairline solid gridlines in `--color-grid`, never dashed. Recessive axes.
- **Never** a dual-axis chart. Trips and revenue stay two separate plots.
- Direct-label selectively — the endpoint and the extreme, not every bar.
- Hover tooltip by default, hit target ≥24px.
- Every chart has a table-view twin.
- Colour means **state**, never decoration. If a tile is coloured, it is because
  something is wrong.

## 8. Components to specify

The redesign needs these as a set, not per-screen improvisation:

1. **App shell** — grouped sidebar with counts, content area, no top bar.
2. **Page header** — title, record count, primary action.
3. **Filter bar** — one row above the content it scopes. Never per-card filters.
4. **Data table** — sticky header, zebra `--color-inset`, hover row, sortable columns,
   right-aligned tabular numerics, empty state, and a loading state that **holds the
   previous render at reduced opacity** rather than flashing a skeleton.
5. **Status pill** — icon + label + colour, never colour alone. Fixed vocabulary:
   good / warning / critical / neutral.
6. **Stat tile** and **hero figure** — proportional figures, optional delta.
7. **Confirm modal with a reason field.** This replaces the native `prompt()` and
   `confirm()` currently used for suspend and ban (`admin/src/pages/Users.tsx`) — a
   browser dialog for a destructive, audited, reason-carrying action is wrong on every
   axis: unstyled, unvalidatable, and it silently accepts an empty reason.
8. **Empty state** — icon, one line in Bovogo voice, and the action that resolves it.
9. **Error state** — the pages currently `.catch(console.error)` and render nothing, so
   a failed fetch is indistinguishable from no data. Every screen needs a visible,
   retryable error.
10. **Pagination** — current pattern caps at 10 page buttons with no next/prev and no
    indication of total pages.

## 9. Screens

18 files, ~1,800 lines total — small enough to redesign completely.

`Login` · `Dashboard` · `Users` · `Trips` · `Bookings` · `Payments` · `Safety` ·
`AuditLog` · `SystemConfig` · `TrustSafety` · `DriverDocs` · `Notifications` ·
`Subscriptions` · `SupportTickets` · `DriverEarnings` · `ComplianceLogs` · `Agents`

Most are a filter bar over a table with row actions, so **the table and filter-bar
components carry the majority of the redesign**. The genuinely distinct layouts are
Dashboard, Login, SystemConfig (a form), and SupportTickets (the largest at 183 lines,
and the only one resembling a queue/detail workflow).

## 10. Open questions

- **Sailor/Voyager in the admin?** Mobile shipped the rename; the admin still says
  "Rider"/"Driver" (the role filter in `Users.tsx`). DB values are deliberately still
  `rider`/`driver`. Staff-facing tooling arguably benefits from matching the database
  it queries, so this is not automatically the same answer mobile got.
- **Does the admin need responsive/mobile layout at all**, or is desktop-only
  acceptable for an internal console?

## Validation

Series palette, from the `dataviz` skill:

```bash
node scripts/validate_palette.js "#2C9C74,#C67F20,#5D93E4" --mode dark --surface "#12211B" --pairs all
```

**Passes every check** on the all-pairs list (the strict one, covering scatter and small
multiples as well as bars): lightness band, chroma floor, CVD separation (worst pair
ΔE 9.1 protan, target ≥8), normal-vision floor (18.8, floor 15), and ≥3:1 contrast on
the ground. No warnings — the dark theme validates more cleanly than the light one did.

Status and ink colours were checked with **WCAG text contrast**, not the categorical CVD
gate; status ships with an icon and label, so mutual hue separation isn't its gate.

**Failed, do not retry:**

- **Raw brand colours as chart series** — `#1B3D2F,#C4954A,#0EA5E9,#8A9A8D`. Forest is
  outside the lightness band and below the chroma floor, sage reads grey, and sage↔info
  normal-vision ΔE 14.9 is under the 15 floor. Identity colours are not automatically
  series colours; they need stepping into the band.
- **Dark gold lighter than `#C67F20`** — `#D9A857`, `#C79445`, `#BE8C3C`, `#D08A2A` and
  `#CE8524` were all tried. Anything lighter leaves the dark band (L 0.48–0.67) and/or
  drops green↔gold CVD separation under ΔE 8.
- **Mobile's `success`/`destructive` as status text on dark** — 3.12:1 and 3.07:1, under
  the 4.5:1 text bar. Stepped to `#589D79` / `#D2766B`.

If the light theme is ever revisited, its validated set was series `#1F8A5B,#C4954A,#2A78D6`
on `#F8F7F3` (passes, one sub-3:1 WARN on gold requiring direct labels or a table view),
ink `#1B3D2F` / `#67736A`, and status `#1A7A4A` / `#AB5E05` / `#C0392B` / `#0A78AA`.
