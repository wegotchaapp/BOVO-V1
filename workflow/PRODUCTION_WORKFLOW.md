# Bovogo — production workflow

**The single sequenced plan from today's build to a live release.** Covers
engineering, data, security, integrations, legal, store submission, and
operations.

Authored by Claude Code, 2026-08-31, after inspecting the working tree. Every
status in §1 was measured today on `feat/mobile-api-v1` @ `19fd3d7`, not carried
forward from an earlier audit. Where a claim is *not* re-verified it says so.

**Relationship to the other documents in this directory:**

| Document | Role | Still authoritative? |
| --- | --- | --- |
| `AGENT_OPERATING_AGREEMENT.md` | lane ownership, shared-artifact protocol, contract freeze, integration gate | **Yes — read it first.** This file never overrides it |
| `CODEX_ACTIONS.md` | Codex's live task queue | Yes, for task detail |
| `PRODUCTION_READINESS.md` | audit snapshot, 2026-08-30 | **Partly stale** — §1 below supersedes its status table |
| `RELEASE_CHECKLIST.md` | final pre-flight gate | Yes — Phase 8 runs it |
| `SCHEMA_BASELINE.md` | frozen schema intent | Yes |
| `CREDENTIAL_ROTATION.md` | the two secret jobs | Yes — Phase 2 |
| `docs/APP_STORE_SUBMISSION.md` | store mechanics | Yes — Phase 7 |
| `DECISIONS.md` / `CONTRACTS.md` / `FINDINGS.md` | coordination ledgers | Yes |

> **Phase 0 is closed** (2026-09-01). The stranded commits are cherry-picked,
> Codex's 15 commits are integrated, the branch is pushed, the stray clone is
> archived and gone, and `mockup-sandbox` is decided.
>
> **Codex: your next item is P1-1.** The baseline is on the release branch now,
> and it is the only thing standing between this build and a database that can
> be created from empty.

---

## 1. Verified status — re-measured 2026-09-01

Run on `feat/mobile-api-v1` @ `00c3e8a`, after the Phase 0 integration, with
`npm ci` run in `backend/` and `admin/` so the merged lockfiles are what was
actually tested.

| Gate | Result | Note |
| --- | --- | --- |
| `backend: npx jest src --runInBand --forceExit` | **10 suites / 99 tests pass** | Up from 95. Codex's CORS and JWT-strategy specs. **Still hangs without `--forceExit`** — see P5-2 |
| `backend: npm run build` | **passes** | |
| `backend: npm run format:check` | **clean** | The Prettier gate is now enforced in CI (`5c75c60`) |
| `backend: npm run lint` | **821 errors** | Down from 842 on `main`. Deliberately non-blocking in both workflows; the backlog is `no-unsafe-*` in weather, trust_safety and payments |
| `admin: npm run lint` | **clean** | |
| `admin: npm run build` | **passes** | 370.99 kB JS / 23.58 kB CSS |
| `mobile/artifacts/mobile: tsc --noEmit` | **clean** | Re-run after both cherry-picks and the merge |
| `mobile: pnpm run typecheck` (whole workspace) | **passes** | Scopes to 4 of 10 projects — `mockup-sandbox` is excluded by decision, see P0-4 |
| `backend: npm audit --omit=dev` | **0 vulnerabilities** | Was 1 critical, 10 high, 25 moderate, 1 low. Closed by integrating `25ac35d` |
| `admin: npm audit --omit=dev` | **0 vulnerabilities** | Was 3 high, 1 moderate. Closed by integrating `d5ac8d3` |
| Platform base migration on `feat` | **present**, still **unproven** | `1746284000000-InitialTypeormBaseline.ts` merged. It has never been run against a database — P1-1 is unchanged |
| Admin route gaps (3) | **implemented** on `feat` | `admin.controller.ts:151,156,161` via `0699fb5`. Integration tests not confirmed |
| `/health` | **Postgres only** | Redis/BullMQ still unchecked |
| `eas.json` | **placeholders** | `YOUR_APPLE_ID_EMAIL`, `YOUR_APP_STORE_CONNECT_APP_ID`, `YOUR_APPLE_TEAM_ID`; `extra.eas.projectId` is null |

**Not re-verified today** (carried from `PRODUCTION_READINESS.md`, treat as
unconfirmed): the mobile dependency audit counts. The `mockup-sandbox` failure
is no longer listed as a blocker — it is out of the gate by decision, and its two
type errors are unchanged and unfixed.

