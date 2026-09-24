# Delivery checkpoint — September 22, 2026

## Published source (not deployed)
- `6e24ea6`: approved checkout printer and ticket layout.
- `290604f`: standalone quote calculation, not complete live checkout settlement.
- `2f82905`: authentication on account-specific platform payment routes and server-side admin payout execution guard. Isolated backend TypeScript + 12 tests passed.
- `6369ca7`: state-aware city coordinates, null-safe tracking and unavailable-map fallback. Isolated TypeScript + 49 mobile tests + nine coordinate assertions passed. Push succeeded September 22.

## Verified working tree
September 22 before the new refund edits: mobile 111 tests / 11 suites passed; backend TypeScript passed; settlement 64 tests passed. These checks do not establish payment-provider, database concurrency or physical-device behavior. Claude is implementing pending-refund reconciliation following Codex review. Prior correction attempt failed with DNS ENOTFOUND; no completion claim applies to it. One active Claude writer remains after stopping a duplicate interrupted launch.

## Confirmed commercial rules
Human fare = ($0.54 × actual GPS miles) / fixed 3; 200 miles = $36 before fees. Pet = two fares and two seats. Driver receives mileage fare. Platform fee $2; transaction fee follows the agreed 2.9% + $0.30 calculation. Rider cancellation at least six hours before departure and driver cancellation: full refund including fees. Rider cancellation within six hours: driver receives mileage fare, normal fee allocation stays. No optional insurance purchase.

## Remaining in order
1. Complete refund pending/succeeded/failed reconciliation; prove migrations and races against disposable Postgres; verify Stripe sandbox behavior and implement actual driver transfers. Ledger earnings are not transfers. Resolve earlier-rider-cancellation/later-driver-cancellation policy edge explicitly.
2. Finish pricing/pets: homepage selector, party propagation through trip details and checkout, pet occupancy tags, server capacity enforcement; distinguish future Arkansas/Oklahoma corridors from Texas launch eligibility.
3. Finish combined QR/GPS integration and individual rider drop-off; native camera/background GPS and interrupted-network device validation.
4. Finish private message hiding, route heading cleanup, profile overscroll and identity verification error.
5. Policies/consent/analytics inventory; security (webhook signatures, throttling, sessions, OTP/MFA, password policy); accessibility.
6. Reconcile screenshot findings against current code and verify deployment configuration, provider credentials, CI, private storage, retention/deletion and launch legal requirements. No production-ready certification.

## Ownership and limits
Claude implements bounded feature changes; Codex reviews and verifies, and publishes completed isolated changes. Do not commit the entire dirty tree. Do not run production migrations, real charges or deployment. Preserve local work. Current refund prompt: /private/tmp/bovogo-cancellation-review-pass2.txt; output: /private/tmp/bovogo-cancellation-sep22-result.json. Inspect process state before another launch.
