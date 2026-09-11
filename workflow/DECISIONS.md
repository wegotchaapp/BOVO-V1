# Decision log

Scope, sequencing, and contract disputes, resolved in writing.
See `AGENT_OPERATING_AGREEMENT.md` §2.

Decided by Claude unless marked `USER` — Sushant's decisions override.

| # | Date | Question | Decision | By | Reasoning |
| --- | --- | --- | --- | --- | --- |
| 1 | 2026-08-30 | Topic-based split (mobile vs backend) or artifact-based? | Artifact-based, with a shared-writer rule for generated files | Claude | Topic split collides on `mobile/pnpm-lock.yaml`, the migration source, and SOS, which spans both lanes |
| 2 | 2026-09-01 | Does `mockup-sandbox` block the release? | **No — dropped from the release gate** | USER | It ships to nobody, is referenced by nothing but the lockfile, and the alternative fix unpins Expo SDK 54. See below |
| 3 | 2026-08-30 | Are the frozen `.sql` files a faithful record of production? | **Yes — verified, zero drift** | Claude | Live schema diff against Supabase; see below |
| 4 | 2026-08-30 | Admin lint debt: fix now or formally defer? | **Fix now, in Codex's lane, bundled with item 4** | Claude | Typing the 60 `any`s *is* defining the admin API contract — the same work as the route-gap item |
| 5 | 2026-09-11 | Stay on the Expo SDK 54 pin, or keep the SDK 57 upgrade? | **Keep SDK 57** — committed as `c693184` | USER | Supersedes the SDK 54 pin in `AGENT_OPERATING_AGREEMENT.md` §1.1. Typecheck and tests were green on the upgraded tree |
| 6 | 2026-09-11 | How is a government ID checked? | **A person reviews it in the admin dashboard. Optional for users for now** | USER | Works without a vendor. Stripe Identity would need live Stripe keys (placeholders today) and costs per check |
| 7 | 2026-09-11 | Which sign-up photo step comes out? | **Only the ID + selfie screen after registering. Onboarding keeps its required profile photo** | USER | ID and selfie upload moves to Settings |
| 8 | 2026-09-11 | One vehicle per Voyager, or several? | **Several. Approved vehicles are read-only; the Voyager picks one when posting** | USER | The review found no way to add a second car and an Edit on an approved one |
| 9 | 2026-09-11 | Can a Sailor message a Voyager? | **Only after booking. Public replies on posts are removed** | USER | Replies had already been asked to be removed; the post-booking group chat stays for pickup |

## Decision 3 — schema verification, 2026-08-30

Read-only diff of `backend/migrations-applied/*.sql` against the live Supabase
schema. **Every object matches. No drift, in either direction.**

| Checked | Expected | Found |
| --- | --- | --- |
| Columns (`mobile_bookings` 11, `mobile_vehicles` 14, `mobile_users` 5, `mobile_trips` 2, plus 3 whole tables) | all | all present, types/defaults/nullability match |
| CHECK constraints | 9 | 9, definitions identical |
| Foreign keys | 3 | 3 |
| Indexes | 21 | 21, including every partial and `DESC`/`NULLS LAST` clause |

The frozen `.sql` set is therefore a trustworthy conversion source. Confirmed
in passing: `mobile_users` holds no full-SSN column — only `ssn_last4` and
`ssn_verified`, as the vehicle migration's comment claims.

## Decision 4 — admin lint, 2026-08-30

Measured, not estimated: 77 errors are **60 `@typescript-eslint/no-explicit-any`**
plus **17 `react-hooks/set-state-in-effect`** ("calling setState synchronously
within an effect can trigger cascading renders"), and 10 `exhaustive-deps`
warnings. None are auto-fixable.

The 17 hook errors are one copy-pasted data-loading idiom repeated across ~14
pages in `admin/src/pages/`, so they are one fix applied fourteen times, not
fourteen investigations. Lint stays **blocking** in both `backend-ci.yml` and
`backend-deploy.yml`.

Codex escalates to Sushant only if a `set-state-in-effect` fix turns out to
change behaviour — a cascading render in a load effect can mean a real double
fetch, and that is a bug report, not a lint fix.


## Decision 2 — `mockup-sandbox`, 2026-09-01

Sushant's call, answering the question `AGENT_OPERATING_AGREEMENT.md` §9.1 left
open on 2026-08-30. **`mockup-sandbox` is out of the release gate.**

Its failure is two files — `src/components/ui/calendar.tsx:132` and
`src/components/ui/spinner.tsx:7`, both `TS2322` from two `@types/react` trees
resolving in one pnpm workspace. The clean fix is at the workspace level and
would mean unpinning Expo SDK 54, which is a real risk taken on behalf of a
sandbox that ships to no user.

**The gate already implements this**, which is worth recording so nobody
"fixes" it twice: `mobile/package.json` filters `!@workspace/mockup-sandbox` out
of `typecheck`, `build` and `test`, and keeps a separate opt-in
`typecheck:sandbox` for anyone working in there. Verified 2026-09-01 —
`pnpm run typecheck` scopes to 4 of 10 projects and all four pass:

```
artifacts/api-server  artifacts/mobile  artifacts/support-admin  scripts   Done
```

So the decision closes an open question rather than changing any code. It stays
excluded until someone has a reason to work in the sandbox, at which point the
two type errors are theirs to deal with, not the release's.

## Correction to Decision 4 — lint is no longer blocking, 2026-09-01

Decision 4 ends "Lint stays **blocking** in both `backend-ci.yml` and
`backend-deploy.yml`." That is no longer true of the repository, and a ledger
that contradicts the workflows is worse than one that admits the change.

Both workflows now run backend lint with `continue-on-error: true`, each with a
comment saying why: `main` produces 842 errors, overwhelmingly
`@typescript-eslint/no-unsafe-*` in the weather, trust_safety and payments
modules, so the step failed on every PR regardless of its contents. A check that
is always red trains people to ignore CI, which costs the next real failure.

The current count on `feat/mobile-api-v1` is **821**, after Codex's targeted
fixes in `3c47c78`. TypeScript, formatting, tests, build and migrations are all
still blocking. Restoring lint to blocking is the right end state and needs the
backlog cleared first — it is not currently anybody's assigned item.
