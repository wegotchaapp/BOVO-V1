---
name: Bovogo Admin Console
colors:
  surface: '#12211b'
  surface-dim: '#0d1713'
  surface-bright: '#2e3b35'
  surface-container-lowest: '#0f1c17'
  surface-container-low: '#1a2823'
  surface-container: '#1e2c26'
  surface-container-high: '#23312b'
  surface-container-highest: '#27342e'
  on-surface: '#f8f7f3'
  on-surface-variant: '#8a9a8d'
  inverse-surface: '#f8f7f3'
  inverse-on-surface: '#12211b'
  outline: '#5f6d62'
  outline-variant: '#2e3b35'
  surface-tint: '#c4954a'
  primary: '#c4954a'
  on-primary: '#12211b'
  primary-container: '#4a3a1e'
  on-primary-container: '#e8d3ad'
  inverse-primary: '#8d6b35'
  secondary: '#8a9a8d'
  on-secondary: '#12211b'
  secondary-container: '#2e3b35'
  on-secondary-container: '#cdd7cf'
  tertiary: '#5d93e4'
  on-tertiary: '#12211b'
  tertiary-container: '#22364f'
  on-tertiary-container: '#c3d8f5'
  error: '#d2766b'
  on-error: '#12211b'
  error-container: '#3d1f1a'
  on-error-container: '#f2c4bd'
  background: '#12211b'
  on-background: '#f8f7f3'
  surface-variant: '#1e2c26'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: '-0.01em'
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.375rem
  md: 0.5rem
  lg: 0.75rem
  full: 9999px
spacing:
  base: 4px
  sidebar: 240px
  gutter: 24px
  page-padding: 24px
---

## Brand & Style

An internal operations console for Bovogo, a Texas intercity carpooling service. The
audience is a small staff team who live in this tool for whole shifts — not customers,
not prospects. **Density is a feature.** Optimise for speed on the twentieth visit, not
for a first impression. Nothing here is marketing; there is no hero section, no
onboarding flourish, no illustration.

The mood is a **quiet, dark instrument panel**: deep forest-green ground, cream text,
and a single warm gold accent used sparingly. It should feel calm and precise — closer
to a well-made terminal than to a consumer dashboard. Bovogo's consumer app is warm and
light (cream and forest); this console is its night-shift counterpart, sharing the green
bias but inverting the values.

## Colors

The ground is a **deep forest green `#12211b`, never neutral grey** — the green bias is
the brand's signature and must survive into the dark theme.

- **Cream `#f8f7f3` is the primary ink**, at 15.56:1 on the ground.
- **Sage `#8a9a8d` is secondary text** — metadata, timestamps, column headers, captions.
- **Gold `#c4954a` is the only warm accent and is deliberately scarce.** It marks the
  current position and the primary action, and nothing else: the active sidebar item,
  the one primary button per screen, focus rings, the selected tab or filter chip. It is
  never a status colour, never a chart colour, never decoration on a card. A screen with
  gold in five places has no primary action.
- **Status colours always ship with an icon and a text label**, never colour alone:
  good `#589d79`, warning `#d97706`, critical `#d2766b`, info `#0ea5e9`. All clear
  4.5:1 on both the ground and the card surface.
- **Colour means state, never decoration.** If a tile or row is coloured, it is because
  something needs attention. Do not assign decorative hues to metrics.

## Typography

Inter throughout, including on large numbers — no display or serif face anywhere.

Page titles are 24px/700. Section heads 15px/600. Body and table cells 14px/400.
Metadata, axis labels and captions are 12px in sage. Large standalone figures on stat
tiles are 30px/700 with **proportional figures**; reserve tabular figures for columns
that align vertically — table cells and axis ticks — where equal-width digits actually
help.

## Layout & Spacing

Desktop-first, on a 4px baseline. A fixed **240px sidebar** with a fluid content area;
24px page padding and gutters. Content is full-width rather than centred in a narrow
column — this is a data tool and the horizontal space is wanted for table columns.

The sidebar is **grouped under labelled section headings**, not a flat list: Overview ·
Marketplace · People · Money · Trust & Safety · Support · System. Queues that age carry
a live count badge beside the label — open tickets, pending payouts, open incidents,
documents awaiting review. Icons are a single consistent thin-stroke line set; never
emoji, which render inconsistently and read as placeholder.

## Elevation & Depth

**No shadows.** On a dark ground they either vanish or turn into grey halos. Depth comes
entirely from the tonal surface ladder plus a hairline `outline-variant` border:

- `surface` `#12211b` — the page plane
- `surface-container` `#1e2c26` — cards, panels, table headers
- `surface-container-highest` `#27342e` — table zebra rows, wells, inputs

The steps are intentionally close together (roughly 1.15:1 between the ground and a
card). Subtlety is correct here — a dark UI that shouts its layering looks cheap.

## Shapes

Restrained rounding: 6px on buttons, inputs and chips; 8px on cards and modals. Fully
pill-shaped elements only for count badges and status pills. Nothing is a perfect
circle except avatars.

## Components

### Data table
The workhorse — most screens are a filter bar over a table with row actions. Sticky
header on `surface-container`, zebra rows in `surface-container-highest`, hairline row
separators, hover row lift. Numerics right-aligned with tabular figures. Sortable column
headers in sage with a directional caret. **On refetch, hold the previous rows at
reduced opacity — never flash a skeleton**, which causes a layout jump on every filter
change.

### Filter bar
One row above the content it scopes, never inside a card and never per-card. Search
input, dimension selects, and a single gold primary button.

### Status pill
Icon + text label + colour, in that order of importance. Fixed vocabulary: good,
warning, critical, neutral. Colour never carries the meaning by itself.

### Stat tile and hero figure
A label in sage above a large proportional figure in cream, with an optional
period-over-period delta. Tiles are for headline metrics only — never a wall of twenty
equal tiles, which flattens everything into noise. Demote long tails of cumulative
totals into a compact table instead.

### Confirm modal with reason
Destructive, audited actions (suspend, ban, refund) open a modal with a **required**
reason field and a critical-coloured confirm button. Never a bare browser dialog, and
never accept an empty reason.

### Charts
Single-series wherever possible — one colour, no legend, the title names the series.
Series palette in fixed order: `#2c9c74`, `#c67f20`, `#5d93e4`. Thin marks, 2px gap
between adjacent bars, hairline solid gridlines one shade off the ground, recessive
axes. Never dashed gridlines. **Never a dual-axis chart** — two measures of different
scale become two charts. Direct-label selectively (the endpoint, the extreme), never a
number on every bar.

### Empty and error states
Every list has both. An empty state is an invitation: one short line and the action that
resolves it, never a scolding. An error state is visible and retryable — a failed fetch
must never look identical to "no data".

## Do's and Don'ts

**Do** keep gold scarce enough that it always means "here" or "do this". **Do** let the
surface ladder and hairlines carry structure. **Do** treat the sidebar counts as the
reason someone opens the tool.

**Don't** use drop shadows. **Don't** use neutral grey — the ground is green. **Don't**
add decorative colour to metrics. **Don't** centre content in a narrow column. **Don't**
use emoji as icons. **Don't** put a number on every data point.
