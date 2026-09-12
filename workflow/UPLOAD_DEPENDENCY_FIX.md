# Upload dependency audit fix

After publishing PR #5, Backend CI failed npm audit --omit=dev --audit-level=high
on Multer 2.2.0 and its Nest dependency chain. Codex pinned the transitive Multer
dependency to 2.3.0 through an npm override. Only that package changed in the
backend lockfile; no Nest major downgrade or audit-rule relaxation was used.

Maintainer advisory: https://github.com/expressjs/multer/security/advisories/GHSA-wc9g-mqfw-jrwm
The four reported Multer advisories identify 2.3.0 as the patched release.

Validation: production audit exit 0 (zero vulnerabilities), backend build exit 0,
173 tests in 16 suites pass with normal exit. Evidence is in the sibling
2026-09-12-upload-audit directory. Full npm audit including development dependencies
still reports 18 findings (1 low, 11 moderate, 5 high, 1 critical); these are not
cleared by this narrowly scoped patch. Existing backend lint debt also remains.
