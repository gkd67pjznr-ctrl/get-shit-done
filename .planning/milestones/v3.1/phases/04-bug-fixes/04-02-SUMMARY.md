---
phase: 04-bug-fixes
plan: 02
subsystem: testing
tags: [migrate, config, debt, initialization, stale-files]

# Dependency graph
requires: []
provides:
  - DEBT.md auto-created during project init (config-ensure-section)
  - DEBT.md auto-created during migrate --apply for legacy projects
  - Stale TO-DOS.md removed by migrate --apply
  - ensureDebtFile() helper in config.cjs
  - remove_stale change type in migrate.cjs applyBasic handler
affects: [debt, migrate, config, init]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ensureDebtFile(planningDir) helper — idempotent file creation, called from all exit paths of cmdConfigEnsureSection"
    - "remove_stale change type in inspectLayout/applyBasic — used for TO-DOS.md cleanup pattern extensible to other stale files"

key-files:
  created:
    - tests/debt-init.test.cjs
  modified:
    - get-shit-done/bin/lib/config.cjs
    - get-shit-done/bin/lib/migrate.cjs
    - tests/migrate.test.cjs

key-decisions:
  - "ensureDebtFile() is non-fatal (try/catch) — DEBT.md absence should not block project init"
  - "DEBT.md is always project-level (.planning/DEBT.md), not milestone-scoped — matches debt.cjs design"
  - "remove_stale is a new change type (not manual_action) so migrate --apply can handle it automatically"
  - "Existing migrate.test.cjs fixtures updated to include DEBT.md as fully-configured project requirement"

patterns-established:
  - "Pattern 1: inspectLayout() is the canonical place for .planning/ health checks — add new required-file checks here"
  - "Pattern 2: remove_stale change type — extensible for future stale file cleanup in the basic scaffold path"

requirements-completed: [FIX-03, FIX-04, FIX-05]

# Metrics
duration: 4min
completed: 2026-02-27
---

# Phase 04 Plan 02: DEBT.md Initialization and TO-DOS.md Stale Cleanup Summary

**DEBT.md auto-created on project init and migration, stale TO-DOS.md removed automatically via new remove_stale change type in migrate.cjs**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-27T10:56:23Z
- **Completed:** 2026-02-27T10:59:43Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- FIX-03: `ensureDebtFile()` helper added to `config.cjs`, called from all three exit paths of `cmdConfigEnsureSection` (new, exists, migrated) — DEBT.md is always present after init
- FIX-04: `inspectLayout()` in `migrate.cjs` now flags missing DEBT.md as a `create_file` change; `applyBasic` creates it during `migrate --apply`
- FIX-05: `inspectLayout()` flags stale `.planning/TO-DOS.md` as `remove_stale`; new `remove_stale` handler in `applyBasic` removes it during `migrate --apply`
- 7 new tests in `tests/debt-init.test.cjs` covering all three fixes with idempotency checks

## Task Commits

Each task was committed atomically:

1. **Task 1: Add DEBT.md creation to config-ensure-section and migrate --apply** - `7af4c07` (fix)
2. **Task 2: Add tests for DEBT.md initialization and TO-DOS.md cleanup** - `9cb6410` (test)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `get-shit-done/bin/lib/config.cjs` - Added `ensureDebtFile()` helper + 3 call sites in `cmdConfigEnsureSection`
- `get-shit-done/bin/lib/migrate.cjs` - Added DEBT.md check (FIX-04) and TO-DOS.md stale detection (FIX-05) in `inspectLayout()`; added `remove_stale` handler in `applyBasic()`
- `tests/debt-init.test.cjs` - New test file: 7 tests across 3 describe groups (FIX-03, FIX-04, FIX-05)
- `tests/migrate.test.cjs` - Updated 3 fully-configured project fixtures to include DEBT.md

## Decisions Made
- `ensureDebtFile()` uses a try/catch and is non-fatal — DEBT.md creation failure should not block project init
- DEBT.md header in `config.cjs` and `migrate.cjs` matches the exact template from `debt.cjs` lines 79-87 for consistency
- `remove_stale` is a first-class change type (not `manual_action`) so it can be handled automatically by `applyBasic` without user intervention

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 3 migrate.test.cjs fixtures that expected 0 changes without DEBT.md**
- **Found during:** Task 2 (writing and running tests)
- **Issue:** Tests for "fully-configured project" set up projects with config.json + ROADMAP.md + STATE.md + PROJECT.md but no DEBT.md, then asserted 0 changes. After FIX-04 was implemented, inspectLayout() correctly reports DEBT.md as missing, breaking those assertions.
- **Fix:** Added `fs.writeFileSync(path.join(planningDir, 'DEBT.md'), ...)` to the 3 affected test fixtures in `migrate.test.cjs` (tests at lines 66, 83, 95).
- **Files modified:** tests/migrate.test.cjs
- **Verification:** `node --test tests/*.test.cjs` shows 307 pass, 0 fail
- **Committed in:** 9cb6410 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** Auto-fix necessary for test correctness — existing tests had stale fixtures that didn't account for DEBT.md as a required file. No scope creep.

## Quality Gates

**Quality Level:** standard

| Task | Gate | Outcome | Detail |
|------|------|---------|--------|
| 1 | codebase_scan | passed | Verified existing change type patterns (create_file, create_dir, manual_action); reused DEBT.md header from debt.cjs |
| 1 | context7_lookup | skipped | N/A — no external library dependencies (fs, path only) |
| 1 | test_baseline | passed | 298 tests passing before changes |
| 1 | test_gate | passed | Tests written in Task 2; functional smoke test run inline |
| 1 | diff_review | passed | Clean diff — no TODO/FIXME, no logic duplicates, error paths handled |
| 2 | codebase_scan | passed | Verified test patterns from helpers.cjs and routing.test.cjs |
| 2 | context7_lookup | skipped | N/A — node:test, node:assert/strict only |
| 2 | test_baseline | passed | 298 tests passing (same baseline) |
| 2 | test_gate | passed | 7 new tests pass; full suite 307 pass 0 fail |
| 2 | diff_review | passed | Identified pre-existing test fixture issue; auto-fixed inline |

**Summary:** 10 gates ran, 8 passed, 0 warned, 2 skipped, 0 blocked

## Issues Encountered
None — implementation was straightforward; the only surprise was the 3 existing test fixtures that needed DEBT.md added (auto-fixed as Rule 1 bug).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FIX-03, FIX-04, FIX-05 complete — DEBT.md is now reliably present after init or migration
- Phase 4 is now complete (all 3 plans executed); ready for Phase 5: Housekeeping

## Self-Check: PASSED

All files found:
- FOUND: get-shit-done/bin/lib/config.cjs
- FOUND: get-shit-done/bin/lib/migrate.cjs
- FOUND: tests/debt-init.test.cjs
- FOUND: tests/migrate.test.cjs
- FOUND: .planning/milestones/v3.1/phases/04-bug-fixes/04-02-SUMMARY.md

All commits found:
- FOUND: 7af4c07 (Task 1 — fix config.cjs and migrate.cjs)
- FOUND: 9cb6410 (Task 2 — add debt-init.test.cjs, fix migrate.test.cjs fixtures)

---
*Phase: 04-bug-fixes*
*Completed: 2026-02-27*
