# Agent operating agreement — Claude Code + Codex

Status: **active**. Supersedes `CODEX_CLAUDE_WORKPLAN.md`, which is retained for
history only. Where the two disagree, this document wins.

Authored by Claude Code after inspecting the working tree on 2026-08-30.
Every objection below cites a file that exists in this repository today.

---

## 1. Why the previous split cannot be executed as written

The prior plan divides work by *topic* ("mobile" vs "backend"). The real
collision surface in this repo is not topic — it is **generated files, shared
dependency graphs, and API contracts**. Four hard conflicts follow from that.

### 1.1 The prescribed React fix would revert commit `0a851e8`

`PRODUCTION_READINESS.md` P1 says: *"Deduplicate/pin React and `@types/react`
across the workspace."* Executed literally, that breaks the Expo build.

| Consumer | `@types/react` | Source |
| --- | --- | --- |
| `mobile/artifacts/mobile` | `~19.1.10` | pinned locally — Expo SDK 54 requirement, landed in `0a851e8` |
| `mobile/artifacts/mockup-sandbox` | `^19.2.0` | `catalog:` → `mobile/pnpm-workspace.yaml:19` |

Two `@types/react` trees resolve in one pnpm workspace. That *is* the
"conflicting React ref types" failure. Unifying the catalog upward drags the
Expo app to 19.2 and unpins SDK 54; unifying downward moves the catalog off the
version the Vite packages expect. **Neither direction is a free fix**, and the
agent who runs it must be the one who owns the Expo pin. See §9.1 for the
decision I am asking you to make instead.

### 1.2 One 514 KB generated lockfile, two assigned owners

`mobile/pnpm-lock.yaml` has five importers — `artifacts/mobile` (mine),
`artifacts/mockup-sandbox`, `artifacts/api-server`, `artifacts/support-admin`,
`lib/*`. Codex item 5 assigns *"direct dependency vulnerability upgrades"*,
which includes the mobile audit's 2 critical / 24 high. Any such upgrade
regenerates the same lockfile the Expo pin lives in. Two agents cannot edit one
generated lockfile; the merge is not resolvable by hand. The prior plan does not
mention this.

### 1.3 SOS/Noonlight already spans both assigned lanes

The plan gives me "SOS" client-side and gives Codex "webhook security". SOS is
not confined to either side:

```
backend/src/modules/safety/            (incl. noonlight-webhook.controller.ts + spec)
backend/src/modules/noonlight/
backend/src/modules/mobile-api/services/mobile-safety.service.ts
mobile/artifacts/mobile/app/safety.tsx
mobile/artifacts/mobile/lib/safety.ts
```

The last five commits on this branch are all SOS, route-deviation, and Noonlight
work. A webhook-hardening pass that wanders into `noonlight-webhook.controller.ts`
collides with freshly landed, hardware-verified behaviour.

### 1.4 The contract duty runs in only one direction

The plan forbids me from changing backend contracts, but places no reciprocal
duty on Codex not to break mobile clients. The storage-URL item (P1) is exactly
that failure: `mobile/artifacts/mobile/lib/odometer.ts:41` consumes
`photoUrl: string`. Switching to signed URLs or a proxy changes that field's
shape, lifetime, or auth requirement. Under the prior plan Codex may ship it and
I may not fix it.

### 1.5 The tree is already out of compliance

Four files are modified and uncommitted in `backend/test/e2e/` — replacing a
hardcoded `/Users/vaishnavi/...` `process.chdir` with a `__dirname`-relative
`dotenv` path. `backend/` is Codex's lane under the prior plan, so the split is
violated before either agent starts. Also untracked: `backend/railway.json`,
`.codex/`, `workflow/`.

---

## 2. Governance

**Claude Code is the integrator and final technical arbiter.** Codex is a
first-class implementing agent with an exclusive lane and full authority inside
it — this is a routing rule, not a seniority claim.

The rationale is structural, not political: the Expo client is downstream of
every backend contract, migration, and storage decision in this release. The
downstream consumer is the only party that can certify a change did not break
the product. So the party that has to live with a contract certifies it.

What this means in practice:

1. Codex delivers to a branch with evidence. Claude reviews, integrates, and
   runs the combined gates.
2. Disagreement on scope, sequencing, or a contract is decided by Claude, in
   writing, in `workflow/DECISIONS.md`, with the reasoning recorded.
3. **Sushant overrides Claude at any time.** Anything marked `USER DECISION`
   below is not mine to settle.
4. Neither agent pushes, merges to `main`, deploys, rotates a secret, runs a
   production migration, or submits an EAS build. Sushant approves those, every
   time, individually.

---

## 3. Preconditions — before either agent starts

- [ ] Claude commits the four `backend/test/e2e/` fixes (§1.5) so the tree is
      clean. These are e2e harness path fixes, not product changes.