**No runtime testing was done at any point.** Every row above is a build, a
typecheck, a test run or an audit. No server was started and no screen opened.

---

## Phase 0 — Repository hygiene · BLOCKING EVERYTHING

Nothing below Phase 0 can be trusted while the work is spread across three trees.

### P0-1. Two working copies have diverged · owner: **Claude**, approval: **Sushant** · **mostly done 2026-09-01**

Two independent clones, both on `feat/mobile-api-v1`, sharing ancestor `1965b15`,
neither containing the other's head. `Bovogo VS/BOVO-V1` is a **separate clone**
(HTTPS remote), not a registered worktree, and has no `workflow/` directory — so
whoever worked there could not see the operating agreement. That is the likely
root cause, rather than carelessness.

Both stranded commits were read in full and cherry-picked cleanly onto this tree:

| Commit | Now | Touches |
| --- | --- | --- |
| `d81ba6b` → `75e5a4f` | on `feat` | Safety Tips: silent recording, "follow your position", number masking |
| `425c6df` → `fb46f57` | on `feat` | `verify.tsx` hardcoding ID and selfie to done; the two fake `kyc/*` routes |

Mobile typecheck clean afterwards; backend tests still green.

**Closed.** On Sushant's instruction the stray clone was archived to
`~/Desktop/BOVO-V1-stray-clone-archive-2026-09-01.tar.gz` (17 MB, `.git`
included, so its history survives) and `~/Desktop/Bovogo VS/` was removed. It
was verified empty of unique work first: no uncommitted changes, no stashes,
every local branch tracking `origin`, and both of its own commits confirmed
present on the pushed branch.

There is now **one clone and one registered worktree**, which is what the rest
of this document assumes.

### P0-2. Integrate the 15 Codex commits · owner: **Claude** · **done 2026-09-01**

Merged as `00c3e8a`. `git rev-list --count feat/mobile-api-v1..codex/prod-readiness`
is now `0`, and the §1 gates above were re-run on the merge result.

Reviewed before merging, per `AGENT_OPERATING_AGREEMENT.md` §10:

- `cd6de43` adds `tax_blocked` to the JWT strategy's `select`. The column is real
  (`user.entity.ts:153`, and both migrations that create it) — worth checking,
  because the spec mocks the repository, so a missing column would not have
  failed a test, it would have 500'd every authenticated request in production.
- `b67a747` moves the three mobile-api services and profiles to AWS SDK v3.
  Credentials are passed only when both are set, which is right for instance
  roles, and the `AKIA`-prefix guard before a real upload survives.
- `eb60e8d` creates `uuid-ossp` first, and its timestamp sorts before the mobile
  migrations, so `users` exists before anything `ALTER`s it. It also adds a
  `migration:run` step to `backend-ci.yml`, which will prove the empty-database
  case on the next PR. **It has still never been run** — P1-1 stands.
- `d5ac8d3` / `25ac35d` are the dependency patches, and they land: both audits
  are now zero.

Two conflicts, both resolved toward the newer intent: `identity.controller.ts`
(kept `fb46f57`'s deletion of the fake `kyc/*` routes over Codex's reformat of
them, and dropped the orphaned `Body` import) and `FINDINGS.md` (took Codex's
`applied` status on the UUID-default row, kept the open CORS row).

**No `CONTRACTS.md` row is required.** Nothing in the merge changes a response
shape the mobile client reads: the two deleted `kyc/*` routes sat outside the
`/api` namespace and had no callers anywhere in the repo, and the added JWT
fields are internal to `request.user`.

### P0-3. Nothing is pushed · owner: **Sushant** approves, **Claude** executes · **done 2026-09-01**

`origin/feat/mobile-api-v1` moved `1965b15..eb80232` — 45 commits, the whole
Claude/Codex pass, which until then existed only on this Mac. Approved
explicitly by Sushant per agreement §11 before the push, and that approval
covered this push only: **no PR was opened and nothing went near `main`.**

The next push needs its own approval.

### P0-4. Decide `mockup-sandbox` · owner: **Sushant** · **decided 2026-09-01**

**Dropped from the release gate**, recorded as `DECISIONS.md` #2. It ships to no
user, is referenced by nothing but the lockfile, and the alternative unpins Expo
SDK 54 for the sake of two type errors in a sandbox.

