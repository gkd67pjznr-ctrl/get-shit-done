---
phase: 07-delete-legacy-files
plan: 01
subsystem: testing
tags: [migrate, legacy-strip, cli-router, test-cleanup]

# Dependency graph
requires: []
provides:
  - "migrate.cjs deleted — legacy-to-milestone converter removed"
  - "migrate CLI command removed from gsd-tools.cjs router"
  - "migrate test suites removed (compat.test.cjs, migrate.test.cjs, debt-init migrate groups)"
affects: [08-simplify-core, 09-simplify-state]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - get-shit-done/bin/gsd-tools.cjs
    - tests/debt-init.test.cjs

key-decisions:
  - "Deleted migrate.cjs entirely — milestone-scoped layout is now the only supported layout"
  - "Removed migrate test groups from debt-init.test.cjs (FIX-04, FIX-05) since they tested migrate CLI command"
  - "Test count dropped 349 -> 309 (40 tests deleted: 23 migrate + 12 compat + 5 debt-init migrate groups)"

patterns-established: []

requirements-completed: [STRIP-01]

# Metrics
duration: 3min
completed: 2026-03-03
---

# Phase 7 Plan 01: Delete Legacy Files Summary

**Deleted migrate.cjs (~600 lines), two test files, and migrate CLI case block from gsd-tools.cjs router — all 309 remaining tests pass**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-03T15:21:16Z
- **Completed:** 2026-03-03T15:24:00Z
- **Tasks:** 3
- **Files modified:** 4 (3 deleted, 1 edited in Task 2, 1 edited in Task 3 fix)

## Accomplishments
- Deleted get-shit-done/bin/lib/migrate.cjs (legacy-to-milestone converter, ~600 lines)
- Deleted tests/migrate.test.cjs (23 tests) and tests/compat.test.cjs (12 tests)
- Removed migrate require import and case block from gsd-tools.cjs CLI router
- Updated help text: Milestone category no longer lists `migrate`
- All 309 remaining tests pass with 0 failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete legacy files** - `5b08937` (chore)
2. **Task 2: Remove migrate command from CLI router** - `7b8d63a` (feat)
3. **Task 3: Run full test suite regression (+ fix debt-init migrate tests)** - `bc33e0f` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `get-shit-done/bin/lib/migrate.cjs` - DELETED (legacy-to-milestone converter)
- `tests/migrate.test.cjs` - DELETED (23 migration tests)
- `tests/compat.test.cjs` - DELETED (12 backward compatibility tests)
- `get-shit-done/bin/gsd-tools.cjs` - Removed migrate require, case block, and help text entry
- `tests/debt-init.test.cjs` - Removed FIX-04 and FIX-05 describe groups (5 migrate-dependent tests)

## Decisions Made
- Deleted migrate.cjs entirely — migration tooling is no longer needed since milestone-scoped layout is the only supported layout
- Removed migrate CLI command entry point — `gsd migrate` now produces "Unknown command: migrate" error
- Removed test groups from debt-init.test.cjs that tested migrate CLI behavior (FIX-04: DEBT.md creation via migrate, FIX-05: TO-DOS.md removal via migrate) — these are now dead tests referencing a deleted command

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Removed migrate-dependent test groups from debt-init.test.cjs**
- **Found during:** Task 3 (full test suite regression)
- **Issue:** After deleting migrate.cjs and removing the migrate CLI command, 5 tests in debt-init.test.cjs still called `migrate --dry-run` and `migrate --apply`, producing "Unknown command: migrate" failures
- **Fix:** Removed FIX-04 describe group (3 tests) and FIX-05 describe group (2 tests) from debt-init.test.cjs; updated file header comment to reflect only FIX-03 remains
- **Files modified:** tests/debt-init.test.cjs
- **Verification:** Test suite re-ran with 309 tests, 0 failures
- **Committed in:** bc33e0f (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical: dead tests referencing deleted command)
**Impact on plan:** Auto-fix necessary for test suite correctness. No scope creep. Plan estimated ~314 tests remaining; actual count is 309 (5 more migrate-dependent tests existed in debt-init.test.cjs that the plan's estimate didn't account for).

## Quality Gates

**Quality Level:** standard

| Task | Gate | Outcome | Detail |
|------|------|---------|--------|
| 1 | codebase_scan | skipped | deletion task — no code to reuse |
| 1 | context7_lookup | skipped | N/A — no external library deps |
| 1 | test_baseline | passed | 349 tests passing |
| 1 | test_gate | skipped | no new exported logic (deletion task) |
| 1 | diff_review | passed | clean diff — 3 file deletions only |
| 2 | codebase_scan | skipped | deletion/edit task — no new code |
| 2 | context7_lookup | skipped | N/A — no external library deps |
| 2 | test_gate | skipped | no new exported logic (edit only) |
| 2 | diff_review | passed | clean diff — require removed, case block removed, help text updated |
| 3 | test_gate | skipped | no new exported logic |
| 3 | diff_review | warned | 1 finding auto-fixed (dead migrate tests in debt-init.test.cjs) |

**Summary:** 7 gates ran/evaluated, 2 passed, 1 warned, 7 skipped, 0 blocked

## Issues Encountered
- None beyond the auto-fixed deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 7 Plan 01 complete — legacy migration subsystem fully removed
- Ready for Phase 8: Simplify Core (remove legacy layout detection, legacy path helpers, etc.)
- No blockers

---
*Phase: 07-delete-legacy-files*
*Completed: 2026-03-03*
