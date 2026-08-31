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

> **Codex: start at Phase 0.** It is not optional and it is not yours to skip —
> two of its four items block every other phase, and one of them is holding your
> own 15 commits out of the build.

---

## 1. Verified status — measured 2026-08-31

Run on `feat/mobile-api-v1` @ `19fd3d7` unless stated.

| Gate | Result | Note |
| --- | --- | --- |
| `backend: npx jest src --runInBand --forceExit` | **8 suites / 95 tests pass** | Up from 88. **Hangs without `--forceExit`** — open-handle leak, see P0-7 |
| `admin: npm run lint` | **clean** | Was 77 errors on 2026-08-30. Closed |
| `admin: npm run build` | **passes** | 360 KB JS / 23 KB CSS |
| `mobile/artifacts/mobile: tsc --noEmit` | **clean** | The app itself typechecks |
| `backend: npm audit --omit=dev` | **1 critical, 10 high**, 25 moderate, 1 low | Codex's patches are on its branch, **not integrated** |
| `admin: npm audit --omit=dev` | **3 high**, 1 moderate | Same — patch exists, not integrated |
| Platform base migration on `feat` | **absent** | Exists on `codex/prod-readiness` as `1746284000000-InitialTypeormBaseline.ts`, **unproven** |
| Admin route gaps (3) | **implemented** on `feat` | `admin.controller.ts:151,156,161` via `0699fb5`. Integration tests not confirmed |
| `/health` | **Postgres only** | Redis/BullMQ still unchecked |
| `eas.json` | **placeholders** | `YOUR_APPLE_ID_EMAIL`, `YOUR_APP_STORE_CONNECT_APP_ID`, `YOUR_APPLE_TEAM_ID`; `extra.eas.projectId` is null |

**Not re-verified today** (carried from `PRODUCTION_READINESS.md`, treat as
unconfirmed): mobile dependency audit counts, and the `mockup-sandbox` workspace
build failure.

---

## Phase 0 — Repository hygiene · BLOCKING EVERYTHING

Nothing below Phase 0 can be trusted while the work is spread across three trees.

### P0-1. Two working copies have diverged · owner: **Claude**, approval: **Sushant**

There are two independent clones, both on `feat/mobile-api-v1`, both clean, both
unpushed, sharing ancestor `1965b15`:

| Tree | Ahead of origin | Contains |
| --- | --- | --- |
| `~/Desktop/TheBovogo App` | **26 commits** | the whole Claude/Codex pass, `workflow/`, the registered Codex worktree |
| `~/Desktop/Bovogo VS/BOVO-V1` | **2 commits** | `d81ba6b` Safety Tips copy, `425c6df` ID/selfie verification copy |

Neither contains the other's head. `Bovogo VS/BOVO-V1` is a **separate clone**
(HTTPS remote), not a registered worktree, and has no `workflow/` directory — so
whoever worked there could not see the operating agreement.

Two commits of real product work are stranded. Both touch files in **Claude's
lane** (`mobile/**`, `identity.controller.ts`).

**Do:** cherry-pick `d81ba6b` and `425c6df` onto `~/Desktop/TheBovogo App`,
re-run the mobile typecheck, then **delete or archive the second clone** so it
cannot diverge again. One canonical tree, plus the registered worktree.

*Done when:* `git -C "$HOME/Desktop/TheBovogo App" log` contains both commits,
mobile typecheck is clean, and the stray clone is gone.

### P0-2. Integrate the 15 Codex commits · owner: **Claude**

`codex/prod-readiness` @ `eb60e8d` is 15 commits ahead of the integration branch
and carries work the release depends on: the TypeORM baseline, CORS enforcement,
the Prettier gate, AWS SDK v3, Sentry removal, and **both dependency patch sets**.

Until this integrates, §1's audit numbers stand and the migration story does not
exist on the branch that ships.

**Do:** integrate per `AGENT_OPERATING_AGREEMENT.md` §10 — review, certify
migrations and contracts against the mobile client, run combined gates.

*Done when:* `git rev-list --count feat/mobile-api-v1..codex/prod-readiness` is
`0`, all §1 gates re-run green, and `CONTRACTS.md` has a row for any changed
response shape.

### P0-3. Nothing is pushed · owner: **Sushant** approves, **Claude** executes

`origin/feat/mobile-api-v1` is still at `1965b15`. **26+ commits exist only on
this Mac.** A disk failure loses the entire pass.

Per the agreement §11, neither agent pushes without explicit approval. Ask for it
early — this is the cheapest risk reduction available.

### P0-4. Decide `mockup-sandbox` · owner: **Sushant** · `DECISIONS.md` #2 still open

`AGENT_OPERATING_AGREEMENT.md` §9.1 asks it; it has never been answered and it
gates the mobile release build.

Recommendation stands: **drop `mockup-sandbox` from the release gate.** It is
referenced by nothing but the lockfile, ships to no user, and the alternative
unpins Expo SDK 54.

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

### P1-5. Orphan table decision · owner: **Claude**

`data_deletion_requests` exists in the schema with **no entity anywhere in the
codebase** — it appears only in `1746284700000-ComplianceColumnsAddition.ts`.
Either wire it to the privacy module or drop it. A deletion-request table nothing
writes to is a compliance liability if anyone believes it is being used.

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

## Phase 5 — Infrastructure, CI and observability

### P5-1. Health readiness · owner: **Codex**

`/health` checks Postgres only, though Redis/BullMQ are required for startup.
Add both. Not testable locally (no Redis on this machine) — staging is the first
real check.

### P5-2. Jest open-handle leak · owner: **Codex**

`npm test` **does not exit** — it hangs until killed, and only completes with
`--forceExit`. In CI that is a job that burns its full timeout on every run. Find
the handle (`--detectOpenHandles`) rather than papering over it with `--forceExit`.

### P5-3. Dependency vulnerabilities · owner: **Codex**

Post-integration, re-audit all three workspaces. Target: zero critical/high, or a
dated, written, time-limited exception per remaining advisory.

**Mobile advisories are reported by Codex and applied by Claude** — never run an
install under `mobile/`; the lockfile carries the Expo SDK 54 pins.

### P5-4. Deployment · owner: **Codex** + **Sushant**

- No admin-dashboard deployment workflow exists. Add one.
- Every `sed -i "s|KEY=.*|KEY=${{ secrets.X }}|"` line in `backend-deploy.yml`
  (~20 of them) breaks if a secret contains a `|`. Pre-existing; fix in one
  focused commit next time that file is touched.
- Branch protection on `main` with required backend/admin/mobile checks.

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

```
P2-1 rotate credential ─┐
P0-1 merge stray tree ──┼─→ P0-2 integrate Codex ─→ P1-1 prove migrations ─┐
P0-4 mockup decision ───┘                                                   │
                                                                            ▼
P3 integrations (Sushant, parallel) ─────────────→ Phase 8 staging ─→ launch
P4-1 insurance decision (Sushant) ───────────────→        ▲
Phase 6 legal (Sushant, longest lead) ───────────────────┘
```

**Phase 6 and P4-1 have the longest lead times and no engineering dependency —
start them today.** Everything in Phases 1, 4 and 5 can proceed in parallel;
none of it matters if the legal and insurance positions are not settled.
