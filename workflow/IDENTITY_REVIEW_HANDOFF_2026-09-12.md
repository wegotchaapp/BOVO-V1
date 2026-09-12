# Identity review handoff — 2026-09-12

Implemented and verified locally in `/Users/Sush/Desktop/bovogo-codex`, branch
`codex/identity-review`, based on `c8251c0`. Claude remains the mobile/mobile-api
owner and integrator. Nothing was pushed or deployed; no production database
was accessed. The previous safety spec edit is preserved in the named stash
`Preserve pre-existing safety spec before identity review`.

## Local commits

- `a95cd47` — fix audit property mappings to the canonical migration columns.
- `1b2b54b` — private storage, identity migration, guarded admin API, log redaction and tests.
- `f94fb21` — admin review queue, private blob images, approve/reject and review history.

## Integration contract

Import `PrivateMediaModule` from `backend/src/modules/private-media/private-media.module.ts`.
It exports `PrivateMediaService` from the adjacent service file, with exactly:

```ts
put(key: string, body: Buffer, contentType: string): Promise<void>
read(key: string): Promise<{ body: Buffer; contentType: string }>
remove(key: string): Promise<void>
```

Keys must be server-generated ASCII relative paths, without `..`, empty path
components, backslashes or leading slashes. The service accepts JPEG, PNG,
WebP, HEIC and PDF MIME types. The identity upload route should apply its own
image validation and size limits. Missing removes are idempotent. Configured
S3 errors propagate rather than falling back to local storage. S3 uses
`PRIVATE_MEDIA_BUCKET` (default `bovogo-private-media`), SSE-S3 and no ACL.
Local storage uses `<cwd>/private-media`, atomic envelopes and 0600 files in
0700 directories; it is outside `/uploads` and ignored by Git.

The migration matches `MobileIdentityVerification`: one pending submission per
user, constrained status/document types, ordered history and review-queue
indexes. Like the existing `mobile_vehicles.user_id` migration, `user_id` has
no FK; Claude's purge must delete submissions and media explicitly.
`reviewed_by` is UUID, matching the platform `User.id`.

RLS is enabled with no client policies and anon/authenticated table privileges
are revoked. The backend's owner/service role supplies server access; a future
non-owner backend role will need an explicit server-only access policy. This
follows the [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

All `/admin/identity-verifications` routes use the existing JWT strategy and
AdminGuard. List/detail contain explicit metadata only, never storage keys.
Files are fetched with the admin token, streamed with no-store/nosniff, and
rendered from revocable blob URLs. Each view is audited before bytes return.
Approve/reject lock the submission and update decision, user verification and
audit within one transaction. A second reviewer receives 409. Rejection needs
1–500 trimmed characters and preserves the user's existing verified flag.
The admin queue has paging, filtering, retry/error states and read-only history.

## Evidence

Full command output and schema inspection are in
`workflow/evidence/2026-09-12-identity-review/`.

| Check | Result |
| --- | --- |
| `backend: npm run build` | exit 0 |
| ESLint on every changed backend TypeScript file | exit 0, no diagnostics |
| `backend: npm test -- --runInBand --forceExit` | 13 suites, 116 tests passed; exit 0 |
| `admin: npm run lint` | exit 0, no diagnostics |
| `admin: npm run build` | exit 0; Vite 102 modules transformed |
| Compiled `npm run migration:run` on empty local DB | all 18 migrations applied; 71 public tables |
| Second migration run | `No migrations are pending`, exit 0 |
| Compiled migration revert, then run | identity table down/up passed |
| Revert/reapply with synthetic anon/authenticated roles and permissive default grants | both roles have no SELECT or INSERT privileges after migration |
| `node scripts/verify-identity-review.cjs` | all 9 integration groups passed |

Every database invocation explicitly used
`DATABASE_URL=postgresql://postgres@127.0.0.1:55441/bovogo_identity_proof DATABASE_SSL=false`.
The proof script refuses any other database name, non-local hosts and port 5432.
It uses real Nest HTTP requests, the production JWT strategy, actual PostgreSQL
transactions and local media; only synthetic users and document bytes are used.

The integration groups cover all five routes' 401/403 behavior, invalid/expired/
forged tokens, response key omission, private image headers and audits, unknown/
missing slots, validation errors, approvals/rejections, concurrent decisions,
partial unique/CHECK constraints, transactional rollback on audit failure and
RLS denial even when a client role is accidentally given table privileges.

Browser QA used a separate localhost synthetic API (no real documents): opened
a three-image submission, confirmed rejection is disabled without a note,
rejected it and observed the pending queue shrink, opened a passport with no
back slot, approved it, switched the status filter, and verified the reviewed
submission has no Approve or Reject buttons. Blob URLs contained no tokens.
The desktop content was inspected; the existing admin sidebar is not suitable
for a 360px viewport and has not been redesigned in this change. In-app browser
screenshots also showed capture/tiling artifacts after viewport resizing, so
this is not a claim of pixel-perfect cross-browser visual QA.

## Findings and limits

- The initial real-database test exposed a pre-existing audit schema mismatch:
  code used `actor_id`/`metadata`; the canonical migration creates
  `user_id`/`details`. `a95cd47` maps existing API properties to those columns.
  No audit data is rewritten. Production schema compatibility still needs a
  read-only check before deploying; it was not assumed from the local proof.
- Development TypeORM logging would print private image keys from SQL params.
  `PrivateQueryLogger` redacts identity SQL, params and driver error text in
  both the application and data source. Its regression test passes.
- Plain Jest completes all assertions but hangs. This is the already recorded
  P5-2 defect in `PRODUCTION_WORKFLOW.md`, not resolved here. `--forceExit` is
  explicitly a workaround; the passing assertion count is not a clean-shutdown
  claim. `--detectOpenHandles` did not identify the handle in this run.
- Actual AWS credentials, bucket policy/public-access blocks, multi-instance
  storage, a production copy migration and physical-device upload flow were
  not tested. Local storage needs a persistent volume if selected for deployment.
- Claude still needs to finish/integrate user-facing identity upload/status and
  account purge, then run combined mobile gates. Do not describe the whole app
  or all nine requests as complete from this backend proof alone.
- The photos' broader production concerns are not cleared by this feature.
  Current source still contains the free-booking fallback in payment.tsx,
  unguarded payout execution, unguarded tracking-history routes, profile
  Object.assign mass assignment, and unsigned Twilio callbacks. These require
  a separate coordinated hardening pass before production readiness is claimed.
- Checkout printer UI is reserved for Codex and remains untouched pending
  Sushant's sample.

## Changed files

```
.gitignore
admin/src/App.tsx
admin/src/components/Layout.tsx
admin/src/lib/api.ts
admin/src/pages/IdentityVerifications.tsx
backend/scripts/verify-identity-review.cjs
backend/src/app.module.ts
backend/src/database/data-source.ts
backend/src/database/entities/audit.entity.ts
backend/src/database/migrations/1789149600000-MobileIdentityVerifications.ts
backend/src/database/private-query.logger.spec.ts
backend/src/database/private-query.logger.ts
backend/src/modules/admin/admin.module.ts
backend/src/modules/admin/identity-review.controller.ts
backend/src/modules/admin/identity-review.service.ts
backend/src/modules/private-media/private-media.module.ts
backend/src/modules/private-media/private-media.service.spec.ts
backend/src/modules/private-media/private-media.service.ts
```
