# Payment route authorization — September 21, 2026

The payout-execution route previously had an API documentation annotation but no authentication or admin authorization guard. It now requires a valid platform JWT and a server-side admin role. Connect onboarding/status/link routes and personal earnings/payout/tax routes now require JWT authentication.

Verified from an isolated export of exactly the staged code: backend TypeScript passed; 11 local HTTP authorization tests and the existing JWT strategy test passed (12 total). The HTTP suite substitutes authenticated identities while exercising the actual route guards and AdminGuard; the JWT strategy test checks enforcement fields returned from the user record. All payment operations are mocked. No Stripe calls, deployment or production data were involved.

This is a narrow authorization fix. It does not fix webhook signature handling, subscription payment ownership, W-9 document validation, cancellation/settlement, or missing mobile driver payouts. Those remain separate review items. Existing scheduled jobs invoking the HTTP payout route must use an authenticated admin identity; internal service calls are unaffected.
