---
phase: 08-path-architecture-foundation
plan: 01
subsystem: core
tags: [path-resolution, layout-detection, config, bug-fix, tdd]

requires: []
provides:
  - "planningRoot(cwd, milestoneScope) pure function in core.cjs — single source of truth for .planning/ base path"
  - "detectLayoutStyle(cwd) pure function in core.cjs — reads config.json, returns legacy/milestone-scoped/uninitialized"
  - "is_last_phase bug fix in phase.cjs — ROADMAP.md fallback ensures incomplete unplanned phases are detected"
affects:
  - "09-milestone-workspace-initialization"
  - "10-compatibility-layer"
  - "11-concurrent-dashboard"
  - "12-command-routing"
  - "13-e2e-validation"

tech-stack:
  added: []
  patterns:
    - "planningRoot(cwd, milestoneScope) — truthiness check on milestoneScope, returns .planning/ or .planning/milestones/<v>/"
    - "detectLayoutStyle — try/catch + readFileSync + JSON.parse, checking config.json concurrent:true sentinel only"
    - "is_last_phase ROADMAP fallback — after disk scan, regex /[-*]\\s*\\[([x ])\\]\\s*\\*{0,2}Phase\\s+(\\d+...):/gi on ROADMAP.md"

key-files:
  created:
    - tests/core.test.cjs
  modified:
    - get-shit-done/bin/lib/core.cjs
    - get-shit-done/bin/lib/phase.cjs
    - tests/phase.test.cjs

key-decisions:
  - "planningRoot uses truthiness check (if milestoneScope) so null/undefined/empty-string all return legacy path"
  - "detectLayoutStyle reads only config.json — never checks directory presence (locked design from STATE.md)"
  - "is_last_phase ROADMAP fallback checks [x] completion status to avoid false negatives when higher phases are already done"
  - "Updated outdated test ('is_last_phase uses filesystem not ROADMAP') to assert correct post-fix behavior (Rule 1 auto-fix)"

patterns-established:
  - "planningRoot(cwd, milestoneScope): single resolver for all .planning/ paths — callers must not build paths manually"
  - "detectLayoutStyle(cwd): returns 'legacy' | 'milestone-scoped' | 'uninitialized' — only config.json, never directory presence"

requirements-completed: [PATH-01, PATH-02, PATH-04]

duration: 4min
completed: 2026-02-24
---

# Phase 8 Plan 01: Path Architecture Foundation Summary

**planningRoot and detectLayoutStyle pure functions added to core.cjs, plus is_last_phase ROADMAP fallback bug fix in phase.cjs, all TDD-verified with 11 new core tests and 4 new phase regression tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-24T11:49:36Z
- **Completed:** 2026-02-24T11:53:10Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Implemented `planningRoot(cwd, milestoneScope)` — the single path resolver for all v2.0 milestone-scoped paths
- Implemented `detectLayoutStyle(cwd)` — reads config.json `concurrent: true` sentinel, never directory presence
- Fixed `is_last_phase` bug in `cmdPhaseComplete`: adds ROADMAP.md fallback after disk scan to detect unplanned future phases
- 11 tests for core functions, 4 regression tests for is_last_phase (all passing)

## Task Commits

Each task was committed atomically:

1. **Task 1: TDD planningRoot and detectLayoutStyle in core.cjs** - `132372d` (feat)
2. **Task 2: TDD is_last_phase bug fix in phase.cjs** - `d22cda8` (fix)

_Note: TDD tasks executed RED then GREEN within each commit._

## Files Created/Modified
- `get-shit-done/bin/lib/core.cjs` - Added planningRoot and detectLayoutStyle functions, exported both
- `tests/core.test.cjs` - New test file: 11 tests covering planningRoot (6) and detectLayoutStyle (5)
- `get-shit-done/bin/lib/phase.cjs` - ROADMAP.md fallback added after disk scan in cmdPhaseComplete
- `tests/phase.test.cjs` - 4 new regression tests + 1 existing test updated to match fixed behavior

## Decisions Made
- `planningRoot` uses `if (milestoneScope)` truthiness so `null`, `undefined`, and no-arg all return the legacy `.planning/` path
- `detectLayoutStyle` must ONLY read `config.json` — directory presence detection is forbidden per locked STATE.md decision
- ROADMAP fallback regex uses checkbox format `[-*] [x ] **Phase N:` — checks completion status before setting `isLastPhase=false`
- Updated the pre-existing `is_last_phase uses filesystem not ROADMAP` test: its assertion (`true`) was documenting the bug, not correct behavior

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated outdated test that documented the old (buggy) behavior**
- **Found during:** Task 2 (is_last_phase bug fix)
- **Issue:** Pre-existing test `'is_last_phase uses filesystem not ROADMAP (3 phases in ROADMAP, 1 on disk = last phase)'` asserted `is_last_phase: true` with comments marking this as "correct behavior" — but this was actually the bug behavior. After the fix, this test failed because the fixed code correctly returns `false`.
- **Fix:** Updated test name and assertion to reflect correct post-fix behavior (is_last_phase=false when ROADMAP has incomplete higher phases)
- **Files modified:** tests/phase.test.cjs
- **Verification:** All 59 phase tests pass; 3 pre-existing config test failures are unrelated and pre-date this plan
- **Committed in:** d22cda8 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Necessary to bring the test suite into alignment with the fixed behavior. No scope creep.

## Issues Encountered
- Pre-existing test (line 1036) documented the `is_last_phase` bug as "correct behavior" — required updating both the test name and assertion to match fixed behavior. Confirmed pre-existing config test failures (3) are unrelated by checking baseline before changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `planningRoot` and `detectLayoutStyle` are ready to be called by any v2.0 phase
- `is_last_phase` correctly returns `false` when ROADMAP.md has unplanned future phases (no directories yet)
- Phase 09 (milestone workspace initialization) can now use `planningRoot(cwd, 'v2.0')` for scoped paths

---
*Phase: 08-path-architecture-foundation*
*Completed: 2026-02-24*
