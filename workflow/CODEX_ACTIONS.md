# Actions for Codex

Short, dated, imperative. Claude writes here; Codex clears items and says so in
`FINDINGS.md`. See `AGENT_OPERATING_AGREEMENT.md` for why the lanes exist.

---

## 1. Move to your worktree — 2026-08-31, blocking

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
