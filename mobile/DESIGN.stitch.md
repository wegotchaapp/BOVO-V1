---
name: Bovogo Mobile
colors:
  surface: '#f8f7f3'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2efe8'
  surface-container: '#ebf2ed'
  surface-container-high: '#e3ddd3'
  surface-container-highest: '#eeeae3'
  on-surface: '#111210'
  on-surface-variant: '#67736a'
  outline: '#e3ddd3'
  outline-variant: '#eeeae3'
  primary: '#1b3d2f'
  on-primary: '#ffffff'
  primary-container: '#ebf2ed'
  on-primary-container: '#1b3d2f'
  secondary: '#67736a'
  on-secondary: '#ffffff'
  tertiary: '#c4954a'
  on-tertiary: '#111210'
  error: '#c0392b'
  on-error: '#ffffff'
  background: '#f8f7f3'
  on-background: '#111210'
  success: '#1a7a4a'
  warning: '#d97706'
  info: '#0ea5e9'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.5px
  headline-lg:
    fontFamily: Inter
    fontSize: 19px
    fontWeight: '600'
    lineHeight: 24px
  headline-md:
    fontFamily: Inter
    fontSize: 16px
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
  sm: 8px
  DEFAULT: 14px
  md: 16px
  lg: 20px
  full: 9999px
spacing:
  base: 4px
  screen-padding: 22px
  card-padding: 20px
---

## Brand & Style

Bovogo is intercity carpooling in Texas. A **Voyager** drives a route they were already
driving; **Sailors** buy seats. A trip is an **adventure**. Use those words in every
user-facing string — never "driver", "rider" or "ride".

The organising idea is **the sky is the interface**. The Home screen renders live weather
for the destination as a full-viewport animated backdrop — eight scenes from bright noon
blue to near-black night — and the rest of the interface floats above it on warm cream
cards. This is the product's signature, not decoration.

Warm, open, and calm. Cream ground, deep forest ink, a single gold accent. The mood is
the open road at golden hour, not a utility app.

## Colours

Light throughout. **Never a dark theme** — the app already goes dark on its own when the
destination weather is night, and a fixed dark chrome would fight a bright sunny sky.

- **Forest `#1b3d2f`** is the primary: headings, primary buttons, active states.
- **Cream `#f8f7f3`** is the ground; cards are pure white and float on it.
- **Gold `#c4954a`** is the single accent — the destination dot on a route, a Top Voyager
  badge, a highlight. Gold is a **fill, never text**: it measures 2.53:1 on cream. Text on
  gold must be near-black.
- **Sage `#67736a`** is secondary text: captions, timestamps, metadata. Not `#8a9a8d` —
  that is the decorative sage and fails contrast as text.

## Type over weather

Any text sitting on the weather backdrop follows two rules, because the sky ranges from
`#82cffa` to `#020610`:

1. The top band carries a dark gradient scrim, strongest at the top.
2. Header text is **full white, semibold, at least 19px**, with a soft dark shadow.

Never place small or grey text directly on the sky. Everything else lives on a card.

## Layout

Mobile-first, 4px baseline, 22px screen padding. A single scrolling column. Content is
grouped into white cards with 20px padding and generous 14px gaps.

Bottom tab bar with four destinations: Home, Adventures, Messages, Profile.

## Elevation

Unlike the admin console, this app **does use shadows** — soft and warm, never harsh.
Cards lift off the cream ground with a wide, low-opacity shadow (roughly 12px blur at 7%,
20px at 12% for prominent elements). Corners are generous: 16px on cards, 20px on the
large search card, fully rounded for pills and avatars.

## Voice

Second person, present tense, concrete, short — under about twelve words. Warm but never
cute, and never exclamatory. Loading and empty states use road and sky imagery: "Reading
the sky", "Folding the map", "No adventures on this road yet". All lines are original;
never quote songs, films or books.

## Components

### Search card
The centrepiece of Home. A large white card holding From and To with a forest dot and a
gold dot, each with an optional area beneath, a swap button on the right, then rows for
date, passengers and bags. Below it a full-width forest button: "Search Adventures".

### Trip card
One adventure in a list. Top row: departure **date and time together** on the left, price
on the right as "$32.40 / per seat". Then a divider, then the Voyager's avatar, name,
star rating and car, with a seats-available pill on the right. Every fare is the same
flat $32.40, so price never differentiates — the Voyager, the time and the seats do.

### Mode toggle
A two-segment pill switching between Sailor and Voyager, the active half filled forest
with white text. It sits top-right on Home, on the weather.

### Weather pill
A small translucent dark pill on the sky showing the destination's condition, e.g.
"Houston has Clear Night Skies", with a small moon or sun icon.

### Empty and error states
Every list has both, and they must look different from each other. An empty state invites
("No adventures on this road yet — post one"); an error state names the failure and
offers a retry. Never render a failure as an empty list.

## Do's and Don'ts

**Do** let the weather show — keep cards off the top third of Home where the sky reads.
**Do** put date and time together wherever a departure is shown.
**Do** use Sailor, Voyager and adventure.

**Don't** use a dark theme. **Don't** put gold on text. **Don't** show a price as the
differentiator between trips. **Don't** use grey — the neutrals here are warm and green.