No code change was needed — `mobile/package.json` already filters
`!@workspace/mockup-sandbox` out of `typecheck`, `build` and `test`, with an
opt-in `typecheck:sandbox` for anyone working in there. Verified on the day:
`pnpm run typecheck` scopes to 4 of 10 projects and all four pass.

---

## Phase 1 — A fresh production database must be creatable

The single largest technical risk. Today there is no proven path from an empty
Postgres to a working schema.

### P1-1. Prove the migrations · owner: **Codex** · certify: **Claude**

The baseline exists but has never been demonstrated. Per `CODEX_ACTIONS.md`, the
gate is four runs, with **console output posted** — "it ran" is not evidence:

1. Empty database → `migration:run` → clean, exit 0.
2. Second `migration:run` on the same database → **no-op**, exit 0.
3. `migration:run` against a **copy of production** → no data loss, no
   duplicate-index error, no constraint-already-exists error.
4. Mobile migrations re-checked against `SCHEMA_BASELINE.md` §1–§3 once they run
   in sequence after a real platform base.

Read `AGENT_OPERATING_AGREEMENT.md` §6.1 **before** writing: the three conversion
hazards (no foreign keys on odometer/SOS, `CONCURRENTLY` outside transactions,
`vehicle_review_backfill.sql` being data not schema) are faithful to production
and must not be "fixed".

### P1-2. Redundant index cleanup · owner: **Codex** · after P1-1

Three prefix-redundant pairs, specified in `SCHEMA_BASELINE.md` §2.3. Its own
migration, after the conversion is proven.

### P1-3. Connection pooling · owner: **Sushant** + **Codex**

`DATABASE_URL` points at Supabase's **direct** connection (5432), which has a
hard project-wide cap. Production needs the **Supavisor pooler on 6543** in
transaction mode, keeping 5432 for migrations only. Without it,
`pool max × instances` exhausts the cap and the API cannot scale horizontally.

### P1-4. Backup and restore drill · owner: **Sushant**

Supabase gives automatic backups and PITR. **Untested is not a backup.** Restore
into a scratch project and confirm the app boots against it. Record who owns
restore and the RTO.

### P1-5. Orphan table decision · owner: **Claude** · **investigated 2026-09-01 — answer: drop, but not yet**

`data_deletion_requests` is created by `1746284700000-ComplianceColumnsAddition.ts:61`
and the name appears nowhere else in `backend/src`, `admin/src` or the mobile
app. Confirmed orphan.

**It should be dropped, not wired**, because neither working deletion path wants
it. Account deletion is recorded on `mobile_users.deletion_requested_at`, and
the compliance record is a `compliance_logs` row. A third table would be a
fourth version of the truth, and the pull-request that "connects" it later would
be connecting it to nothing.

**Do not write that migration yet.** Codex is proving the migration chain right
now (P1-1); changing the schema underneath a proof run invalidates it. The drop
belongs with the redundant-index cleanup in **P1-2**, which is already correctly
queued for after the proof passes. One migration, two cleanups, run once against
a chain that has been demonstrated.

Investigating it turned up something worse, which is P4-5.

---

## Phase 2 — Security and secrets

### P2-1. Rotate the exposed Supabase password · owner: **Sushant** · DO FIRST

The live `postgres` credential for `db.msrgmsvkuoqouohqijrp.supabase.co` has been
in `origin/main` since the **initial commit**, `c8377f9`, 2026-06-23 — roughly
ten weeks, reachable from every ref.

**Rotation is the only control that works.** Do not rewrite history: clones,
forks and GitHub's object caches keep the old blobs, and it would mean rewriting
`main`. Follow `CREDENTIAL_ROTATION.md` — take the full consumer inventory first
(Supabase, GitHub Actions, Railway, every local `.env`), because rotation
invalidates it everywhere at once.

### P2-2. Set `ALLOWED_ORIGINS` to a real list · owner: **Sushant** · before next deploy

`70e88ef` correctly starts enforcing a CORS allow-list, and `9a0c63e` makes the
deploy fail when the secret is unset. The value must be a **comma-separated list**
containing the admin dashboard's origin and the Expo **web** origin if hosted —
not the API's own URL. Native Expo clients send no `Origin` and pass through
correctly.

Wrong value = admin dashboard silently blocked in production. See `FINDINGS.md`.

### P2-3. Webhook hardening · owner: **Codex** · certify: **Claude**

