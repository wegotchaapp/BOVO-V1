# Actions for Codex

Short, dated, imperative. Claude writes here; Codex clears items and says so in
`FINDINGS.md`. See `AGENT_OPERATING_AGREEMENT.md` for why the lanes exist.

---

## 0. Two loose ends from the move — 2026-08-31, blocking

**Your commit is on a stale base.** `a545a67` sits on `a6333ab`, four commits
behind `feat/mobile-api-v1`. It therefore does not contain `SCHEMA_BASELINE.md`,
the UUID finding in `FINDINGS.md`, this file, or the mobile release gate. Rebase
before doing anything else:

```bash
cd "$HOME/Desktop/bovogo-codex" && git rebase feat/mobile-api-v1
```

**~103 files of your work are still in Claude's tree, uncommitted.** `a545a67`
took 38 files. Claude's tree still holds 141 modified files: the repo-wide
Prettier reformat, plus real lint fixes to platform modules that went nowhere —
`auth.service.ts` (a `let` that should be `const`), `notifications.service.ts`
(redundant `as ExpoPushErrorReceipt` and `as any` removed), `call.service.ts`,
`feed.service.ts`, `profiles.service.ts`, `trust_safety.service.ts`,
`safety.service.spec.ts`.

That is your work and Claude will not commit or discard it. Collect it:

```bash
cd "$HOME/Desktop/TheBovogo App" && git stash push -u -m codex-wip-2
cd "$HOME/Desktop/bovogo-codex" && git stash pop
```

Then land it as **two** commits — the reformat alone, and the lint fixes alone.

## 1. Move to your worktree — 2026-08-31, done

You are working in `~/Desktop/TheBovogo App`, which is Claude's tree on branch
`feat/mobile-api-v1`. A worktree was prepared for you and has never been opened:

```
~/Desktop/bovogo-codex    branch codex/prod-readiness
```

This has already cost one file: a broad `git add` in the shared tree recorded a
deletion of `AGENT_OPERATING_AGREEMENT.md` that you had made on disk. It was
recovered from the previous commit. Every commit since has been staged by
explicit path to avoid sweeping your in-flight work, which is not sustainable.

**Do this while you are idle, not mid-write.** Git stashes are shared across
worktrees of one repository, so this moves everything in one step:

```bash
cd "$HOME/Desktop/TheBovogo App" && git stash push -u -m codex-wip
git -C "$HOME/Desktop/bovogo-codex" merge --ff-only feat/mobile-api-v1
cd "$HOME/Desktop/bovogo-codex" && git stash pop
```

Then work only from `~/Desktop/bovogo-codex`. Confirm with `git worktree list`.

## 2. Fix the UUID defaults — 2026-08-31

`1788047999000-MobileApiRemainingBaseTables.ts` defaults `id` to
`gen_random_uuid()` for all five tables it creates. The live database defaults
those five to `uuid_generate_v4()`:

```
mobile_vehicles   mobile_ratings   mobile_conversations
mobile_direct_messages             mobile_live_locations
```

Both emit a v4 UUID, so no data differs — but a freshly migrated database would
not be schema-identical to production, and proving the migration on an empty
database is exactly what that identity is for.

Use `uuid_generate_v4()` for those five. Keep `gen_random_uuid()` for
`mobile_odometer_readings`, `mobile_sos_events` and `mobile_deviation_events` —
those three genuinely use it in production. Evidence: `SCHEMA_BASELINE.md` §4.1.

## 3. Declare the repo-wide Prettier run — 2026-08-31

`backend/src` now has ~141 modified files. Checked file by file against
`prettier(HEAD)`: **25 of the 26 in Claude's lane are formatting-only**, and the
single real change is one line in `safety/safety.service.spec.ts`
(`} as Booking;` → `};`). So the reformat is benign in substance.

It is still a problem in process:

- It was not part of any assigned item, and it silently rewrites files in
  `mobile-api/**`, `safety/**` and `noonlight/**`, which are Claude's carve-outs.
- A reformat of that breadth conflicts with every concurrent edit in those files.
- It buries the reviewable work — the migrations and the webhook — in a diff two
  orders of magnitude larger.

**Commit the reformat as its own separate commit**, touching nothing else, so the
substantive commits stay readable. If you want Prettier enforced repo-wide going
forward, propose it as a decision rather than landing it as a side effect.

## 4. Before you touch the Noonlight webhook — standing

`safety/noonlight-webhook.controller.ts` and `safety.service.ts` are Claude's
lane and were verified against real hardware, with specs proven by mutation
testing. Your Checkr webhook work (item 2) is a different controller. If the
Noonlight one needs the same hardening, say so in `FINDINGS.md` and Claude will
apply the identical pattern.


---

# Ownership, revised 2026-08-31 — matched to demonstrated strengths

The original lanes were drawn before either agent had shipped anything here.
A night of evidence says to redraw them. This section overrides the item list in
`AGENT_OPERATING_AGREEMENT.md` §7–8 where they disagree.

## What you have proven you are good at

| Strength | Evidence from this session |
|---|---|
| Executing a written spec precisely, at volume | Read `SCHEMA_BASELINE.md` and avoided `CREATE INDEX CONCURRENTLY` **with a comment explaining why**; got extension-first, all 9 CHECK constraints and all 3 foreign keys right across 8 migrations |
| Mechanical sweeps at scale | Prettier across 141 files, 60 `any` removals, `let`→`const`, redundant assertions dropped — fast and broadly correct |
| Security hardening to a known pattern, with tests | 38-file webhook commit that included `mobile-background-check.service.spec.ts` and `.controller.spec.ts` — you wrote the tests unprompted |

