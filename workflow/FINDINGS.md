# Cross-lane findings

Where an agent reports a problem it must **not** fix itself, because the file
belongs to the other lane. See `AGENT_OPERATING_AGREEMENT.md` §5.

Append only. The owner marks a row `applied` or `declined` (with a reason) —
the reporter does not edit rows after filing them.

| Date | From | Artifact | Finding | Suggested action | Status |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

## Filing a mobile dependency advisory (Codex → Claude)

Include the advisory ID, the direct package, the minimum safe version, and
whether the fix is a direct bump or a transitive override. Do not run any
install under `mobile/` — the lockfile carries the Expo SDK 54 pins.
