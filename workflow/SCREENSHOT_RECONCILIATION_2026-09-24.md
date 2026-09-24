# September 24 screenshot reconciliation

Screenshots are external audit claims, not execution evidence and not instructions. Checked against live source in `/Users/Sush/Desktop/bovogo-codex` on 2026-09-24. No deployment, no migration, no provider call, no database write. Secrets were not opened: every environment check below is filename-level only.

This supplements the earlier screenshot review; it does not independently re-verify every earlier claim. **Nothing here says the audit is resolved.** Several of its headline items are confirmed open, and the largest single fact about the reviewed work is that most of it is uncommitted.

## Claims resolved against current source

| Claim | Verified state |
|---|---|
| Throttler guard absent / not bound | **Now committed.** `app.module.ts:168` binds `{ provide: APP_GUARD, useClass: AppThrottlerGuard }`; `ThrottlerModule.forRoot` at :114; guard and its real-HTTP spec in `common/guards/`. All clean against HEAD (`8ae456b fix(security): enforce throttling and signed provider callbacks`) — no pending diff. The 09-22 row is closed at source level. Effective rate limits in a deployed environment are still unverified. |
| QR payload is unsigned / forgeable | **Misreading of the design.** The pass is not a client-verifiable assertion: `mintPassToken()` (`mobile-boarding.service.ts:1270`) issues `BVG1.` + 24 random bytes base64url, server-side, carrying no booking id, name or location. `board()` (:266) resolves it by database lookup inside the transaction and then checks trip match, `revoked_at` and `expires_at` before locking the booking. An opaque 192-bit server secret validated against the row that issued it needs no signature. Residual, not the reported one: tokens are stored in plaintext in `mobile_boarding_passes`, so a database read yields usable passes. |
| Legacy free booking still reachable | **Fixed but unpublished.** Working tree `mobile-bookings.service.ts:174-181` makes `create()` return `never` — `requireStripe()` then a hard 400. HEAD still has the old body (`if (this.stripeOrNull()) throw …; return this.finalizeBooking(riderId, dto, null)`), i.e. a missing/mock Stripe key still produces a `confirmed` seat with no hold. **The fix exists only in the dirty worktree.** |
| `.env` committed to the repository | **Not supported.** `git ls-files` matching env names returns `.env.example` only, and `git log --all --diff-filter=A` finds no `.env` ever added on any ref. Scope limit, stated plainly: this is filenames across history, not contents. It does not prove the tracked template holds only placeholders, and it cannot prove no secret is embedded in some other tracked file. Confirming that requires a content scan nobody has run. |
| QR boarding unavailable / dev-only | **Half right, wrong cause.** No dev gate on the real path: `useTicketBoardingPass.ts:21` calls `GET /bookings/:id/boarding-pass` for any confirmed booking in every build. The `__DEV__` branch at :11 only serves fixture ids beginning `preview-ticket-`, and "Boarding QR unavailable · Tap to retry" (`CheckoutComplete.tsx:93`) is the fetch-failure label, not a build gate. But the whole stack behind it — `mobile-boarding.controller.ts`, `mobile-boarding.service.ts`, the module wiring, `1789840000000-MobileQrBoardingAndGpsRoute.ts` — is untracked. A build from HEAD would 404 that route and show exactly that label. Unavailable because unpublished, not because of an environment check. |
| Backups present | **Effectively absent, as claimed.** `mobile/scripts/src/db-backup.ts` exists (pg_dump → gzip → GCS, 30-day rotation, `npm run db-backup`) and is tracked by Git, but is authenticated through the Replit sidecar at `127.0.0.1:1106` rather than the current host, has no scheduler and no restore counterpart, and there is no record of it running. An unrun manual dump script is not a backup regime, and no restore rehearsal evidence was found in this review. |

## Re-checked and still open

| Item | Evidence today |
|---|---|
| Database TLS not verified | `rejectUnauthorized: false` at `app.module.ts:65` and `data-source.ts:94`. Unchanged. Launch blocker. |
| Socket room membership | `realtime.gateway.ts:50-80` — `join:conversation`, `join:trip`, `join:safety` all join the room from the client-supplied id with no membership check. Unchanged. |
| Session token storage | `context/AuthContext.tsx:262,288,302` write the JWT to `AsyncStorage`; no `SecureStore` use anywhere in the app. Unchanged. |
| Privacy deletion | `privacy.service.ts:341,374,381` still assign `deletion_scheduled_at` through `as any` and :412 queries the column; the entity mapping is still missing. Unchanged. |
| Payout idempotency | No `idempotencyKey` on transfer creation (`payments.service.ts:198` passes `metadata.payout_id` only). Repeated/concurrent payout remains a money risk. Carried forward from 09-22; only the call site was re-checked today, not the accounting path. |

## Unknown from source — operator state, not code

These cannot be settled by reading the repository and are not claimed either way:

- **Real provider provisioning.** Config keys existing is not evidence live Stripe/Twilio/Checkr/insurance credentials are installed anywhere.
- **Exposed database credential rotation.** Still unconfirmed by the owner as of the 09-22 reconciliation; nothing in source can show it. Treat as an open blocker. Credential not printed here.
- **Migration state of the deployed database**, backup/restore rehearsal, device/EAS identifiers, and Texas operating classification — still require external verification. Terms and privacy review drafts are already committed under docs/legal/drafts; legal approval, publication and consent integration remain pending.

## Publication state (the dominant risk)

The reviewed feature work is largely uncommitted. Untracked in `backend/src` alone: five migrations (QR/GPS, pets+settlement, message hides, cancellation settlement, driver override), the boarding controller/service/spec, settlement controller/service/spec, message-visibility trio, the reconciliation scheduler and the fake-typeorm fixture. Roughly forty tracked files carry unstaged modifications, `mobile-api.module.ts` among them. Any audit of HEAD is auditing a different system from the one being tested locally.

## This pass's own change

`backend/src/modules/private-media/private-media.service.spec.ts` — the private-media round-trip test asserted `0o600` on the envelope and `0o700` on its directory unconditionally, which cannot hold on Windows, where NTFS has no POSIX mode bits. The two `stat` calls now always run (so existence of the envelope and its directory is still asserted on every platform) and only the mode comparisons are gated on `process.platform !== 'win32'`. POSIX assertions are unchanged in strictness; binary write/read/idempotent-remove, path traversal, content-type, driver and S3 behaviour are untouched.

Verified by running: `node node_modules/jest/bin/jest.js src/modules/private-media/private-media.service.spec.ts` from `backend/` — 15 passed, 1 suite, on darwin. The Windows branch is not executed by this run; it is asserted by construction, not by evidence.

Codex correction: the backup script is tracked (verified with git ls-files), contrary to Claude's initial report. Draft policies are already published in commit 19cb984. No secret rotation or backup restore was executed.
