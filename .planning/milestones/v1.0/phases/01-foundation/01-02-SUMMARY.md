---
phase: 01-foundation
plan: "02"
subsystem: config
tags: [config, quality, gsd-tools, testing]

# Dependency graph
requires: []
provides:
  - quality.level config key with 'fast' default in config template
  - quality.test_exemptions array with 4 default entries in config template
  - hardcoded defaults for quality in cmdConfigEnsureSection
  - deep-merge logic for quality key (mirrors workflow pattern)
  - 4 tests proving quality config section is created and readable
affects:
  - 02-quality-gates
  - any phase that reads quality.level to conditionally run gates

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "config-get quality.level returns JSON-encoded string — use JSON.parse() in test assertions for string comparisons"
    - "quality.level='fast' convention: Phase 2 gates read this at entry and skip when value is 'fast'"
    - "Deep-merge pattern for nested config keys mirrors workflow merge in cmdConfigEnsureSection"

key-files:
  created:
    - tests/init.test.cjs (new describe block added at bottom)
  modified:
    - get-shit-done/templates/config.json
    - get-shit-done/bin/lib/config.cjs

key-decisions:
  - "quality.level defaults to 'fast' (not 'standard') — ensures zero behavioral change from vanilla GSD when Phase 2 gates are introduced (CFG-02)"
  - "Test assertions use JSON.parse(result.output) for string comparisons because config-get outputs JSON-encoded values without --raw flag"
  - "Deep-merge mirrors workflow pattern so user ~/.gsd/defaults.json can override individual quality subkeys"

patterns-established:
  - "CFG-04 convention: Phase 2 quality gates read quality.level via: QUALITY_LEVEL=$(node gsd-tools.cjs config-get quality.level 2>/dev/null || echo 'fast')"
  - "config-get string output: always use JSON.parse() when comparing string values returned by config-get in tests"

requirements-completed: [CFG-01, CFG-02, CFG-03, CFG-04]

# Metrics
duration: 2min
completed: 2026-02-23
---

# Phase 1 Plan 02: Config Quality Key Foundation Summary

**quality.level='fast' and quality.test_exemptions added to config template and hardcoded defaults, with 4 passing tests proving propagation via config-ensure-section and config-get**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T17:34:07Z
- **Completed:** 2026-02-23T17:36:08Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added `quality` key to `get-shit-done/templates/config.json` as last top-level key after `safety`
- Added `quality` key to hardcoded defaults in `cmdConfigEnsureSection` with deep-merge logic matching workflow pattern
- Added 4 tests to `tests/init.test.cjs` proving config-ensure-section creates quality block, config-get reads it, and config-set persists changes
- All 102 tests pass (96 pre-existing + 4 new + 2 others)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add quality key to config template and hardcoded defaults** - `cc0928d` (feat)
2. **Task 2: Add config quality section tests to init.test.cjs** - `9c45832` (feat)

## Files Created/Modified
- `get-shit-done/templates/config.json` - Added quality.level='fast' and quality.test_exemptions array as last top-level key
- `get-shit-done/bin/lib/config.cjs` - Added quality to hardcoded defaults and deep-merge logic in cmdConfigEnsureSection
- `tests/init.test.cjs` - Added describe('config quality section') block with 4 tests

## Decisions Made
- quality.level defaults to 'fast' per CFG-02 (zero behavioral change from vanilla GSD)
- Test assertions use `JSON.parse(result.output)` for string values because `config-get` outputs JSON-encoded strings (not raw) when `--raw` is not passed
- Deep-merge pattern matches existing workflow merge to support user-level overrides via `~/.gsd/defaults.json`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test assertions using raw string comparison for JSON-encoded output**
- **Found during:** Task 2 (config quality tests)
- **Issue:** The plan's test code used `assert.strictEqual(result.output, 'fast', ...)` but `config-get` without `--raw` outputs JSON-encoded `"fast"` (with surrounding quotes). Two of 4 tests failed.
- **Fix:** Changed string value assertions to use `JSON.parse(result.output)` for comparison, consistent with how the array test (test 3) already worked
- **Files modified:** tests/init.test.cjs
- **Verification:** All 4 new tests pass; full suite 102/102 pass
- **Committed in:** 9c45832 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required for test correctness. The fix matches existing behavior (config-get always outputs JSON without --raw). No scope creep.

## Issues Encountered
- config-get outputs JSON-encoded strings by default — test assertions must use JSON.parse() for string comparisons. This is the existing behavior of the output() helper in core.cjs; the plan's sample test code didn't account for it.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- quality.level='fast' is now readable via `config-get quality.level` on any GSD project
- Phase 2 quality gates can implement the CFG-04 pattern: read quality.level at entry, skip gates when value is 'fast'
- No blockers for Phase 1 Plan 01 or Phase 2

---
*Phase: 01-foundation*
*Completed: 2026-02-23*

## Self-Check: PASSED

- FOUND: get-shit-done/templates/config.json
- FOUND: get-shit-done/bin/lib/config.cjs
- FOUND: tests/init.test.cjs
- FOUND: .planning/phases/01-foundation/01-02-SUMMARY.md
- FOUND commit cc0928d: feat(01-02): add quality key to config template and hardcoded defaults
- FOUND commit 9c45832: feat(01-02): add config quality section tests to init.test.cjs