- **Checkr** — done, keep specs green.
- **Noonlight** — handed to Codex. Two hard constraints: the existing specs are
  **mutation-tested** and the behaviour was proven on real hardware, so **no
  existing test may be weakened or deleted**, and the terminal-status guard (a
  late `alarm.psap_contacted` must not reopen a closed emergency) must keep
  passing.
- **Stripe** — three separate endpoints, three separate secrets. See P3-1.

### P2-4. Secret management · owner: **Sushant**

Production secrets must live outside the repository with a named owner, a
rotation procedure, and a verification step per secret — not merely a value
source. `CREDENTIAL_ROTATION.md` is the template.

---

## Phase 3 — Integrations · owner: **Sushant** (account actions only)

None of this is code. All of it blocks revenue or launch. Step-by-step lives in
the Obsidian vault at `Status/Integration Setup Steps.md`.

**Credential state, measured today — unchanged since 2026-08-24:**

| Integration | State | Without it |
| --- | --- | --- |
| **Stripe** (5–6 vars) | all placeholder | No payments, no Travel+, **no ID verification** |
| **Checkr** | placeholder; `CHECKR_PACKAGE` **absent** | No background checks |
| **Twilio Verify SID** | placeholder | No signup phone verification |
| **Resend** | placeholder | All transactional email dead |
| **Twilio account** | credentials valid, **trial-locked** | SOS emergency-contact SMS cannot send |
| **Noonlight** | **set**, sandbox URL | Working; swap to production URL at launch |
| **MGA (insurance)** | **absent entirely** | See P4-1 — this one is not merely missing |

Two variables are missing from `.env` altogether and will fail quietly rather
than loudly: **`CHECKR_PACKAGE`** (code defaults to `driver_pro`, which 400s if
the account has no such package) and **`STRIPE_CONNECT_WEBHOOK_SECRET`**.

The Stripe publishable key goes in **two** files. `payment.tsx` checks for the
substring `your-stripe` and silently degrades to instant-confirm, so a half-done
paste looks like success.

**Twilio must leave trial.** A trial account sends only predefined templates
(`572006 — Invalid template name`). The SOS message carries a live map link and
is necessarily custom. Buying numbers does not fix it.

---

## Phase 4 — Product truth · owner: **Claude**

Things the app currently tells users that are not true. This project has a strong
track record here — keep it.

### P4-1. Insurance is charged but never issued · **LAUNCH BLOCKER**

Verified today, and it is worse than "an unbuilt integration":

- `INSURANCE_PREMIUM=15.00`, **default-on** — the Sailor must actively decline.
- It flows into `subtotal` → `totalAmount` in `mobile-pricing.ts`, so it **is
  charged**, and Bovogo books `INSURANCE_COMMISSION` of it as `platformGross`.
- `InsuranceService.activatePolicy()` exists in
  `backend/src/modules/insurance/insurance.service.ts` and has **zero callers**
  anywhere in the codebase.
- `MGA_API_URL` / `MGA_API_KEY` appear in **neither `.env` nor `.env.example`**.
- Its no-credential path returns a **mock policy** with a fabricated
  `WG-INS-<timestamp>` number and `provider: 'mock'`.

So money is collected for insurance, a commission is recognised on it, and no
policy is ever created — and the only code that could create one would mint a
fake number if it were wired up as-is.

**This cannot ship in any form.** Three acceptable resolutions, in order of
preference:

1. **Complete the MGA integration** — real provider, real credentials, real
   policy numbers persisted against the booking, and the mock path removed or
   hard-failed outside development.
2. **Turn the premium off** (`INSURANCE_PREMIUM=0`, default-off) and remove the
   line item from checkout until a provider exists.
3. **Relabel it** as something it truthfully is — but only with written
   confirmation from counsel, because "insurance" is a regulated word.

Whichever is chosen, the mock fallback must never be reachable in production.
This is a **`USER DECISION`** — it is commercial and legal, not technical.

### P4-2. "Always" location requested, only foreground used

Verified: the app's sole location API is `watchPositionAsync` in
`hooks/useLiveLocation.ts` — foreground only. No `startLocationUpdatesAsync`, no
TaskManager, and `UIBackgroundModes` is **not set** in `app.json`.

Yet the expo-location plugin requests `locationAlwaysAndWhenInUsePermission` and
the app declares `NSLocationAlwaysAndWhenInUseUsageDescription`.

Two consequences, both real:

