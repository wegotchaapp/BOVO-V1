## Review: checkout completion & navigation risks

**1. The `notConfigured` fallback catches errors from any stage, not just setup.** The inner `try` wraps `prepareBooking`, Stripe init/present, *and* `confirmBooking`. Any of those throwing a message containing "not configured" — including a server 500 whose body mentions it, or a Stripe error string — falls through to `createBooking`, creating a free confirmed booking after a failed charge. Removing it is correct. Note the removal also deletes the only remaining `createBooking` call here; confirm the import is dropped and that no web path silently depends on it.

**2. Double-charge on retry after a post-payment failure.** If `presentPaymentSheet` succeeds but `confirmBooking` throws, the catch resets `paying` and alerts "Booking failed." The Sailor can hold-to-pay again, which calls `prepareBooking` fresh — a second PaymentIntent for an already-captured charge. Once completion renders in-place, this gets worse: there's no navigation to signal terminality. Keep the prepared booking id in state and, when payment already succeeded, retry `confirmBooking(id)` only; never re-prepare.

**3. `setPaying(false)` is never called on the success path.** Today that's masked by `router.replace`. Rendering `CheckoutComplete` in place means the screen stays mounted with `paying: true` and `HoldToConfirm` still in the tree unless the completion state replaces the whole body. Gate on the confirmed-booking state, not on `paying`.

**4. Nothing validates the returned status before treating it as confirmed.** `confirmBooking` returns a `Booking`; the code only reads `.id`. Before setting completion state, assert `booking.status === "confirmed"` (or your exact enum) and route anything else to an error/pending view. `CheckoutComplete` should take a narrowed `ConfirmedBooking` type so pending/cancelled is unrepresentable, rather than checking inside the component — `/booking-confirmed` fetching by id from a deep link is the likelier source of a non-confirmed record.

**5. Back-navigation traps.** The header back button and Android hardware back remain live once completion renders in place, returning the Sailor to the payment form for a paid booking. Block back and replace the stack when completion mounts.

**6. Cancel path leaks state.** `Canceled` returns early leaving the prepared booking/PaymentIntent orphaned server-side; worth an explicit cancel call or TTL.

**7. Unmount race.** `handlePay` has no `cancelled` guard; `confirmBooking` resolving after unmount sets state on a dead component.
