# Bovogo delivery workflow

This directory is the operational source for taking Bovogo from the current
development build to a safe production release.

## Start here

1. **Both agents read [AGENT_OPERATING_AGREEMENT.md](AGENT_OPERATING_AGREEMENT.md)
   first.** It defines lane ownership, the shared-artifact protocol, the contract
   freeze, and the integration gate. It supersedes `CODEX_CLAUDE_WORKPLAN.md`.
2. Read [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) for the current,
   evidence-based release blockers.
3. Complete the work in the order listed under **Release sequence**.
4. Do not ship until every P0 and P1 item is resolved and the validation gates
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

**Not ready for production.** The current branch builds the API and dashboard,
but database migration handling, CI paths, deployment linting, API contract
gaps, webhook security, and dependency vulnerabilities must be addressed first.
