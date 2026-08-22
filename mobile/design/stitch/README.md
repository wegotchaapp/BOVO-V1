# Stitch output — the mobile screen designs

Generated with Google Stitch and kept here because the generator is unreliable: calls
usually time out, sometimes never land, and a project can stop producing screens
altogether. These files are the record, so nothing depends on regenerating them.

Read the layout from these. **Do not copy the colours or the copy wholesale** — Stitch
re-seeds the palette through Material's dynamic-colour system, and some of its copy makes
claims the product cannot keep.

## The screens

| File | App screen | Implemented | Notes |
|---|---|---|---|
| `adventure-detail.html` | `app/trip/[id].tsx` | yes | clean; no gold-as-text |
| `payment.html` | `app/payment.tsx` | yes | clean; figures were illustrative, see below |
| `adventures.html` | `app/(tabs)/trips.tsx` | not yet | **Rate button** uses gold text *and* border on white at 2.71:1 — fix while porting |
| `messages.html` | `app/(tabs)/messages.tsx` | not yet | route and date share one `truncate` span, so the **date is clipped first**; split to two lines |
| `profile.html` | `app/(tabs)/profile.tsx` | not yet | **4 gold glyphs** on white at 2.71:1 (3 checks + a medal). Its `bg-gold-accent` pill with dark text is correct — leave that |

`screenshots/` holds Stitch's own renders of the two implemented screens. They show the
avatar photos; the exported HTML cannot, see below.

## Design briefs fed to Stitch

- `DESIGN.flow.md` — the Sailor booking flow brief (produced Payment and Adventure detail)
- `DESIGN.voyager.md` — the Voyager brief, carrying every rule learned so far

Both round-tripped byte-identical on upload. Keep a brief under ~8KB: the upload takes
base64, and hand-emitting a larger string has corrupted a document before.

## Traps in the generated HTML

- **`<img src>` URLs do not serve images.** They point at `lh3.googleusercontent.com` and
  return `text/javascript`. Stitch composites its screenshots server-side, so imagery looks
  fine there and breaks anywhere else. Swap in real assets.
- **`peer-checked:` on a non-sibling silently does nothing.** Tailwind compiles it to a
  sibling combinator, so a rule on a grandchild never matches — in `payment.html` the
  checked radio can never show its inner dot.
- **Absolute positioning inside a 1px box overflows.** Adventure detail's "~3 hrs" pill sits
  in a `w-px` connector with `left-1/2`, so it hangs outside the card.
- **`w-1/8` is not a Tailwind class.** It appeared on the admin charts and rendered
  zero-width bars. Grep for `w-1/` with an unsupported denominator.

## The money in `payment.html` is illustrative

Real figures come from `lib/pricing.ts`. For one seat with insurance on:
`$32.40` seat + `$15.00` insurance + `$3.78` derived fee = **`$51.18`** — confirmed against
the live API. Never copy a price out of the mockup.
