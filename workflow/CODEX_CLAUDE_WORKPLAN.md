# Codex + Claude production-readiness work plan

## Working agreement

- Work in separate local branches/worktrees. Do not edit another agent's files
  without an explicit handoff.
- Keep commits small, focused, and independently verifiable.
- Do not push, merge, deploy, rotate secrets, run production migrations, or
  submit an EAS build without user approval.
- Codex prepares a local PR-ready diff and release notes. A remote pull request
  is created only after the user approves publishing the branch.

## Claude Code ownership

Claude should work in a separate local worktree on mobile-specific quality
work, avoiding the files assigned to Codex below.

1. Resolve the root `mobile` workspace React type conflict caused by
   `artifacts/mockup-sandbox`.
2. Add or repair mobile test/typecheck scripts and make the Expo application
   typecheck reproducibly.
3. Audit key customer flows in `mobile/artifacts/mobile`: authentication,
   search, booking, checkout, booking confirmation, ticket display, and SOS.
   Fix clear client-side defects and add focused tests where the project has
   test support.
4. Report every external-release prerequisite that cannot be safely invented:
   EAS identifiers, signing credentials, App Store Connect team, Google Play
   service account, and production environment values.

Claude should not change database migrations, backend API contracts, storage
security, webhook handling, or GitHub CI workflow files in this pass.

## Codex ownership

1. Convert required mobile schema scripts into executable TypeORM migrations
   and verify the migration runner discovers them.
2. Secure the background-check webhook with provider signature verification and
   replay protection.
3. Close the confirmed admin/backend route contract gaps with guarded routes
   and integration coverage.
4. Repair GitHub workflow paths for the current mobile workspace, align
   backend CI/deploy checks, and document release gates.
5. Address production storage URL handling, CORS allow-list configuration, and
   direct dependency vulnerability upgrades in separately reviewable commits.

## Claude kickoff prompt

Paste the following into Claude Code from its dedicated worktree:

```text
Work only on the mobile production-readiness scope in this repository.
Do not push, merge, deploy, modify secrets, change backend/, change .github/
workflows, or edit database migrations. First inspect git status and preserve
all existing user changes. Fix the root mobile workspace build/type conflict in
mobile/artifacts/mockup-sandbox, then add or repair repeatable mobile
typecheck/test checks. Audit the Expo customer flows—authentication, search,
booking, checkout, confirmation/ticket, and SOS—for clear client-side bugs;
make small focused fixes with tests where supported. Do not invent EAS or store
credentials: list missing release values instead. Commit only your own files
locally, provide the commit hash, changed-file list, commands run and results,
and a concise PR summary. Stop before pushing.
```

## Integration and PR gate

1. Claude supplies a local commit and validation evidence.
2. Codex reviews the commit against the current branch and integrates only
   conflict-free, passing work.
3. Codex runs the combined build, lint, typecheck, test, migration, and audit
   gates applicable to the changed areas.
4. Codex presents a PR title, description, changed-file summary, validation
   evidence, known external prerequisites, and the local commit(s).
5. The user explicitly approves before any branch is pushed and before a
   remote pull request is opened.
