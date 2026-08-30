# Decision log

Scope, sequencing, and contract disputes, resolved in writing.
See `AGENT_OPERATING_AGREEMENT.md` §2.

Decided by Claude unless marked `USER` — Sushant's decisions override.

| # | Date | Question | Decision | By | Reasoning |
| --- | --- | --- | --- | --- | --- |
| 1 | 2026-08-30 | Topic-based split (mobile vs backend) or artifact-based? | Artifact-based, with a shared-writer rule for generated files | Claude | Topic split collides on `mobile/pnpm-lock.yaml`, the migration source, and SOS, which spans both lanes |
| 2 | | Does `mockup-sandbox` block the release? | *open* | USER | Agreement §9.1 — recommendation is to drop it from the gate |
| 3 | | Are the frozen `.sql` files a faithful record of production? | *open* | USER | Agreement §9.2 |
| 4 | | Admin lint debt: fix now or formally defer? | *open* | USER | Agreement §9.3 |
