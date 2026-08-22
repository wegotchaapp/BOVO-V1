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
  gold-accent: '#c4954a'
  surface-cream: '#f8f7f3'
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

Warm, open, calm — the open road at golden hour, not a utility app. Cream ground, deep
forest ink, one gold accent.

## Colours

Light throughout. **Never a dark theme.**

- **Forest `#1b3d2f`** — headings, primary buttons, active states, values.
- **Cream `#f8f7f3`** — the ground. Cards are pure white and float on it.
- **Gold `#c4954a`** — a **FILL, never text**. It measures 2.71:1 on white, so gold text
  on a light background is forbidden. Text on a gold fill must be near-black `#111210`.
  Gold's jobs: the destination dot on a route, a badge pill, a highlight.
- **Sage `#67736a`** — secondary text: captions, timestamps, metadata. Warm and green,
  never a cold grey.

## Layout

Mobile-first, 4px baseline, 22px screen padding, a single scrolling column. White cards
with 20px padding, 16px radius, 14px gaps, soft warm shadows. Bottom tab bar: Home,
Adventures, Messages, Profile.

## Voice

Second person, present tense, concrete, under twelve words. Warm, never cute, never
exclamatory. Empty states use road and sky imagery. All copy original — never quote
songs, films or books.

## The existing flow

These two screens sit in the middle of the booking path:

**Search results → Adventure detail → Payment → Booking confirmed**

A Sailor searches a route and date, opens one adventure to inspect the Voyager and the
terms, requests a seat, pays, and lands on a confirmation. The two screens to design are
the middle two. They must feel continuous with each other: the same route treatment, the
same card rhythm, and a fixed bottom action bar on both.

### Rules these two screens must honour

- **Date and time always appear together**, never split apart.
- Every fare is a flat **$32.40 per seat** on every route, so price never differentiates
  one adventure from another — the Voyager, the time and the seats do.
- The route treatment is fixed: a **forest dot for origin**, a **gold dot for
  destination**, joined by a thin vertical connector.
- Trip insurance is **$15 and defaults to ON**. The Sailor must actively remove it, and
  Remove is one tap with no confirmation dialog.
- The Bovogo fee is derived, not flat. Show it as a single "Bovogo fee" line.
