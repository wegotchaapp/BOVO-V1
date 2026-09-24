**Note:** `/Users/Sush/Desktop/bovogo-codex` is outside this session's allowed directory, so I read the same eight paths under `/Users/Sush/Desktop/TheBovogo App/mobile/artifacts/mobile`. If Codex has uncommitted edits in its worktree, re-verify `HoldToConfirm.tsx` there.

## Hold button — safe integration points

**`app/payment.tsx:528` (Pay CTA).** Drop-in: `onConfirm={handlePay}`, `busy={paying}`, `busyLabel="Processing…"`, `icon="lock"`, `label={\`Pay $${total.toFixed(2)}\`}`. API semantics are untouched — `handlePay` already self-guards (`if (!trip || paying) return`) and owns all `prepareBooking`/`confirmBooking`/`createBooking` calls. Needs `style={{height:56, borderRadius:28}}` to match the current footer button.

**`app/post-trip.tsx:808` (Post CTA).** `onConfirm={handlePost}`, `disabled={!isValid}`, `busy={submitting}`, `busyLabel="Posting…"`. `handlePost` calls `setTouched(true)` before validating, so error messages still appear — but with `disabled={!isValid}` the hold never fires, so an invalid form gives no feedback at all. Keep the button enabled and let `handlePost` reject, or the untouched-form case becomes a dead control.

**`components/AlertHost.tsx:161` (destructive dialog button).** Swap only where `button.style === "destructive"`, calling `choose(index)` from `onConfirm`. Semantics hold: `choose` still shifts the queue, resolves, and runs `onPress`, so `confirm()` in `lib/alert.ts:35` (`index === 1`) and every caller keep working.

## Traps

1. **Unmount mid-hold still fires `onConfirm`.** `HoldToConfirm.tsx:112` — the `withTiming` callback runs `runOnJS(finish)` regardless of mount state; `abort()` only runs on `onPressOut`. Navigating back (or an AlertHost dismiss) while the finger is down completes the hold: on payment that means `prepareBooking` on a dead screen. Needs a mounted ref checked in `finish`, or `cancelAnimation` in the unmount cleanup at line 86.

2. **Dialog buttons are flex, `HoldToConfirm` is not.** `AlertHost.tsx:209` gives inline buttons `flex: 1` at `height: 48`; the hold button hardcodes `height: 52` and has no flex, so it collapses to text width and mismatches Cancel. Pass `style={{flex:1, height:48, borderRadius:24}}` — `onLayout`/`trackWidth` measure fine under flex.

3. **The confirmed flash never shows in a dialog.** `finish` latches `confirmed` for 1200ms (`HoldToConfirm.tsx:100`), but `choose()` unmounts the host immediately. Cosmetic only — don't "fix" it by delaying `choose`, which would let a second tap through.

4. **Stripe cancel leaves the button latched.** `payment.tsx:165` returns with `setPaying(false)`, but the hold button is still in its 1200ms `confirmed` window and ignores `start()`. The Sailor can't retry for ~1s after cancelling the Payment Sheet.

5. **`disabled || busy` on the Pressable (`HoldToConfirm.tsx:158`) suppresses `onPressOut`**, so `holding` can stick true if `busy` flips during a hold.

## Ticket-history fan — data and navigation

Source is `listMyBookings()` → `Booking[]` (`lib/bookings.ts:89`). `trips.tsx:78 bookingToItem` **discards** everything a ticket needs: `groupId`, `pricePerSeat`, `serviceFee`, `luggageTier`/`luggageSurcharge`, both insurance flags/premiums, `paymentMethod`, `createdAt`, `completedAt`. Extend `TripItem` (or keep the raw `Booking` alongside) rather than re-fetching.

**Namespace trap:** `TripItem.id` is a *booking* id for `role: "rider"` and a *trip* id for `role: "driver"` (see the comment at `trips.tsx:352`). A fan keyed on `item.id` mixes both; filter to `role === "rider"` for tickets.

Existing actions to preserve: `/tracking/[id]` and `/rate-trip/[id]` both take the booking id; `/manifest/[tripId]` and `/pre-trip-video` take the trip id; `getRatingStatus(bookingId)` drives the Rated pill. Group chat needs `groupId`, which currently never reaches the UI.

**Unrelated bug worth noting:** `trips.tsx:249` returns early when `finished.length === 0` without clearing `ratedById`, leaving stale Rated pills after a refresh.