1. **App Store review risk.** Apple requires the permission requested to match
   actual use. Asking for Always with no background location capability is a
   common rejection.
2. **Live tracking stops when the phone locks.** For a trip-safety product this
   is a product gap, not just a config one — the same class of "promises what it
   does not do" defect the team has been fixing all along.

**Decide:** either implement genuine background tracking (background mode, task
manager, and the battery/consent consequences) **or** drop to
`locationWhenInUsePermission` and say plainly in-app that tracking runs while the
app is open. Do not ship the current mismatch.

### P4-3. Storage URLs · **joint item — coordinate before writing**

`mobile-odometer.service.ts:230` builds `${appUrl}/uploads/...` while the evidence
is written to **private S3**. Those URLs only resolve for local disk; deployed,
the photos will not load.

Per `AGENT_OPERATING_AGREEMENT.md` §6.3 this lands as **one unit**: Codex
implements signed URLs or an authorized proxy and sends the response shape
**first**; Claude adapts `lib/odometer.ts`, `lib/vehicles.ts` and the screens.
Neither half merges alone. A row in `CONTRACTS.md` is required.

### P4-4. Customer-flow audit

End-to-end by hand: auth, search, booking, checkout, confirmation, ticket, trip
start, odometer, earnings, rating, SOS. Fix client-side defects with tests.

---

### P4-5. The CCPA deletion API promises 30 days and does nothing · owner: **Claude** · found 2026-09-01

Found while investigating P1-5. There are **two** account-deletion
implementations with **two different grace periods**, and the one with the
stronger promise is the broken one.

| | Mobile path | Platform path |
| --- | --- | --- |
| Route | `POST account/delete` → `mobile-auth.service.ts:225` | `POST /privacy/delete` → `privacy.service.ts:326` |
| Grace | **7 days** (`DELETION_GRACE_DAYS`) | **30 days**, per its own response text |
| Records the request | `mobile_users.deletion_requested_at` — a real column | `(user as any).deletion_scheduled_at` — **not a column** |
| Compliance log | none | `compliance_logs`, `CCPA_TEXAS_DELETION` |
| Actually works | **yes** | **no** |

The mobile app is fine and honest: `profile.tsx:191` tells the user "permanently
deleted in 7 days", which is what its backend does.

The platform path is not. `deletion_scheduled_at` and `deletion_reason` exist in
**no entity, no migration, not in the new baseline, and not in the frozen
production record** — they are written through `as any` casts, and TypeORM drops
properties that are not mapped columns. So:

1. `requestDeletion` answers *"You have 30 days to cancel before data is
   permanently deleted"* and **persists nothing** but the compliance log.
2. `cancelDeletion` reads the same phantom property, so it always answers
   *"No pending deletion request found."*
3. `processScheduledDeletions` — run nightly by
   `retention.processor.ts:16` — filters on `u.deletion_scheduled_at IS NOT NULL`
   in a query builder. That column does not exist in the database, so the query
   **throws every night**, into a `try/catch` that logs and moves on. Silent.

Nothing calls `/privacy/delete` today — no client in this repo does — so no
user has been told the false thing yet. That is the same shape as the fake
`kyc/*` routes and the insurance service: a complete-looking implementation,
reachable from Swagger, that would start lying the moment someone wired it up.

**Do:** delete the platform deletion path and let the mobile one be the only
one, or give it the two columns and make the cron work. Deleting is preferable —
one deletion path, one grace period, one promise — but the 30-day text may
already be in a draft privacy policy, which makes it a **Phase 6 question**
before it is an engineering one. It is not a launch blocker while it has no
callers; it becomes one the day it gets one.

---

## Phase 5 — Infrastructure, CI and observability

### P5-1. Health readiness · owner: **Codex** · **done — integrated 2026-09-02 in `d5041f7`**

Delivered as `16c2501` on `codex/prod-readiness`: a `BullmqHealthIndicator` with
a Redis `ping` and a `getJobCounts` probe across both queues, each wrapped in a
5-second timeout that clears its own timer, both wired into `/health`.

Certified by reading — the parts that could silently pass while broken:

- The queue names are the real ones. `notifications` and `safety-jobs` match
  `notifications.module.ts:26` and `safety.module.ts:37`; a wrong name would have
  registered a *new* empty queue and reported healthy forever.
- `HealthIndicatorService` is a genuine export of the installed
  `@nestjs/terminus` 11.1.1, not a hallucinated API.

