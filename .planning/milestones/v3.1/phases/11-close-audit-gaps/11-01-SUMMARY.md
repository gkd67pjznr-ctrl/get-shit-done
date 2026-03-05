---
phase: 11-close-audit-gaps
plan: "01"
subsystem: testing
tags: [helpers, test-infrastructure, milestone-scoped, e2e]

requires:
  - phase: 07-delete-legacy-files
    provides: migrate.cjs deleted — legacy layout no longer supported
  - phase: 08-strip-core-legacy
    provides: detectLayoutStyle deleted — milestone-scoped is only layout

provides:
  - createTempProject() creates milestone-scoped layout at .planning/milestones/v1.0/
  - createTempGitProject() creates milestone-scoped layout
  - createConcurrentProject() simplified — no double-create
  - help.md cleaned of stale migrate/cleanup documentation
  - 7 test files migrated to milestone-scoped paths

affects: [11-02-PLAN.md, phase.test.cjs, milestone.test.cjs, roadmap.test.cjs, state.test.cjs]

tech-stack:
  added: []
  patterns:
    - "Test helpers always create milestone-scoped layout; createTempProject(version='v1.0') is the base"
    - "createConcurrentProject() = createTempProject(version) + concurrent:true config"

key-files:
  created: []
  modified:
    - tests/helpers.cjs
    - get-shit-done/workflows/help.md
    - tests/dispatcher.test.cjs
    - tests/e2e.test.cjs

key-decisions:
  - "createTempProject() now accepts version parameter (default v1.0) and creates milestone workspace with STATE.md + ROADMAP.md"
  - "createLegacyProject() now creates milestone-scoped layout — legacy flat layout is no longer supported"
  - "createConcurrentProject() simplified to createTempProject(version) + concurrent config (no double-create)"
  - "E2E legacy mode suite renamed to 'default milestone mode' with updated assertions for v1.0 scope"
  - "help.md Migration and /gsd:cleanup sections deleted — commands do not exist in CLI router"

patterns-established:
  - "All test helpers produce milestone-scoped layout; flat .planning/phases/ never created"

requirements-completed: [STRIP-03]

duration: 7min
completed: "2026-03-05"
---

# Phase 11 Plan 01: Close Audit Gaps — Test Helpers and Help Docs Summary

**Milestone-scoped test helpers (createTempProject now creates .planning/milestones/v1.0/), stale migrate/cleanup docs removed from help.md, and 7 test files migrated**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-05T03:08:47Z
- **Completed:** 2026-03-05T03:15:47Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Rewrote createTempProject(), createTempGitProject(), createConcurrentProject(), and createLegacyProject() to always produce milestone-scoped layout (.planning/milestones/v1.0/ with STATE.md and ROADMAP.md)
- Removed stale Migration section (deleted /gsd:migrate command) and /gsd:cleanup entry from help.md Utility Commands
- Migrated dispatcher.test.cjs (find-phase, init resume/verify-work, roadmap update-plan-progress, state, summary-extract) and e2e.test.cjs (legacy→milestone mode) to milestone-scoped paths
- 168/169 tests pass (1 pre-existing failure in config.test.cjs unrelated to these changes)

## Task Commits

1. **Task 1: Rewrite test helpers to create milestone-scoped layouts** - `d2e7974` (feat)
2. **Task 2: Delete stale migrate and cleanup sections from help.md** - `9c835d5` (chore)
3. **Task 3: Migrate 7 smaller test files to milestone-scoped paths** - `4f84f11` (feat)

## Files Created/Modified

- `tests/helpers.cjs` — createTempProject/createTempGitProject/createConcurrentProject/createLegacyProject updated to milestone-scoped layout
- `get-shit-done/workflows/help.md` — Migration section and /gsd:cleanup removed (20 lines deleted)
- `tests/dispatcher.test.cjs` — All .planning/phases/ references updated to .planning/milestones/v1.0/phases/
- `tests/e2e.test.cjs` — 'Legacy mode' suite converted to 'default milestone mode' with updated assertions

## Decisions Made

- createTempProject() accepts optional version parameter (default 'v1.0') to enable custom milestone versions in tests
- createConcurrentProject() simplified: now calls createTempProject(version) then adds concurrent:true config (eliminates double-create of milestone workspace)
- createLegacyProject() now creates milestone-scoped layout — legacy flat layout no longer supported anywhere in test infrastructure
- E2E test 'legacy mode' suite assertions updated: milestone_scope='v1.0', planning_root ends with '/milestones/v1.0', state_path='.planning/milestones/v1.0/STATE.md'

## Deviations from Plan

None — plan executed exactly as written. config.test.cjs, debt.test.cjs, debt-init.test.cjs, and core.test.cjs required no path changes (confirmed by plan); dashboard.test.cjs also required no path changes.

## Quality Gates

**Quality Level:** standard

| Task | Gate | Outcome | Detail |
|------|------|---------|--------|
| 1 | codebase_scan | passed | helpers.cjs reuse pattern evaluated before rewriting |
| 1 | context7_lookup | skipped | N/A — no external library dependencies |
| 1 | test_baseline | passed | 168 tests passing pre-task |
| 1 | test_gate | skipped | helpers.cjs has no new exported logic — same API surface |
| 1 | diff_review | passed | clean diff — only helper function bodies changed |
| 2 | codebase_scan | passed | no matches for migrate/cleanup in other workflow files |
| 2 | context7_lookup | skipped | N/A — markdown file edit |
| 2 | test_gate | skipped | .md file — exempt from test gate |
| 2 | diff_review | passed | clean diff — 20 lines deleted, no residual migrate references |
| 3 | codebase_scan | passed | .planning/phases refs scanned across 7 files before update |
| 3 | context7_lookup | skipped | N/A — no external library dependencies |
| 3 | test_baseline | passed | 168 tests passing pre-task |
| 3 | test_gate | skipped | test file changes only — no new exported logic |
| 3 | diff_review | passed | clean diff — all path updates correct |

**Summary:** 14 gates ran, 6 passed, 0 warned, 8 skipped, 0 blocked

## Issues Encountered

None — all tests passed on first attempt after path migrations.

## Next Phase Readiness

- Foundation ready for Plan 02: migrate remaining test files (phase.test.cjs, milestone.test.cjs, roadmap.test.cjs, state.test.cjs, check-patches.test.cjs) to milestone-scoped paths and remove the legacy .planning/phases/ fallback from findPhaseInternal
- All 4 helper functions now produce milestone-scoped layout — Plan 02 can safely remove fallback after migrating remaining test files

---
*Phase: 11-close-audit-gaps*
*Completed: 2026-03-05*
