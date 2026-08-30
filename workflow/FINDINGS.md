# Cross-lane findings

Where an agent reports a problem it must **not** fix itself, because the file
belongs to the other lane. See `AGENT_OPERATING_AGREEMENT.md` §5.

Append only. The owner marks a row `applied` or `declined` (with a reason) —
the reporter does not edit rows after filing them.

| Date | From | Artifact | Finding | Suggested action | Status |
| --- | --- | --- | --- | --- | --- |
| 2026-08-30 | Claude | `1788047999000-MobileApiRemainingBaseTables.ts` | The five tables it creates default `id` to `gen_random_uuid()`, but the live database defaults all five to `uuid_generate_v4()`: `mobile_vehicles`, `mobile_ratings`, `mobile_conversations`, `mobile_direct_messages`, `mobile_live_locations`. Both emit a v4 UUID, so no data differs — but a freshly migrated database would not be schema-identical to production, which defeats the point of proving the migration on an empty database. | Use `uuid_generate_v4()` for these five to match live. The three newest tables (`mobile_odometer_readings`, `mobile_sos_events`, `mobile_deviation_events`) correctly stay on `gen_random_uuid()`. Evidence: `SCHEMA_BASELINE.md` §4.1. | open |

Confirmed good in the same pass, so it does not get re-flagged: `CREATE EXTENSION`
is first, all 9 CHECK constraints are present, the 3 foreign keys are on the right
two tables, and `CREATE INDEX CONCURRENTLY` is correctly avoided with a comment
saying why.

## Filing a mobile dependency advisory (Codex → Claude)

Include the advisory ID, the direct package, the minimum safe version, and
whether the fix is a direct bump or a transitive override. Do not run any
install under `mobile/` — the lockfile carries the Expo SDK 54 pins.