Gates run on the merge result 2026-09-02: backend 11 suites / 103 tests, build,
`format:check`, and both production audits clean at `--audit-level=high`; admin
lint and build clean; mobile typecheck clean.

Two consequences to act on, neither a defect in the code:

> [!warning] Redis must exist on Railway **before** the next deploy
> `/health` now returns 503 when Redis is unreachable — which is the point, and
> is what "required for startup" should mean. But it also means that if Redis is
> not provisioned in the production environment, the first deploy after this
> integrates will fail its post-deploy health check and look broken when the API
> itself is fine. **Owner: Sushant.** Confirm Redis is provisioned and
> `REDIS_URL` is set, or expect a red deploy.

- Minor, optional: a third queue exists — `background-check-recheck`
  (`src/jobs/recheck.processor.ts:11`) — and is not probed. It shares the same
  Redis as the other two, so it cannot realistically fail alone. Worth adding for
  completeness; not worth a round trip on its own.

### P5-2. Jest open-handle leak · owner: **Codex**

`npm test` **does not exit** — it hangs until killed, and only completes with
`--forceExit`. In CI that is a job that burns its full timeout on every run. Find
the handle (`--detectOpenHandles`) rather than papering over it with `--forceExit`.

### P5-3. Dependency vulnerabilities · owner: **Codex**

Post-integration, re-audit all three workspaces. Target: zero critical/high, or a
dated, written, time-limited exception per remaining advisory.

**Mobile advisories are reported by Codex and applied by Claude** — never run an
install under `mobile/`; the lockfile carries the Expo SDK 54 pins.

### P5-4. Deployment · owner: **Codex** + **Sushant** · **two of three closed 2026-09-02**

- ~~No admin-dashboard deployment workflow exists.~~ **Done** — `b32f89d` adds
  `admin-ci.yml` (lint, build, production audit) and puts the same audit gate on
  backend CI. Integrated in `d5041f7`.
- ~~Every `sed -i "s|KEY=.*|KEY=${{ secrets.X }}|"` line in `backend-deploy.yml`
  breaks if a secret contains a `|`.~~ **Done** — `049ffac` replaces all ~17 with
  environment variables and `scripts/write-deploy-env.cjs`, which also fails the
  deploy when a secret is set but missing from the template. One follow-up is
  open against it in `FINDINGS.md`: quotes and backslashes in a secret value are
  still mangled, because dotenv does not decode `\"` or `\\`.
- **Still open — Sushant.** Branch protection on `main` with required
  backend/admin/mobile checks. There are now three CI workflows to require.

> [!warning] The audit gate will go red on its own one day
> `--audit-level=high` now gates both workspaces. That is the point of an audit
> gate, and it is only passable because both audits are at zero — but it means a
> red build eventually arrives on a branch where nobody changed anything.

### P5-5. Monitoring and alerting · owner: **Sushant** + **Codex**

Sentry was **removed** (`5ea8182`) — it was a dependency with zero usage, so this
was correct, but it means there is now **no error tracking at all**. Decide what
replaces it before launch.

Alerts must cover, at minimum: API availability, database pool saturation, Redis,
payment failures, webhook failures, and **SOS dispatch failures**. The last one is
the only alert where a missed page has a physical-safety consequence — treat it
differently from the rest.

### P5-6. End-to-end suite in CI

`backend/test/e2e/` exists but CI calls none of it. Wire a seeded flow —
registration, vehicle approval, trip, payment, booking, messaging, SOS, cleanup.

---

## Phase 6 — Legal, compliance and insurance · owner: **Sushant**

**No engineering work in this phase, and it is the phase most likely to delay
launch.** Nothing here is in the repository today.

| Item | Why it blocks | Status |
| --- | --- | --- |
| **Terms of Service** | Store submission requires it; it is the contract for the cost-share model | **Not in repo** |
| **Privacy Policy (public URL)** | **Hard requirement** for both stores — the app collects location, payments, identity | **Not in repo** |
| **Insurance / MGA terms** | See P4-1. Premium is provisional at $15 pending terms; Spec v1.0 said $9 | Under negotiation |
| **TNC / livery regulatory position** | Texas. A `Bovogo_Public_Livery_RideShare_Application_DRAFT` exists on the Desktop — status unknown to me | **Confirm with counsel** |
| **Cost-share model defensibility** | The whole pricing design exists to stay a cost-share, not a TNC fare. `breachesCostShareCeiling()` flags trips over the IRS ceiling into `opsReviewNote` | Verify the ops review actually happens |
| **FCRA compliance** | Running background checks means adverse-action notices are a legal duty — and they go out over **Resend, which is unconfigured** (P3) | Blocked on P3 |
| **Driver 1099 / tax reporting** | Payouts to Voyagers | `tax/w9-submit` route exists; process unconfirmed |
| **CCPA / data deletion** | `privacy` module exists; `data_deletion_requests` table is orphaned (P1-5) | Verify the path works end to end |
| **Accessibility** | Store review and legal exposure | Not audited |

