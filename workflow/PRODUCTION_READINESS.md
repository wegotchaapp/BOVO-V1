# Production-readiness audit

Audited: 2026-08-30

## Executive result

The application is not ready for a production release yet. The backend and
admin production builds succeed, and 88 backend unit tests pass, but the
release process has several hard blockers. The mobile workspace release check
also fails before a build can be produced.

## Confirmed blockers

| Priority | Area | Finding | Required resolution |
| --- | --- | --- | --- |
| P0 | Database | New mobile schema work is stored under `backend/migrations-applied/`, but the TypeORM runner only executes `backend/src/database/migrations/*`. `npm run migration:run` will not create the new vehicle, odometer, SOS, deviation, or luggage columns/tables on a fresh production database. | Convert every required change into reviewed TypeORM migrations, test from an empty database and an upgrade copy, then remove the manual-production-script assumption. |
| P0 | CI/mobile | `.github/workflows/mobile-ci.yml` and `mobile-preview.yml` target `wegotcha/**` and use `./wegotcha`, but the current app is in `mobile/artifacts/mobile` and uses pnpm. The mobile checks and preview builds therefore do not run for real mobile changes. | Rewrite the paths, working directory, cache keys, install command, and Expo/EAS commands for the current workspace. Make typecheck and an export/build required checks. |
| P0 | CI/backend deploy | `backend-deploy.yml` blocks deployment on `npm run lint`; `backend-ci.yml` labels the same lint backlog non-blocking. This makes main-branch deploys fail until the existing lint debt is cleared. | Either fix the lint debt and keep it blocking, or use an explicitly scoped non-blocking transition with a dated owner. Do not leave CI and deployment gates inconsistent. |
| P0 | Security | `POST /api/background-check/webhook` accepts unauthenticated payloads and changes a user's background-check status without validating a Checkr signature. | Capture the raw request body, validate the provider signature using a configured webhook secret, reject missing/invalid signatures, and add replay/idempotency tests. |
| P0 | Dependencies | The backend audit reports 37 production dependency vulnerabilities: 1 critical and 10 high. Direct affected dependencies include Axios, `@nestjs/platform-express`, TypeORM, Socket.IO, AWS SDK v2, Sentry, and Swagger. The mobile audit reports 2 critical and 24 high findings; the admin audit reports 3 high findings. | Upgrade direct packages and regenerate lockfiles. Re-run production-only audits and record zero critical/high findings or a time-limited, accepted exception for each remaining advisory. |
| P1 | Admin/API contract | Admin pages call `GET /admin/compliance-logs`, `GET /admin/driver-trips/summary`, and `GET /admin/driver-earnings/:id`; no matching backend routes exist. The pages will return 404 in production. | Add guarded admin routes with tests, or change the dashboard to the implemented routes and response shapes. |
| P1 | File storage | Vehicle and odometer uploads are written to private S3 objects while APIs persist API-local `/uploads/...` URLs. Those URLs only work for local disk storage; deployed S3 uploads will not be served by Express. | Use a private authenticated download endpoint or short-lived signed URLs; test on the real object store. |
| P1 | Mobile workspace | `pnpm build` fails in `mobile/artifacts/mockup-sandbox` because two incompatible React type definitions are resolved in `calendar.tsx` and `spinner.tsx`. | Deduplicate/pin React and `@types/react` across the workspace, then make the full workspace build pass. |
| P1 | Mobile release | `eas.json` still contains placeholder App Store Connect and Google Play identifiers. | Configure the EAS project, app-store IDs/team, Android service account, signing credentials, and a production submission dry run. |

## API and functional gaps

### Admin dashboard routes with no backend implementation

| Admin request | Current backend route | Result |
| --- | --- | --- |
| `GET /admin/compliance-logs` | `GET /compliance/logs` exists, but no `/admin/compliance-logs` route exists | Dashboard page fails with 404. |
| `GET /admin/driver-trips/summary` | `GET /driver-trips` and driver-scoped earnings routes exist, but no admin summary route exists | Dashboard page fails with 404. |
| `GET /admin/driver-earnings/:driverId` | No matching route | Dashboard detail page fails with 404. |

### Functions that need production completion

| Function | Current state | Required completion |
| --- | --- | --- |
| Checkr webhook handling | Status updates are accepted without signature verification. | Verify raw-body signatures and persist provider event IDs for replay protection. |
| File retrieval for vehicle/odometer evidence | Upload succeeds but returned URL assumes local disk even when storage is S3. | Implement authorization-aware retrieval with signed URLs or a protected proxy. |
| Migration execution | Schema scripts are manually parked outside TypeORM migrations. | Make `npm run migration:run` the only supported production migration path. |
| Health readiness | `/health` only checks PostgreSQL, despite Redis/BullMQ being required for backend startup/features. | Add Redis/queue readiness and use it for deployment health checks. |
| End-to-end coverage | Backend unit tests pass, but no end-to-end suite is called by CI; mobile has no discovered tests. | Add a seeded API flow: registration, vehicle approval, trip, payment, booking, messaging, SOS, and cleanup. |

## Build and test evidence

| Check | Result |
| --- | --- |
| `backend: npm run build` | Passed |
| `backend: npm test -- --runInBand` | 5 suites / 88 tests passed; Jest reported an open-handle warning after completion. |
| `admin: npm run build` | Passed |
| `admin: npm run lint` | Failed: 77 errors and 10 warnings. |
| `mobile: pnpm build` | Failed in `artifacts/mockup-sandbox` due to conflicting React ref types. |
| `mobile/artifacts/mobile: pnpm exec tsc -p tsconfig.json --noEmit` | Passed |
| Backend production dependency audit | Failed: 1 critical, 10 high, 25 moderate, 1 low. |
| Admin production dependency audit | Failed: 3 high, 1 moderate. |
| Mobile production dependency audit | Failed: 2 critical, 24 high, 16 moderate, 4 low. |

## Configuration and deployment gaps

- The deployment workflow prepares only a subset of backend environment values;
  Stripe webhook secrets, Checkr, Noonlight, Mapbox, Supabase, and storage
  bucket configuration need a definitive production ownership decision.
- Production CORS currently permits every origin in `main.ts`. Replace this
  with an allow-list derived from configured app/admin origins before launch.
- The current repository has no admin-dashboard deployment workflow.
- Production runbooks should name the owner, rotation process, and verification
  procedure for each secret—not only its value source.

## Release sequence

1. Fix P0 migration, CI, security, and dependency items.
2. Close the three admin API contract gaps and add integration tests.
3. Fix workspace type resolution and make all build/lint/test gates green.
4. Configure and validate staging: database migrations, Redis, Stripe test
   webhooks, Checkr sandbox, Noonlight sandbox, file storage, and maps.
5. Run the full checklist in [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).
6. Produce an internal mobile build, complete a staged smoke test, then release
   backend/admin and submit the signed mobile build.
