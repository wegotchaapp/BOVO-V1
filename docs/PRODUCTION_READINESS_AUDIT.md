# Production Readiness Audit: BOVO-V1

**Repository:** `wegotchaapp/BOVO-V1` | **Branch audited:** `main` @ `04a3e24` | **Audit date:** 2026-10-06

Scope: the code on `main`. Work sitting in open PRs (#3, #5, #6) is noted where relevant but not credited, because it is not what would ship today.

---

## 1. Executive Summary

BOVO-V1 is a monorepo for Bovogo, a Texas carpooling platform: a NestJS/TypeORM backend, a React/Vite admin console, and an Expo mobile app. The backend shows sound structural instincts, including a multi-stage non-root Dockerfile, Helmet, global validation, a health endpoint and versioned migrations. Execution falls well short of production grade. A live database password is committed in plain text, uploaded identity and vehicle documents are committed and served publicly, and payment and SMS webhooks fail open. Two spec files cover roughly 190 backend source files, with no tests at all for the mobile or admin apps. Lint reports 842 errors and has been made non-blocking. Mobile CI targets a directory that does not exist, so it fails every run. `main` has not moved since August 18, while hardening work waits in unmerged stacked PRs. The project is not ready for high-traffic or mission-critical use.

---

## 2. Readiness Scorecard

| Category | Status | Notes |
| --- | --- | --- |
| Code Quality: Linting | 🔴 Fail | ESLint/Prettier configured, but `main` has 842 lint errors (mostly `no-unsafe-*`). PR #2 set `continue-on-error: true` in `backend-ci.yml`, so lint gates nothing. 217 `any` usages in backend `src`. The lint script runs `--fix`, which mutates code in CI instead of checking it. |
| Code Quality: Test Coverage | 🔴 Fail | Backend: 2 spec files (`safety.service.spec.ts`, `refund-calculator.spec.ts`) against 192 source files. No tests for auth, payments, bookings or the mobile API. `test:e2e` points to `test/jest-e2e.json`, which does not exist. Admin, mobile app and `mobile/artifacts/api-server`: zero tests. |
| Code Quality: Modularity | 🟡 Partial | Backend is cleanly split into ~30 Nest modules. But services are large (`chat.service.ts` 1,050 lines), there are two parallel auth systems (JWT+refresh and 30-day opaque mobile tokens), and the mobile workspace ships a second Express API (`mobile/artifacts/api-server`) duplicating the NestJS `mobile-api` contract. Ad-hoc DB scripts (`fix_db_temp.js`, `scripts/add-*.js`) run DDL outside the migration system. |
| Documentation | 🟡 Partial | Root README has a clear quick start and architecture sketch; `backend/README.md`, `Deployment.md`, `docs/APP_STORE_SUBMISSION.md` exist. Swagger is wired at `/docs` (disabled in production). Gaps: no runbook, no ADRs, no incident/on-call docs; `.github/SECRETS.md` still references the old "WeGotcha" naming; `mobile/attached_assets/` holds about a dozen pasted AI prompts plus screenshots rather than docs. |
| Security: Secrets | 🔴 Fail | `backend/fix_db_temp.js` contains a hardcoded Supabase Postgres connection string with password. It is in git history and must be treated as compromised. README publishes default admin credentials from the seed script. |
| Security: Data Protection | 🔴 Fail | `backend/uploads/` (driver profile photos, vehicle insurance and registration images) is committed despite `.gitignore`. `main.ts` serves `/uploads` via `express.static` with no auth, so any stored document is publicly readable by URL. Local-disk storage is also non-durable on container platforms. |
| Security: API Hardening | 🔴 Fail | Stripe Connect and Checkr webhooks skip signature checks when the secret is unset (fail-open), and Stripe verification hashes `JSON.stringify(body)` rather than the raw body, so it will reject genuine events once enabled. Twilio webhooks are unsigned, letting anyone opt a phone number out of emergency SMS. `ThrottlerModule` is configured but no `ThrottlerGuard` is registered, so rate limiting is off. CORS uses `origin: true` with `credentials: true`. DB TLS uses `rejectUnauthorized: false`. `POST /chat/calls/initiate` has no auth guard. Positives: Helmet, `ValidationPipe` with whitelist, bcrypt (12 rounds), non-root container. |
| DevOps: CI/CD | 🔴 Fail | `mobile-ci.yml` and `mobile-preview.yml` use `working-directory: ./wegotcha`, which does not exist; Mobile CI has failed on every run. No admin CI on `main`. `backend-deploy.yml` runs lint as a blocking step, so with 842 errors every push to `main` fails before deploy. Migrations run against production before the deploy with no rollback step. `mobile-preview.yml` writes the Supabase URL into the anon-key variable. |
| DevOps: Containers & Config | 🟡 Partial | Backend has a good multi-stage Dockerfile with `HEALTHCHECK` and `.dockerignore`. No Dockerfile for admin. No IaC, no Helm/K8s manifests, no docker-compose for Postgres/Redis. Config is `.env`-only via `sed` injection in CI; no startup validation of required env vars (`JWT_SECRET` aside). Sentry is a dependency but never initialised in `main.ts`. |
| Maintenance: Commit Activity | 🟡 Partial | 15 commits on `main` from 2026-06-23 to 2026-08-18; nothing merged to `main` in 7 weeks. Active work exists on branches (PR #6 updated 2026-09-24), but it is stacked three deep (#6 → #5 → #3 → `main`) and PR #3 has been open since 2026-08-18. |
| Maintenance: Issue Resolution | 🔴 Fail | Zero GitHub issues, open or closed. There is no visible bug tracking, triage or SLA, so resolution speed cannot be measured. Planning lives in commit messages and markdown ledgers instead. |

---

## 3. Critical Gaps

1. **Leaked production database credential.** `backend/fix_db_temp.js` embeds a Supabase Postgres URL with its password. Rotate the password now, delete the file, purge it from history (e.g. `git filter-repo`), and enable GitHub secret scanning and push protection. Until rotated, assume the database is exposed.

2. **Identity documents are public and committed.** `backend/uploads/` is in git, and `/uploads` is served without authentication. Remove the files from the repo and history, move storage to a private S3 bucket with short-lived signed URLs, and review whether this counts as a reportable PII exposure.

3. **Fail-open webhooks and missing rate limiting on a payments and safety platform.** Make Stripe, Checkr and Twilio webhook handlers reject requests when secrets are missing, verify Stripe signatures against the raw body via `stripe.webhooks.constructEvent`, validate Twilio signatures, register `ThrottlerGuard` globally, and restrict CORS to an allowlist from `ALLOWED_ORIGINS`.

4. **CI/CD gives false confidence.** Mobile CI cannot pass, lint is advisory, the deploy pipeline is blocked by the same lint it ignores in CI, and test coverage is close to zero. Fix the mobile workflow paths, burn down the lint backlog and make it blocking, and add integration tests for auth, booking, payment and SOS paths before any traffic.

5. **Delivery is stuck off `main`.** The hardening in PR #4 was merged into a feature branch, not `main`, and three stacked PRs remain open. Agree on a merge plan, land the stack with review, and adopt an issue tracker so defects and their resolution time are visible.

---

## 4. Final Recommendation

**Decision: NO-GO**

The codebase is not fit for a high-traffic, mission-critical deployment in its current state on `main`. Gaps 1 and 2 are active security incidents, not backlog items, and need remediation before any further investment discussion. The architecture is reasonable and salvageable. A realistic path is a focused 4 to 8 week hardening phase: credential rotation and history cleanup, private document storage, webhook and rate-limit fixes, working CI with blocking lint and meaningful test coverage on money and safety flows, and a merged, reviewed `main`. Re-audit after that phase before a Go decision.
