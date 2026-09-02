# Cross-lane findings

Where an agent reports a problem it must **not** fix itself, because the file
belongs to the other lane. See `AGENT_OPERATING_AGREEMENT.md` §5.

Append only. The owner marks a row `applied` or `declined` (with a reason) —
the reporter does not edit rows after filing them.

| Date | From | Artifact | Finding | Suggested action | Status |
| --- | --- | --- | --- | --- | --- |
| 2026-08-30 | Claude | `1788047999000-MobileApiRemainingBaseTables.ts` | The five tables it creates default `id` to `gen_random_uuid()`, but the live database defaults all five to `uuid_generate_v4()`: `mobile_vehicles`, `mobile_ratings`, `mobile_conversations`, `mobile_direct_messages`, `mobile_live_locations`. Both emit a v4 UUID, so no data differs — but a freshly migrated database would not be schema-identical to production, which defeats the point of proving the migration on an empty database. | Use `uuid_generate_v4()` for these five to match live. The three newest tables (`mobile_odometer_readings`, `mobile_sos_events`, `mobile_deviation_events`) correctly stay on `gen_random_uuid()`. Evidence: `SCHEMA_BASELINE.md` §4.1. | applied — verified after rebase on 2026-08-31 |
| 2026-08-31 | Claude | `.github/workflows/backend-deploy.yml:45` + `70e88ef` | The deploy workflow sets `ALLOWED_ORIGINS=${{ secrets.APP_URL }}` — a single value, the API's own URL. Until now nothing read it: `main.ts` used `origin: true`, so production allowed every origin. `70e88ef` correctly starts enforcing the allowlist, which turns a dormant misconfiguration into a live one. The admin dashboard is served from its own domain and calls the API through `VITE_API_URL`, so its origin is **not** `APP_URL` and it will be blocked by CORS in production the moment this deploys. `.env.example` has always shown a comma-separated list with a second domain, so the single-value wiring was wrong from the initial commit — not from this change. | Set `ALLOWED_ORIGINS` to a real list: the admin dashboard's origin, plus the Expo **web** origin if that build is hosted. Native Expo clients are unaffected — they send no `Origin` header and `createCorsOptions` passes them through, which is the right call. Then add a staging check that the admin dashboard can actually reach the API before this reaches production. | open |
| 2026-09-01 | Claude | `backend/src/database/data-source.ts:1,83` + `backend/.env` | The data source does `import 'dotenv/config'` and takes `url: process.env.DATABASE_URL`, and `backend/.env` holds the **live Supabase production** URL. So a bare `npm run migration:run` in `backend/`, on any developer's machine, runs migrations **against production** — no flag, no prompt, no staging step. This is the single most likely way the exposed credential turns into an incident, and it is about to be exercised: P1-1 asks for repeated `migration:run` invocations. | Export `DATABASE_URL` explicitly for every migration run — `dotenv` does not overwrite an already-set variable, so the export wins. Longer term, make the data source refuse a non-local host unless something like `I_MEAN_IT=1` is set, so the safe path is the default rather than the disciplined one. Recorded in the P1-1 task in `CODEX_ACTIONS.md`. | open |
| 2026-09-02 | Claude | `backend/scripts/write-deploy-env.cjs` (`049ffac`) | The script is a real improvement and fixes the `|` hazard it was written for — but its stated guarantee overreaches. `JSON.stringify` is used to encode each value, and the comment claims it "safely represents delimiter, quote, backslash, and newline characters". **dotenv does not honour `\"` or `\\` escapes inside double-quoted values** — it only expands `\n` and `\r`. Exercised, not read: a secret containing `"` is written as `has\"quote` and parses back as `has\"quote` (spurious backslash); one containing `\` is written as `has\\backslash` and parses back as `has\\backslash` (doubled). Pipes, commas, plain values and embedded newlines all round-trip correctly. A mangled `DATABASE_URL` or `JWT_SECRET` is an outage or total auth failure, found at deploy time. | Either encode with a scheme dotenv actually decodes, or single-quote the value and reject any secret containing a single quote with a clear error — failing loudly at deploy beats writing a silently wrong `.env`. Reproduction: set `DATABASE_URL='has"quote'`, run the script over a copy of `.env.example`, then `require('dotenv').parse()` the result and compare. | open |

Certified good in `70e88ef` itself, so it does not get re-flagged: native clients
pass through without an `Origin`, production fails fast when no list is
configured, and `credentials: true` is correctly paired with an explicit
allowlist rather than a wildcard. The code is right; the deployment value is not.

Certified good in `a9ffa09`: the mobile workflows call `pnpm run release:check`
from `./mobile` against the real lockfile path, which matches the scripts as they
now stand. It runs `typecheck` and then `release:check`, which runs typecheck
again — harmless, one wasted minute per run.

Confirmed good in the same pass, so it does not get re-flagged: `CREATE EXTENSION`
is first, all 9 CHECK constraints are present, the 3 foreign keys are on the right
two tables, and `CREATE INDEX CONCURRENTLY` is correctly avoided with a comment
saying why.

## Filing a mobile dependency advisory (Codex → Claude)

Include the advisory ID, the direct package, the minimum safe version, and
whether the fix is a direct bump or a transitive override. Do not run any
install under `mobile/` — the lockfile carries the Expo SDK 54 pins.
