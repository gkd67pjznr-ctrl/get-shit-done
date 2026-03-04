---
phase: 08-strip-core-legacy
plan: 02
subsystem: testing
tags: [detectLayoutStyle, getArchivedPhaseDirs, layout_style, legacy-strip, import-cleanup]

# Dependency graph
requires:
  - phase: 08-strip-core-legacy
    plan: 01
    provides: "detectLayoutStyle and getArchivedPhaseDirs deleted from core.cjs"
provides:
  - "All dependent modules (init.cjs, roadmap.cjs, phase.cjs, commands.cjs) updated to remove deleted imports"
  - "gsd-tools.cjs CLI router updated to remove detectLayoutStyle usage"
  - "findPhaseInternal restored with unconditional legacy .planning/phases/ fallback"
  - "300/300 tests passing after legacy strip"
affects: [09-strip-test-legacy, all future phases using init/roadmap/phase/commands modules]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "milestoneScope guard: if (milestoneScope) instead of if (milestoneScope && detectLayoutStyle() === 'milestone-scoped')"
    - "cmdProgressRenderMulti always runs multi-milestone path — no layout-based fallback"
    - "autoCreatePhaseFromRoadmap always searches milestone dirs — no legacy null-scope fallback"

key-files:
  created: []
  modified:
    - get-shit-done/bin/lib/init.cjs
    - get-shit-done/bin/lib/roadmap.cjs
    - get-shit-done/bin/lib/phase.cjs
    - get-shit-done/bin/lib/commands.cjs
    - get-shit-done/bin/gsd-tools.cjs
    - get-shit-done/bin/lib/core.cjs
    - tests/core.test.cjs
    - tests/init.test.cjs
    - tests/milestone.test.cjs
    - tests/dashboard.test.cjs
    - tests/routing.test.cjs
    - tests/e2e.test.cjs
    - tests/commands.test.cjs

key-decisions:
  - "Removed detectLayoutStyle guard from all conditional branches — milestoneScope param alone is sufficient"
  - "cmdProgressRenderMulti no longer falls back to cmdProgressRender for legacy projects — always returns multi-milestone output"
  - "findPhaseInternal legacy .planning/phases/ fallback restored unconditionally (08-01 removed it, breaking tests)"
  - "9 detectLayoutStyle tests removed from core.test.cjs (function deleted — tests invalid)"
  - "Test count settled at 300 (was 309 before 08-01, 08-01 broke 234, now 300 pass)"

patterns-established:
  - "When layout function is deleted, remove its guards from dependents and make the behavior unconditional"
  - "findPhaseInternal searches milestone dirs first (when milestoneScope given), then flat .planning/phases/ (legacy fallback)"

requirements-completed: [STRIP-02, STRIP-03]

# Metrics
duration: 25min
completed: 2026-03-03
---

# Phase 8 Plan 02: Strip Core Legacy (Dependent Modules) Summary

**Removed detectLayoutStyle and getArchivedPhaseDirs from all dependent modules; simplified conditional guards; restored legacy findPhaseInternal fallback; 300/300 tests passing**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-03T18:48:00Z
- **Completed:** 2026-03-03T19:09:00Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments
- Removed all detectLayoutStyle imports and usage from init.cjs (8 layout_style fields deleted), roadmap.cjs (2 guards simplified), phase.cjs (1 guard simplified), commands.cjs (1 gate deleted)
- Removed all getArchivedPhaseDirs imports and usage from phase.cjs and commands.cjs
- Restored the full test suite to 300/300 passing (up from 75 passing after plan 08-01 left 234 failures)
- Fixed gsd-tools.cjs CLI router which was also importing detectLayoutStyle (not in plan scope — auto-fixed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update init.cjs** - `4f9c8cc` (fix)
2. **Task 2: Update roadmap.cjs, phase.cjs, commands.cjs** - `5d98f19` (fix)
3. **Task 3: Fix test suite + deviation fixes** - `c89d639` (fix)

**Plan metadata:** `fffe2e9` (docs: complete strip-core-legacy plan 02)

## Files Created/Modified
- `get-shit-done/bin/lib/init.cjs` - Removed detectLayoutStyle import and 8 layout_style output fields; simplified autoCreatePhaseFromRoadmap
- `get-shit-done/bin/lib/roadmap.cjs` - Removed detectLayoutStyle import; 2 guards simplified to if (milestoneScope)
- `get-shit-done/bin/lib/phase.cjs` - Removed detectLayoutStyle and getArchivedPhaseDirs imports; deleted includeArchived block; simplified cmdFindPhase guard
- `get-shit-done/bin/lib/commands.cjs` - Removed both deleted imports; deleted getArchivedPhaseDirs block in cmdHistoryDigest; deleted detectLayoutStyle gate in cmdProgressRenderMulti
- `get-shit-done/bin/gsd-tools.cjs` - Removed detectLayoutStyle import; made resolveActiveMilestone call unconditional (deviation fix)
- `get-shit-done/bin/lib/core.cjs` - Restored legacy .planning/phases/ fallback in findPhaseInternal (deviation fix)
- `tests/core.test.cjs` - Removed detectLayoutStyle import and 9-test describe block
- `tests/init.test.cjs` - Removed 2 layout_style field assertions
- `tests/milestone.test.cjs` - Removed layout_style assertions; fixed 2 workspace phase dir paths
- `tests/dashboard.test.cjs` - Removed layout_style assertion; rewrote legacy fallback test for new cmdProgressRenderMulti behavior
- `tests/routing.test.cjs` - Replaced 3 layout_style tests with milestone_scope assertions
- `tests/e2e.test.cjs` - Removed 4 layout_style assertions from renamed tests
- `tests/commands.test.cjs` - Added createConcurrentProject import; rewrote 6 progress command tests for multi-milestone output

## Decisions Made
- Removed detectLayoutStyle guard from all conditionals — milestoneScope parameter alone determines milestone-scoped behavior
- cmdProgressRenderMulti always executes multi-milestone path — returns `{ milestones: [...] }` for all projects including those with no milestones
- findPhaseInternal legacy fallback kept unconditionally — non-milestone projects (createTempProject in tests) still need .planning/phases/ search

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] gsd-tools.cjs also imported detectLayoutStyle**
- **Found during:** Task 3 (test suite execution)
- **Issue:** The CLI router in gsd-tools.cjs had `detectLayoutStyle` in its import and used it to guard the `resolveActiveMilestone` auto-detect call. Plan's file list did not include gsd-tools.cjs, but the import caused an error since the export was deleted.
- **Fix:** Removed detectLayoutStyle from import; changed `if (!milestoneScope && detectLayoutStyle(cwd) === 'milestone-scoped') { milestoneScope = resolveActiveMilestone(cwd); }` to `if (!milestoneScope) { milestoneScope = resolveActiveMilestone(cwd); }`
- **Files modified:** get-shit-done/bin/gsd-tools.cjs
- **Verification:** No detectLayoutStyle references remain; tests pass
- **Committed in:** c89d639 (Task 3 commit)