- [ ] Sushant decides on `backend/railway.json` and `.codex/` — commit or ignore.
- [ ] `workflow/` is committed, so both agents read the same agreement.
- [ ] Both agents work in separate worktrees off `feat/mobile-api-v1`:
      `codex/prod-readiness` and `claude/mobile-readiness`.
- [ ] Sushant answers the three `USER DECISION` items in §9.

Codex should not begin until the tree is clean; otherwise its first diff will
carry my uncommitted work.

---

## 4. Exclusive ownership

An agent may create, edit, and delete freely inside its own lane, and may
**read** anything. Editing outside your lane requires a handoff (§5).

| Path | Owner |
| --- | --- |
| `mobile/**` — including `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `eas.json` | Claude |
| `backend/src/modules/mobile-api/**` | Claude |
| `backend/src/modules/safety/**`, `backend/src/modules/noonlight/**` | Claude |
| `backend/test/e2e/**` | Claude |
| `backend/migrations-applied/**` | Claude (frozen — see §6.1) |
| `workflow/**`, `docs/**` | Claude |
| `backend/**` *except the four carve-outs above* | Codex |
| `backend/src/database/migrations/**` | Codex |
| `admin/**` | Codex |
| `.github/workflows/**` | Codex |
| Repo root config (`.gitignore`, `README.md`, `.mcp.json`) | Codex |

Rule of thumb: Codex owns **how the platform is built, deployed, and secured**.
Claude owns **what the app promises the user and the contract that delivers it**.

---

## 5. Shared artifacts — the only files that need a protocol

Five things are genuinely shared. For each there is exactly one writer.

| Artifact | Writer | Other agent's route |
| --- | --- | --- |
| `mobile/pnpm-lock.yaml` + catalog | **Claude only** | File a finding in `workflow/FINDINGS.md`; do not run an install |
| `backend` lockfile + `package.json` | **Codex only** | Claude files a finding |
| `admin` lockfile + `package.json` | **Codex only** | — |
| `backend/src/modules/mobile-api/**` response shapes | **Claude only** | Codex opens an RFC line (§6.2) |
| `.github/workflows/mobile-*.yml` | **Codex writes, Claude approves** | Codex proposes commands; Claude confirms they match the real scripts |

Codex: the mobile audit findings (2 critical / 24 high) are **yours to report
and mine to apply**. Send me the advisory list and the minimum safe target
versions. Do not run `pnpm up` anywhere under `mobile/`. That single rule
removes the largest merge hazard in this repo.

---

## 6. Standing rules

### 6.1 Migration source freeze

`backend/migrations-applied/*.sql` is the **authoritative statement of schema
intent** for vehicle, odometer, SOS, route-deviation, luggage, and perf indexes.
It is frozen for this pass. Neither agent edits those files.

Codex converts them into TypeORM migrations under
`backend/src/database/migrations/`, mechanically and faithfully. Claude
certifies that each converted migration means the same thing as its source and
that the columns still satisfy the mobile entities in
`backend/src/modules/mobile-api/entities/mobile.entities.ts`.

If a source `.sql` is itself wrong, Codex reports it — it does not silently
correct it. Schema semantics are a `USER DECISION`.

### 6.2 Contract freeze

No change to any response shape consumed by `mobile/artifacts/mobile/lib/*.ts`
lands without a line in `workflow/CONTRACTS.md` naming the route, the old shape,
the new shape, and the client change required. This binds **both** agents.

The affected client modules are: `api.ts`, `bookings.ts`, `conversations.ts`,
`groups.ts`, `odometer.ts`, `preferences.ts`, `ratings.ts`, `safety.ts`,
`trips.ts`, `vehicles.ts`, `pricing.ts`, `tracking.ts`.

### 6.3 Joint items — land as one unit or not at all

Two work items cross the boundary and must be merged as a single reviewed unit,
never as two independent commits:

- **Storage URL handling.** Codex implements signed URLs / an authorized proxy
  server-side; Claude adapts `lib/odometer.ts` and `lib/vehicles.ts` and the
  screens that render evidence. Neither half merges alone.
- **CORS allow-list.** Codex writes the allow-list in `backend/src/main.ts`;
  Claude supplies the exact Expo web and dev origins it must contain. A wrong
  allow-list breaks the app silently in staging.

### 6.4 Evidence, not assertion

Every delivered item carries: commands run, verbatim results, changed-file list,
and what was *not* verified. "Should work" is not a status. A failing test is
reported as failing.

---

## 7. Work assignment — Codex

Ordered by blast radius. Each item is independently reviewable.

1. **TypeORM migrations** (P0). Convert the frozen `migrations-applied/*.sql`
   set into discovered, ordered migrations. Prove `npm run migration:run` on
   (a) an empty database and (b) a copy of the current schema, and prove it is
   idempotent on a second run. *Done when:* both runs are clean and Claude has
   certified semantics against the mobile entities.

2. **Checkr webhook hardening** (P0). Raw-body signature verification, reject
   unsigned/invalid, persist provider event IDs for replay protection, tests for
   duplicate delivery. *Stay out of* `backend/src/modules/safety/` — the
   Noonlight webhook is a separate controller in Claude's lane. If it needs the
   same hardening, say so and I will apply the identical pattern.

3. **Backend/admin CI coherence** (P0). Resolve the `backend-deploy.yml` blocking
   lint vs `backend-ci.yml` non-blocking lint contradiction, and the 77 admin
   lint errors. Propose the mobile workflow rewrite (paths, pnpm, working dir)
   but hold it for Claude's confirmation that the commands match real scripts —
   the current files target a `wegotcha/**` layout that no longer exists.

4. **Admin route contract gaps** (P1). `GET /admin/compliance-logs`,
   `/admin/driver-trips/summary`, `/admin/driver-earnings/:id`. Guarded routes
   plus integration tests, or change the dashboard to the implemented routes.
   Either is acceptable; state which and why.

5. **Backend + admin dependency upgrades** (P0). Those two lockfiles only.
   Mobile advisories → `workflow/FINDINGS.md` for Claude.

6. **Storage URLs and CORS** — joint items, per §6.3. Coordinate before writing.

7. **Health readiness** — add Redis/BullMQ to `/health`. Note that Redis is not
   available in the local environment (`docs/summary.md`), so staging is the
   first place this is truly testable.

---

## 8. Work assignment — Claude

1. Commit the e2e harness fixes; clean the tree (§3).
2. Resolve the workspace type conflict **after** the §9.1 decision — the correct
   fix depends on whether `mockup-sandbox` stays in the release gate.
3. Establish a reproducible mobile gate: typecheck plus a production Expo export
   that actually runs in CI. `pnpm typecheck` already passes for
   `artifacts/mobile`; the failure is workspace-wide, and I intend to make that
   distinction explicit rather than papering over it.
4. Audit the customer flows end to end — auth, search, booking, checkout,
   confirmation, ticket, SOS — and fix clear client-side defects with tests
   where the project supports them.
5. Apply mobile dependency remediation from Codex's findings, preserving the
   Expo SDK 54 pins.
6. Certify every migration and contract change from Codex against the client.
7. Integrate, run the combined gates, and prepare the PR for Sushant's approval.
8. Report — never invent — the missing release values: EAS project ID, Apple
   Team ID, ASC app ID, Google Play service account, and the production API
   origin. `eas.json` currently holds `YOUR_APPLE_ID_EMAIL`,
   `YOUR_APP_STORE_CONNECT_APP_ID`, `YOUR_APPLE_TEAM_ID`, and a
   `google-play-service-account.json` path that does not exist in the repo.

---

## 9. USER DECISIONS — I will not settle these alone

### 9.1 Does `mockup-sandbox` block the release?

`mobile/artifacts/mockup-sandbox` is referenced by **nothing** in this
repository except the lockfile and the audit documents themselves. It is a
design sandbox. It is currently the sole reason `pnpm build` fails at the
workspace root, and the audit's remedy for it (§1.1) would unpin Expo SDK 54.

- **Option A (my recommendation):** drop `mockup-sandbox` from the release
  build/typecheck gate. Cost: minutes. Risk: none to the shipped app. The
  sandbox keeps working for design exploration.
- **Option B:** unify the workspace on one React type version and re-verify the
  entire Expo build. Cost: a day, plus regression risk on SDK 54.

I recommend A. Paying option B's price to typecheck a sandbox that ships to no
user is the wrong trade this close to a release.

### 9.2 Are the frozen `.sql` files correct?

They were applied to the live database already. If any of them diverged from
what production actually has, the TypeORM conversion inherits the error. Confirm
they match the deployed schema, or authorize a schema diff against Supabase
before Codex converts them.

### 9.3 Lint debt: fix or formally defer?

77 admin lint errors currently block deployment while CI calls them
non-blocking. Fixing them is real work that competes with P0 security items.
Deferring them requires a dated owner. Your call which.

---

## 10. Integration and PR gate

1. Codex delivers a branch, evidence, and release notes for its items.
2. Claude reviews against the current branch, certifies migrations and contracts
   against the client, and integrates conflict-free passing work only.
3. Claude runs the combined gates: backend build/test/migration, admin build,
   mobile typecheck/export, and the production audits.
4. Claude presents to Sushant: PR title, description, changed files, verbatim
   validation evidence, unresolved external prerequisites, and known risk.
5. **Sushant explicitly approves before anything is pushed and before any remote
   pull request is opened.** No exceptions, no implied approval, no carrying a
   prior approval forward to the next push.

---

## 11. Neither agent, under any circumstances

- Pushes, merges to `main`, or opens a remote PR without explicit approval.
- Runs a migration against production, or any destructive DDL, without a live
  `count(*)` verification and approval.
- Invents an EAS identifier, signing credential, store ID, or secret value.
- Rewrites the other agent's git history, or force-pushes any shared branch.
- Edits a file outside its lane without a recorded handoff.
- Reports an item "done" without the evidence in §6.4.
