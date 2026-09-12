# App review completion — 12 September 2026

The nine requested changes are implemented locally on `claude/app-review-fixes`.
Claude implemented the mobile flows and mobile API; Codex implemented private
identity storage, its migration and admin review, supervised the combined diff,
and ran the verification. Codex source work used the agreed sibling worktree.
Claude reviewed and approved the Codex branch through `75ad9c0`; it was integrated
locally without overwriting Claude edits. No push, deployment or production
migration was performed.

| Request | Result |
| --- | --- |
| 1. Move identity and account actions | Signup no longer includes government ID/selfie. Optional manual ID review is under Settings. Logout/delete moved from Profile to Settings. The required profile photo remains per the recorded user decision. |
| 2. Location suggestions | Shared searchable city/area picker, optional Mapbox suggestions and selection retrieval, stale-request cancellation, supported-corridor checks. |
| 3. Vehicles | My Vehicles list, Add vehicle, multiple submissions, approved vehicles read-only, selection for posting. Settings and Voyager link to the list. |
| 4. Delete account authorization | Expired sessions offer Sign in; null-user requests cannot falsely report successful deletion. Existing grace-period behavior remains. |
| 5. Public replies | Reply controls removed; API refuses new replies and returns none. Existing confirmed-booking messaging stays available. |
| 6. Active posts | Departed posts excluded from upcoming feeds; shared active/in-progress rules; strict current-time and correct selected-day boundaries. |
| 7. Keyboard | Post form uses keyboard-aware scrolling, including Android edge-to-edge support. |
| 8. Profile shortcut | Post Adventure shortcut removed from Profile. |
| 9. SOS options | Record silently and Safe word removed from the requested SOS screen. |

## Verification

- Mobile `pnpm run release:check`: exit 0, workspace type checks, 39 tests in
  4 suites, production exports for iOS/Android/web. A final mobile typecheck after
  the last screen edits also exited 0.
- Backend build: exit 0. Final plain Jest run: 173 tests in 16 suites, exit 0,
  without forceExit. The two five-minute safety timers now have test cleanup and
  an explicit timed-escalation assertion.
- Admin lint/build: exit 0.
- Private-media/logger focused tests: 16 pass, including production storage
  configuration. Production requires S3; set PRIVATE_MEDIA_DRIVER=s3 explicitly.
- Prior migration and admin proof: 9 PostgreSQL/Nest HTTP groups, JWT/role checks,
  safe metadata, private file audit, decision races/rollback and RLS restrictions.
- Added real PostgreSQL upload proof: concurrent submissions produce one row;
  storage deletion failure preserves retry records; upload racing account deletion
  leaves no row/bytes; an ambiguous write failure compensates its attempted key.
  Only synthetic data in the disposable localhost:55441 database was used.
- `git diff --check`: clean. New test lint findings were corrected without
  weakening assertions or changing lint rules.

The full backend lint gate remains red with 1001 problems (822 errors and
179 warnings). This existing backlog is separate from the nine requested UI
fixes; baseline and final outputs are preserved in the evidence directory.
This report does not certify production readiness or supersede the unresolved
security/payment findings in the supplied photos.

## Limits and next task

Physical iOS/Android keyboard and animation behavior still needs device QA.
The new identity migration and private bucket must be configured in a separately
authorized deployment before the ID feature is available on the live server.
Failed-upload compensation is best-effort: cleanup failures log a user/count
for manual private-prefix reconciliation; no durable cleanup job exists yet.
The Messages unread badge still needs a dedicated DM/group unread endpoint.

Checkout printer files are untouched. Codex is ready for the user's sample and
will rebuild that UI separately as requested.

Evidence: `workflow/evidence/2026-09-12-app-review/`; detailed Claude reviews and
handoffs: `workflow/FINDINGS.md` and `workflow/IDENTITY_REVIEW_HANDOFF_2026-09-12.md`.
