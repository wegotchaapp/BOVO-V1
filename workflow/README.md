# Bovogo delivery workflow

This directory is the operational source for taking Bovogo from the current
development build to a safe production release.

## Start here

1. **Both agents read [AGENT_OPERATING_AGREEMENT.md](AGENT_OPERATING_AGREEMENT.md)
   first.** It defines lane ownership, the shared-artifact protocol, the contract
   freeze, and the integration gate. It supersedes `CODEX_CLAUDE_WORKPLAN.md`.
2. **Then read [PRODUCTION_WORKFLOW.md](PRODUCTION_WORKFLOW.md)** — the single
   sequenced plan to launch, covering engineering, data, security, integrations,
   legal, store submission and operations. **Start at its Phase 0.** Its §1 status
   table was measured on 2026-08-31 and supersedes the older snapshot in
   `PRODUCTION_READINESS.md`.
3. [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) remains useful for the
   detailed 2026-08-30 audit narrative, but **its status table is partly stale** —
   the admin lint debt and the three admin route gaps have since closed.
4. Codex's live task queue is [CODEX_ACTIONS.md](CODEX_ACTIONS.md).
5. Do not ship until every P0 and P1 item is resolved and the validation gates
   in [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) pass.

## Coordination files

- [DECISIONS.md](DECISIONS.md) — resolved scope and sequencing disputes.
- [CONTRACTS.md](CONTRACTS.md) — API shape changes; binding on both agents.
- [FINDINGS.md](FINDINGS.md) — problems reported across lane boundaries.

## Scope

- `backend/` — NestJS API, PostgreSQL/Supabase database, queues, payments, and
  third-party webhooks.
- `mobile/artifacts/mobile/` — Expo iOS/Android app.
- `admin/` — React admin dashboard.

## Current release decision

**Not ready for production.** As of 2026-09-01 there is one canonical tree and
one branch: Codex's 15 commits are integrated, the two stranded product commits
are cherry-picked, backend tests are 99 across 10 suites, and **both production
dependency audits are zero** — backend was 1 critical and 10 high the day before.

Phase 0 is closed: the branch is pushed (`1965b15..eb80232`), the stray clone is
archived, and `mockup-sandbox` is decided.

What still blocks the release: a fresh production database has never once been
created — the baseline migration now ships, but has never been run — a live
database credential has been public since June, and the app charges an insurance
premium that no policy is ever issued against.

See [PRODUCTION_WORKFLOW.md](PRODUCTION_WORKFLOW.md) for the sequenced plan and
the measured status.
