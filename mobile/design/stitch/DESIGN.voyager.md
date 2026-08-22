---
name: Bovogo Mobile
colors:
  surface: '#f8f7f3'
  surface-container-lowest: '#ffffff'
  surface-container: '#ebf2ed'
  on-surface: '#111210'
  on-surface-variant: '#67736a'
  outline: '#e3ddd3'
  primary: '#1b3d2f'
  on-primary: '#ffffff'
  primary-container: '#ebf2ed'
  secondary: '#67736a'
  tertiary: '#c4954a'
  on-tertiary: '#111210'
  error: '#c0392b'
  background: '#f8f7f3'
  forest-ink: '#1b3d2f'
  sage-secondary: '#67736a'
  gold-fill: '#c4954a'
  on-tertiary-ink: '#111210'
  card-white: '#ffffff'
typography:
  display-lg: { fontFamily: Inter, fontSize: 26px, fontWeight: '700', lineHeight: 32px }
  headline-lg: { fontFamily: Inter, fontSize: 19px, fontWeight: '600', lineHeight: 24px }
  headline-md: { fontFamily: Inter, fontSize: 16px, fontWeight: '600', lineHeight: 22px }
  body-md: { fontFamily: Inter, fontSize: 14px, fontWeight: '400', lineHeight: 20px }
  label-md: { fontFamily: Inter, fontSize: 12px, fontWeight: '500', lineHeight: 16px }
rounded: { sm: 8px, DEFAULT: 14px, md: 16px, lg: 20px, full: 9999px }
spacing: { base: 4px, screen-padding: 22px, card-padding: 20px }
---

## Brand

Bovogo is intercity carpooling in Texas. A **Voyager** drives a route they were already
driving; **Sailors** buy seats. A trip is an **adventure**. Use those words in every
user-facing string — never driver, rider, ride or rideshare.

Warm, open, calm — the open road at golden hour, not a utility app.

## Colours

Light throughout. **Never a dark theme.**

- **Forest `#1b3d2f`** — headings, primary buttons, active states, values.
- **Cream `#f8f7f3`** — the ground. Cards are pure white and float on it.
- **Gold `#c4954a`** — a **FILL, never text**. Gold text measures 2.71:1 on white and
  fails. Text on a gold fill must be near-black `#111210`. Gold's jobs: the destination
  dot, a badge pill, one highlight.
- **Sage `#67736a`** — captions, timestamps, metadata, field labels. Warm and green,
  never a cold grey.

## Layout

Mobile-first, 4px baseline, 22px screen padding, one scrolling column. White cards with
20px padding, 16px radius, 14px gaps, soft warm shadows. A fixed bottom action bar carries
the primary CTA on task screens.

## Voice

Second person, present tense, concrete, under twelve words. Warm, never cute, never
exclamatory. All copy original — never quote songs, films or books.

## The product rules that shape every screen

- **Date and time always appear together**, never split across lines or sections.
- Every seat is a flat **$32.40** on every route. Price is not a differentiator and a
  Voyager cannot set it — the Voyager, the time and the seats differentiate an adventure.
- **Route treatment is fixed**: forest dot for origin, gold dot for destination, joined by
  a thin vertical connector. Identical on every screen that shows a route.
- Trip insurance is **$15, default ON**, removable in one tap with no confirm dialog.
- A Voyager must have a fully documented vehicle before posting.

## The two halves of the app

**Sailor:** Home search → Search results → Adventure detail → Payment → Booking confirmed.
**Voyager:** Post an adventure → Manifest → Odometer → Trip complete.

Screens in the same half must feel continuous: same route treatment, same card rhythm,
same fixed bottom bar.

## Components

### Trip card
Top row: departure **date and time together** on the left, "$32.40 / per seat" on the
right. A divider, then the Voyager's avatar, name, star rating and car, with a
seats-available pill on the right.

### Stepper row
A glyph and sage label on the left; on the right a circular minus button, a large forest
number, and a circular plus button. Buttons are pale sage fill with a forest glyph.

### Field tile
A pale sage rounded tile holding a glyph, a small sage label in caps, and a forest value.
Used for date, time and other pickers.

### Empty and error states
Every list has both, and they must look different. Empty invites ("No adventures on this
road yet"); error names the failure and offers a retry.