**2. [Rule 3 - Blocking] findPhaseInternal missing legacy .planning/phases/ fallback**
- **Found during:** Task 3 (test suite execution — 30+ test failures in phase.test.cjs, roadmap.test.cjs, commands.test.cjs, milestone.test.cjs)
- **Issue:** Plan 08-01 removed the legacy `.planning/phases/` fallback from `findPhaseInternal` along with the detectLayoutStyle guard. Tests using `createTempProject()` (flat structure) got "Phase X not found" errors since findPhaseInternal no longer searched that directory.
- **Fix:** Added back unconditional legacy fallback to findPhaseInternal in core.cjs, without any layout style guard. Searches milestone dirs when milestoneScope is provided, then always checks `.planning/phases/` as a final fallback.
- **Files modified:** get-shit-done/bin/lib/core.cjs
- **Verification:** phase.test.cjs 66/66, roadmap.test.cjs 23/23 after fix
- **Committed in:** c89d639 (Task 3 commit)

**3. [Rule 1 - Bug] cmdProgressRenderMulti behavioral change required 6 test rewrites**
- **Found during:** Task 3 (test suite execution)
- **Issue:** After removing the detectLayoutStyle gate in cmdProgressRenderMulti, the function always returns `{ milestones: [...] }`. Six tests in commands.test.cjs expected single-milestone output (`total_plans`, `phases` array) based on the old legacy fallback path.
- **Fix:** Rewrote 4 "progress command" tests and 2 "progress quality-level" tests to use createConcurrentProject('v1.0') and assert multi-milestone output format (`milestones` array, `milestones.length === 1`).
- **Files modified:** tests/commands.test.cjs
- **Verification:** All 6 rewritten tests pass with correct multi-milestone assertions
- **Committed in:** c89d639 (Task 3 commit)

**4. [Rule 1 - Bug] milestone.test.cjs workspace path mismatch**
- **Found during:** Task 3 (test suite execution)
- **Issue:** Two "milestone workspace finalization" tests created phases at `.planning/phases/08-feature` but `cmdMilestoneComplete` reads phases from `workspaceDir/phases/`. Phases were not found, causing finalization failures.
- **Fix:** Changed phase creation path from `.planning/phases/08-feature` to `workspaceDir/phases/08-feature` in 2 tests.
- **Files modified:** tests/milestone.test.cjs
- **Verification:** Both affected tests now pass
- **Committed in:** c89d639 (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (2 blocking, 2 bug)
**Impact on plan:** All auto-fixes necessary to complete test restoration. No scope creep. Plan 08-01 left cleanup gaps that became visible only when running the full test suite.

## Issues Encountered
- Test count goal was "309 pass" but 08-01 had already reduced to 309 (from 349). After removing 9 detectLayoutStyle tests from core.test.cjs (the function is deleted; tests are invalid), final count is 300. Plan explicitly permitted this: "if it blocks passing, go ahead and remove the test block."
- Initial run after Task 2 commits: 104 pass / 205 fail. Root causes were: gsd-tools.cjs not in plan scope, findPhaseInternal missing legacy fallback, layout_style assertions in 6 test files, progress command behavioral change. All resolved.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 9 (strip test legacy) can proceed — all 300 tests passing, no regressions
- Phase 9 task: remove remaining detectLayoutStyle test blocks in core.test.cjs that reference the deleted function
- Note: 9 detectLayoutStyle tests were already removed in this plan; any remaining ones should be in Phase 9 scope

---
*Phase: 08-strip-core-legacy*
*Completed: 2026-03-03*

## Self-Check: PASSED

- FOUND: .planning/milestones/v3.1/phases/08-strip-core-legacy/08-02-SUMMARY.md
- FOUND: get-shit-done/bin/lib/init.cjs
- FOUND: get-shit-done/bin/lib/core.cjs
- FOUND: commit 4f9c8cc (Task 1)
- FOUND: commit 5d98f19 (Task 2)
- FOUND: commit c89d639 (Task 3)
- FOUND: commit fffe2e9 (metadata)
