# Checkout printer rebuild — 13 September 2026

## Where it is in the app

`Adventure details → Payment → hold to pay (1.6 seconds) → native Stripe payment sheet → server booking confirmation → printer on the Payment screen → My Adventures / Adventure group`.

The successful checkout **renders `CheckoutComplete` directly inside `app/payment.tsx`**, using the booking returned by confirmation. It does not depend on a separately discoverable demo or a second booking fetch. Confirmed/completed bookings opened through `/booking-confirmed?id=…` share that same component. Pending/cancelled records retain their truthful status and do not print a confirmed ticket.

`My Adventures → View ticket collection` opens the new booking-ticket fan. Existing Past/Upcoming/Cancelled lists, rating actions, tracking, and group navigation remain available.

## Review it now

Start the mobile development server and open `/checkout-preview` (this session: http://localhost:8088/checkout-preview).

- **Full flow:** the actual PaymentBody with sample trip data. Adjust the options, then hold the payment button for 1.6 seconds. The actual checkout completion component prints the resulting sample ticket, with the selected total. Review mode never calls payment or booking APIs.
- **Checkout:** replay the actual completion screen immediately.
- **Printer / Ticket:** inspect the machine and full ticket separately; hover the ticket for the subtle tilt.
- **Collection:** tap or flick tickets upward into a stack; use Return to fan to reset.
- **Hold:** short clicks do nothing. A sustained hold removes a local sample and offers a five-second Undo.

`checkout-preview` and the existing `hold-preview` redirect away in production (`__DEV__` guard). No charge or real deletion was made during verification.

Recorded UI: [printing animation](evidence/2026-09-13-checkout-printer/checkout-printing.gif), [payment screen](evidence/2026-09-13-checkout-printer/payment-phone.png), [ticket stack](evidence/2026-09-13-checkout-printer/ticket-stack.png).

## Implemented by Codex

- Rebuilt the printer and ticket from new components after the earlier reset removed TicketPrinter.tsx, Ticket.tsx, and ticket-preview.tsx.
- Charcoal machine, inset display, recessed slot, shadow over the emerging paper, forest-green 5:12 ticket, perforated stub, route/date/seats/Voyager/reference details, and decorative barcode pattern. The pattern is not presented as a scanner credential.
- Matched the supplied stepped feed keyframes over 1.75 seconds; a short 550 ms preparation stage precedes it. Status fades over 180 ms. Ticket hover tilt is 6 degrees. Reduced-motion settings suppress decorative motion; animation cleanup prevents stale completion callbacks.
- Ticket fan supports responsive spacing, upward flicks, keyboard selection, hover lift, multiple tickets in a stack, spring return, and five tickets per history page. It uses booking IDs, avoiding the mixed trip/booking IDs in the existing list.
- Hold-to-confirm is wired to payment, adventure posting, destructive dialogs, and the shared explicit-confirm helper. Cancellation on release, blur, pointer exit, disabled/busy changes, backgrounding, and unmount prevents accidental completion. A separate timer ensures reduced-motion settings cannot shorten the consent interval. Screen readers have an explicit Confirm accessibility action.
- Rebuilt the Undo countdown component. Actual account deletion/payment is not falsely advertised as reversible; the reference Undo demonstration changes local sample state only.
- Removed the payment-configuration fallback that silently created free confirmed bookings.
- Checkout retries after a successful payment reuse the existing booking confirmation rather than prepare/present a second payment. Concurrent submissions share one in-flight operation; non-confirmed results do not enter the printer view. Web payment exits before creating a payment request.

## Claude contribution

Claude performed two focused read-only reviews of the authorized application source; Codex retained printer implementation as requested.

1. Hold integration and ticket history review: found unmount/disabled hold risks, dialog sizing, invalid-form feedback, and the mixed booking/trip ID trap. The first review read corresponding files in the Claude integration tree because its file permission boundary excluded the Codex worktree; the relevant pre-change versions matched.
2. Checkout navigation/payment review: identified the unsafe free-booking fallback, recharging risk after confirmation failure, returned-status validation, and navigation/unmount concerns.

The review results are saved alongside the build evidence. Claude did not author the new printer visuals. Neither review edited source or ran duplicate builds.

## Verification

- Full mobile release gate passed: workspace typechecks, tests, iOS/Android/web exports.
- After the final animation refinements, mobile typecheck passed again; **49 tests across seven suites passed**; final iOS/Android/web exports passed.
- New regression coverage: early-release/unmount/focus/disabled hold cancellation; full hold fires once even when visual animations complete instantly; no free-booking fallback; confirmation-only retry; pending/cancelled outcomes; concurrent payment submissions; real PaymentBody renders checkout completion after Stripe and server confirmation.
- Browser review at the normal 360 px viewport plus a narrower 325 px layout: actual payment form, printer preparation/feed/complete, keyboard ticket selection and multiple-card stack/reset, and short-click rejection on the destructive hold. Recorded the real rendered printer transition.
- `git diff --check` passed. No new runtime packages, migration, deployment, real payment, or account deletion.

## Limits and remaining work

- Native Stripe presentation, physical-device gestures, screen-reader operation, and final animation smoothness on iOS/Android still need device QA. Successful exports are not a claim of physical-device testing.
- Confirmation retry protection is maintained within the checkout session. App termination/relaunch after a successful charge still needs durable reconciliation; this change does not implement a new payment-recovery backend.
- The broader production-readiness findings in the supplied screenshots remain a separate backlog; this rebuild does not certify the application as production-ready.
- Previous nine app-review fixes and their Claude/Codex ownership are documented in [APP_REVIEW_COMPLETION_2026-09-12.md](APP_REVIEW_COMPLETION_2026-09-12.md), on PR #5. This rebuild is stacked on that branch in PR #6.

## Reference

Reviewed the supplied Google document “Transitions” and extracted frames from all four supplied recordings. Implemented the React Native/Reanimated equivalents of the reference’s printer, ticket, hold/Undo, and card-fan interactions without adding its web-only motion/tilt dependencies.

## Printer depth refinement after visual review

Compared the supplied printer recording at preparation, partial feed and completion. Corrected the paper mask to start at the aperture centre, 16 px above the case bottom, and placed the paper in front of the lower case lip. Previously the complete case covered the paper, making it appear behind the machine. Paper now occupies 80% of the machine width (up to 272 px), matching the reference proportions more closely.

Added a recessed slot, a tight contact shadow fading down the paper, a subtle case-edge highlight, and separate soft machine/paper shadows with sufficient mask space to avoid clipping the paper shadow. The ticket stays flat while held by the printer; tilt remains available in the standalone ticket view. The stepped feed timing and actual checkout integration are unchanged.

Verified the mid-feed frame visually; updated the recorded animation and completion screenshot. Typecheck and production web export passed. This visual-only refinement does not change payment or booking behavior.