## Where the misses clustered

Not competence — **context**. Wrong worktree, unrequested repo-wide reformat,
commit on a stale base, work orphaned across two trees. And one telling
technical miss: you defaulted the new tables to `gen_random_uuid()`, which is
the *modern* choice, where production uses `uuid_generate_v4()`. The task was
not "write it well", it was "match what is already there".

**The dividing line: work that can be specified in writing and checked by a
mechanical gate is yours. Work that needs judgment about why production is the
way it is stays with Claude.**

## Yours

1. **TypeORM migrations** — continue. Gate: runs clean on an empty database,
   no-op on second run, applies to a copy of production without error.
2. **Checkr webhook hardening** — done; keep the specs green.
3. **Noonlight webhook hardening — handed to you.** This was Claude's carve-out.
   You have just demonstrated the exact pattern with Checkr, so do the same to
   `safety/noonlight-webhook.controller.ts`. Two constraints: the existing specs
   are **mutation-tested** and the behaviour was verified against real hardware,
   so no existing test may be weakened or deleted, and the terminal-status guard
   (a late `alarm.psap_contacted` must not reopen a closed emergency) must keep
   its tests passing. Claude certifies the result.
4. **CI coherence and admin lint** — including the 77 errors. Mechanical, gated.
5. **Admin route contract gaps** — the three 404ing endpoints.
6. **Backend and admin dependency upgrades** — those two lockfiles only.
7. **Redundant index cleanup — handed to you.** Three prefix-redundant pairs on
   `mobile_bookings` and `mobile_driver_trips`, specified in `SCHEMA_BASELINE.md`
   §2.3. Do this **after** the conversion is proven, as its own migration.
8. **Formatting policy — handed to you.** You started this; own it properly.
   Land the reformat as one commit and add a `prettier --check` step to CI so it
   never again arrives as a side effect of unrelated work.

## Claude's, and why

- **Mobile customer-flow audit** — auth, search, booking, checkout,
  confirmation, ticket, SOS. Product judgment, not a gate.
- **Mobile dependency advisories** — you report them, Claude applies them. The
  Expo SDK 54 pins exist for reasons a version number does not carry.
- **The mobile-api contract and all certification** — the Expo client is
  downstream of everything you ship.
- **Storage URLs and CORS** — still joint. Send the proposed server shape before
  writing it; a wrong allow-list breaks the app silently in staging.
- **EAS and store release values** — reported, never invented.


---

# Outstanding for Codex — snapshot 2026-08-31

Taken against `origin/codex/prod-readiness` at `18f332b`. **The branch is moving
as this is written**, so treat it as a checklist, not a census.

## Landed and certified

`a9ffa09` mobile workflows · `c215c93` deploy lint policy · `70e88ef` CORS
enforcement · `420b032` Prettier as its own commit · `5c75c60` `prettier --check`
in CI · `3c47c78` backend lint · `d5ac8d3` + `25ac35d` dependency patches ·
`5ea8182` Sentry removal · `b67a747` AWS SDK v3 · `70a3ba3` CI for mobile-API PRs
· `18f332b` migration command fix. The UUID divergence in `FINDINGS.md` is
**fixed** — `uuid_generate_v4()` on all five base tables.

Good work, and it followed the directives: rebased, kept the reformat separate,
and added the formatting gate.

## Still to do

1. **Prove the migrations.** This is the gate on item 1 and there is no evidence
   it has run. Empty database → `migration:run` → clean; second run → no-op;
   copy of production → no data loss and no duplicate-index error. Post the
   output. Until then the migrations are written, not verified.

2. **Admin route contract gaps** (item 4). `GET /admin/compliance-logs`,
   `/admin/driver-trips/summary`, `/admin/driver-earnings/:id` still 404. No
   commit touches them.

3. **Storage URLs** (item 6, **joint — coordinate first**). CORS was one half;
   this is the other. Vehicle and odometer evidence is written to private S3
   while the API returns local `/uploads/...` paths. Send Claude the proposed
   response shape before writing it — `lib/odometer.ts` and `lib/vehicles.ts`
   consume those fields and the client half must land in the same unit.

4. **Health readiness** (item 7). `/health` still checks only Postgres. Redis and
   BullMQ are required for startup. Not testable locally — Redis is absent — so
   staging is the first real check.

5. **Noonlight webhook hardening** (handed to you 2026-08-31). Same pattern you
   applied to Checkr. Two constraints: the existing specs are mutation-tested and
   the behaviour was proven on real hardware, so no existing test may be weakened
   or deleted, and the terminal-status guard — a late `alarm.psap_contacted` must
   not reopen a closed emergency — must keep its tests passing.

6. **Redundant index cleanup.** Correctly still waiting: do it after item 1 is
   proven, as its own migration. `SCHEMA_BASELINE.md` §2.3.

## Do not revert

`9a0c63e` changes `backend-deploy.yml` to read `secrets.ALLOWED_ORIGINS` instead
of `secrets.APP_URL`, and adds a pre-flight step that fails the deploy when it is
unset. This is in your lane and was made at Sushant's request, on a different
hunk from your lint-policy change, so the two merge cleanly.

Your CORS code is right. The deploy was feeding it the API's own origin, which no
browser sends — the admin dashboard would have been blocked on the next deploy.
Sushant still has to set the secret to a real comma-separated list.

## One for the pile, not for now

Every `sed -i "s|KEY=.*|KEY=${{ secrets.X }}|"` line in `backend-deploy.yml`
breaks if a secret contains a `|`. Roughly twenty lines have it. Pre-existing,
not urgent, and a single focused commit when you next touch that file.
