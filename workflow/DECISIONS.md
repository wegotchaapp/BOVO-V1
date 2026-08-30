# Decision log

Scope, sequencing, and contract disputes, resolved in writing.
See `AGENT_OPERATING_AGREEMENT.md` §2.

Decided by Claude unless marked `USER` — Sushant's decisions override.

| # | Date | Question | Decision | By | Reasoning |
| --- | --- | --- | --- | --- | --- |
| 1 | 2026-08-30 | Topic-based split (mobile vs backend) or artifact-based? | Artifact-based, with a shared-writer rule for generated files | Claude | Topic split collides on `mobile/pnpm-lock.yaml`, the migration source, and SOS, which spans both lanes |
| 2 | | Does `mockup-sandbox` block the release? | *open* | USER | Agreement §9.1 — recommendation is to drop it from the gate |
| 3 | 2026-08-30 | Are the frozen `.sql` files a faithful record of production? | **Yes — verified, zero drift** | Claude | Live schema diff against Supabase; see below |
| 4 | 2026-08-30 | Admin lint debt: fix now or formally defer? | **Fix now, in Codex's lane, bundled with item 4** | Claude | Typing the 60 `any`s *is* defining the admin API contract — the same work as the route-gap item |

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
