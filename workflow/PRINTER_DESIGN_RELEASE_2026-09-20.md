# Printer design update — September 20, 2026

Approved user request: commit and push the reviewed printer design. Scope is the existing payment-completion printer, collection ticket styling, no-scroll fit, and server-issued QR display. Pricing, pets, GPS implementation and security work remain separate unfinished changes.

- Printer and entire ticket scale together to available screen height; same forest/gold ticket component in collection fan.
- QR is near the top beside route artwork; departure, route, Voyager, seat/status and booking reference retained; enlarged QR view available.
- Uses real QR encoding for server-issued payloads; development sample payload is gated by __DEV__. Production does not invent a boarding pass. If the boarding-pass API is unavailable, ticket still renders and offers retry; backend QR/scanning rollout is not included in this design-only commit.
- Existing payment.tsx already renders CheckoutComplete after confirmation, so this changes the app checkout flow as well as its preview.

Verification: exported exactly the staged index to /private/tmp/bovogo-printer-ship-_u23ka26, using existing installed dependencies. TypeScript exit0;7mobiletest suites/49tests passed including CheckoutIntegration and checkout-session. No dependency reinstall/purge. git diff --cached --check clean. Prior approved360x640 visual review showed full printer/ticket without scrolling; QR independently decoded from screenshot. This is not a native device or production readiness certification.

Source integration only; no deployment, production migration, payment, or app-store submission. User's corrected $.54 pricing is not implemented or published by this design commit.
