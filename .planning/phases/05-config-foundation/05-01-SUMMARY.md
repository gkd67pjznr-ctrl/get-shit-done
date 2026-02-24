---
phase: 05-config-foundation
plan: 01
subsystem: config
tags: [config, quality, migration, defaults, warnings, tdd]

# Dependency graph
requires: []
provides:
  - "Auto-migration of quality block into existing configs missing it"
  - "Global defaults bootstrap: creates ~/.gsd/defaults.json (or $GSD_HOME) on first GSD usage"
  - "New projects inherit quality.level from existing global defaults"
  - "cmdConfigGet emits stderr warning when quality section absent"
  - "loadConfig emits stderr warning when quality section absent"
  - "runGsdToolsFull test helper for reliable stderr capture via spawnSync"
affects: [quality-sentinel, executor, all-phases-using-config]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD (RED → GREEN): write failing tests first, then implement"
    - "GSD_HOME env var overrides ~/.gsd for testable global state"
    - "spawnSync for test helpers that need unconditional stderr capture"
    - "Non-fatal bootstrap: errors writing defaults.json are silently skipped"

key-files:
  created:
    - ".planning/phases/05-config-foundation/05-01-SUMMARY.md"
  modified:
    - "get-shit-done/bin/lib/config.cjs"
    - "get-shit-done/bin/lib/core.cjs"
    - "tests/init.test.cjs"
    - "tests/helpers.cjs"

key-decisions:
  - "Used spawnSync instead of execSync in runGsdToolsFull so stderr is captured on exit code 0 (execSync only exposes stderr via err.stderr on failure)"
  - "Added missing-section warning to cmdConfigGet in addition to loadConfig — config-get is the tested command path; loadConfig is not called by config-get"
  - "GSD_HOME env var pattern: allows tests to override global defaults location without touching real ~/.gsd"
  - "context7_token_cap: 2000 included in requiredQualityDefaults and preserved on migration"
  - "bootstrapGlobalDefaults is non-fatal: silently skips if directory/file creation fails (e.g., read-only filesystems)"

patterns-established:
  - "requiredQualityDefaults object: single source of truth for quality defaults in config.cjs"
  - "Migration pattern: load existing config, check for missing keys, add defaults, write back, return {migrated: true, reason}"
  - "Warning pattern: process.stderr.write for missing required sections — never crashes, never silent"

requirements-completed: [QCFG-02, QCFG-03, QOBS-03]

# Metrics
duration: 3min
completed: 2026-02-23
---

# Phase 5 Plan 1: Config Foundation Summary

**Config auto-migration adds quality block to pre-v1.1 projects, bootstraps ~/.gsd/defaults.json on first use, and emits actionable stderr warnings when required sections are absent**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-24T05:31:24Z
- **Completed:** 2026-02-24T05:34:XX Z
- **Tasks:** 2 (TDD: 1 RED + 1 GREEN)
- **Files modified:** 4

## Accomplishments
- `cmdConfigEnsureSection` now auto-migrates existing configs that lack the quality block, preserving existing keys
- Global defaults bootstrap: `~/.gsd/defaults.json` (or `$GSD_HOME/defaults.json`) created on first GSD usage with `quality.level: fast`
- New projects inherit `quality.level` from existing global defaults when present
- `cmdConfigGet` and `loadConfig` emit stderr warning: `Warning: config.json missing required section "quality" — run config-ensure-section to fix`
- `runGsdToolsFull` test helper added using `spawnSync` for reliable stdout + stderr capture
- 8 new test cases added; full test suite: 129 tests, 0 failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing tests (RED phase)** - `4f845d1` (test)
2. **Task 2: Implement features (GREEN phase)** - `d786c64` (feat)

**Plan metadata:** TBD (docs: complete plan)

_Note: TDD tasks have two commits: test (RED) then feat (GREEN)_

## Files Created/Modified
- `get-shit-done/bin/lib/config.cjs` - cmdConfigEnsureSection: auto-migration, global defaults bootstrap, context7_token_cap default, GSD_HOME support; cmdConfigGet: missing-section warning
- `get-shit-done/bin/lib/core.cjs` - loadConfig: missing-section warning after JSON parse
- `tests/init.test.cjs` - 3 new describe blocks with 8 tests covering QCFG-02, QCFG-03, QOBS-03
- `tests/helpers.cjs` - runGsdToolsFull using spawnSync; exported alongside existing helpers

## Decisions Made
- Used `spawnSync` instead of `execSync` for `runGsdToolsFull` because `execSync` only exposes stderr via `err.stderr` on non-zero exit; `spawnSync` always captures both streams
- Added warning to `cmdConfigGet` in addition to `loadConfig` since `config-get` reads config directly without going through `loadConfig`
- `GSD_HOME` env var pattern for testability: tests pass a temp directory so real `~/.gsd` is never touched

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] runGsdToolsFull used execSync which does not capture stderr on success**
- **Found during:** Task 2 (implementing GREEN phase)
- **Issue:** Plan specified using `execSync` with `stdio: ['pipe', 'pipe', 'pipe']` and `env` — but `execSync` does not return stderr for processes that exit with code 0. The `loadConfig warns on stderr` test was failing because `result.stderr` was always `''` on success.
- **Fix:** Replaced `execSync` with `spawnSync` in `runGsdToolsFull`. `spawnSync` unconditionally captures stdout and stderr in `result.stdout` / `result.stderr`.
- **Files modified:** `tests/helpers.cjs`
- **Verification:** All 8 new tests pass; `result.stderr` correctly contains the warning text
- **Committed in:** `d786c64` (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added missing-section warning to cmdConfigGet**
- **Found during:** Task 2 (running tests after implementation)
- **Issue:** Plan said warning comes from `loadConfig` but `config-get` calls `cmdConfigGet` directly, which does not invoke `loadConfig`. Test was using `config-get` as the command.
- **Fix:** Added the same `requiredSections` warning loop to `cmdConfigGet` in `config.cjs`
- **Files modified:** `get-shit-done/bin/lib/config.cjs`
- **Verification:** `loadConfig warns on stderr` test passes
- **Committed in:** `d786c64` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes were necessary for correct behavior. No scope creep.

## Issues Encountered
None beyond the two deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Config foundation complete: auto-migration, global defaults, and missing-section warnings are all in place
- Phase 5 Plan 2 can now build on reliable config infrastructure
- The `GSD_HOME` env var pattern is available for any future tests that need to override global state

## Self-Check: PASSED

All files found, all commits verified:
- FOUND: get-shit-done/bin/lib/config.cjs
- FOUND: get-shit-done/bin/lib/core.cjs
- FOUND: tests/init.test.cjs
- FOUND: tests/helpers.cjs
- FOUND: .planning/phases/05-config-foundation/05-01-SUMMARY.md
- FOUND commit: 4f845d1 (test RED phase)
- FOUND commit: d786c64 (feat GREEN phase)

---
*Phase: 05-config-foundation*
*Completed: 2026-02-23*