> The IRS-ceiling trade-off is deliberate and documented: flat $32.40 pricing
> means short routes can exceed 100% of the ceiling. If Austin↔San Antonio or
> intra-DFW launches, revisit — raising `MIN_DISTANCE_MILES` to 135 is the
> one-line fix.

---

## Phase 7 — Mobile release · owner: **Sushant** for identifiers, **Claude** for build

Mechanics are in `docs/APP_STORE_SUBMISSION.md`. Blockers specific to today:

- **No EAS project.** `extra.eas.projectId` is null; run `eas init` and commit it.
- **`eas.json` placeholders**: `YOUR_APPLE_ID_EMAIL`,
  `YOUR_APP_STORE_CONNECT_APP_ID`, `YOUR_APPLE_TEAM_ID`, and a
  `google-play-service-account.json` path that **does not exist in the repo**.
- Apple Developer ($99/yr) and Google Play ($25) accounts.
- Resolve P4-2 **before** submitting — the location-permission mismatch is a
  review risk.
- Privacy Policy URL (Phase 6) is a hard gate.
- App Privacy "nutrition label": Location, Contact Info, Payment, Identifiers.
- `EXPO_PUBLIC_API_URL` must point at the live HTTPS backend.

**Per the agreement §8: report these values, never invent them.**

---

## Phase 8 — Staging, go/no-go, launch

1. Stand up staging with production-shaped config: pooler, Redis, Stripe test
   webhooks, Checkr sandbox, Noonlight sandbox, real object storage, Mapbox.
2. Run every migration against staging from empty **and** from a production copy.
3. Confirm the admin dashboard can actually reach the API — this is where a wrong
   `ALLOWED_ORIGINS` surfaces.
4. Run the full user-journey smoke test in `RELEASE_CHECKLIST.md` §3.
5. **Fire a real SOS end to end on a real device**, against Noonlight sandbox,
   and confirm: dispatch, the `mobile_sos_events` row, the signed webhook moving
   the status, and the emergency-contact SMS actually arriving (needs P3 Twilio).
6. Internal mobile build → staged smoke test.
7. Record incident owner, rollback plan, restore owner, support escalation.
8. Explicit written go/no-go. Then release backend + admin, then submit mobile.

---

## Ownership summary

| Owner | Phases |
| --- | --- |
| **Sushant** | P0-3, P0-4, P1-3, P1-4, Phase 2 (secrets), **all of Phase 3**, P4-1 decision, **all of Phase 6**, Phase 7 identifiers, Phase 8 go/no-go |
| **Codex** | P0-2 delivery, Phase 1 migrations, P2-3 webhooks, P5-1, P5-2, P5-3, P5-4 |
| **Claude** | P0-1, P0-2 integration + certification, P1-5, Phase 4, P5-6, Phase 7 build |

**Neither agent** pushes, merges to `main`, deploys, rotates a secret, runs a
production migration, or submits an EAS build. Sushant approves each,
individually, every time — `AGENT_OPERATING_AGREEMENT.md` §11.

## The critical path

Phase 0 is done, so the path is shorter than it was — and every remaining item
on it belongs to someone other than Claude.

```
P2-1 rotate credential (Sushant) ─────────────────────────┐
P1-1 prove migrations (Codex) ────────────────────────────┤
P3 integrations (Sushant, parallel) ──────────────────────┼─→ Phase 8 staging ─→ launch
P4-1 insurance decision (Sushant) ────────────────────────┤
Phase 6 legal (Sushant, longest lead) ────────────────────┘
```

**Phase 6 and P4-1 have the longest lead times and no engineering dependency —
start them today.** Everything in Phases 1, 4 and 5 can proceed in parallel;
none of it matters if the legal and insurance positions are not settled.
