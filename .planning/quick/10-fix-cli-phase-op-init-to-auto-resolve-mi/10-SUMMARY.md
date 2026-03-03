---
phase: quick-10
plan: 01
subsystem: init-commands
tags: [bug-fix, cross-milestone, phase-lookup, tdd]
dependency_graph:
  requires: []
  provides: [cross-milestone-phase-lookup, effectiveScope-correction]
  affects: [init.cjs, core.cjs]
tech_stack:
  added: []
  patterns: [cross-milestone-retry, null-scope-fallback]
key_files:
  created: []
  modified:
    - get-shit-done/bin/lib/init.cjs
    - get-shit-done/bin/lib/core.cjs
    - tests/init.test.cjs
decisions:
  - "Cross-milestone retry uses findPhaseInternal(cwd, phase, null) rather than scanning milestones manually — leverages existing null-scope logic"
  - "effectiveScope priority changed from milestoneScope-first to phaseInfo.milestone_scope-first so the scope where the phase was FOUND takes precedence"
  - "autoCreatePhaseFromRoadmap recursive retry with null is safe — null path goes through else branch and never recurses"
  - "getRoadmapPhaseInternal null-scope cross-search placed BEFORE the milestoneScope cross-search to maintain code symmetry"
metrics:
  duration: 231s
  completed: 2026-03-02
  tasks_completed: 3
  files_modified: 3
---

# Phase quick-10 Plan 01: Fix CLI Init Commands to Auto-Resolve Milestone Scope Summary

**One-liner:** Cross-milestone phase lookup via retry-with-null pattern in all 4 init phase commands and getRoadmapPhaseInternal.

## What Was Built

Fixed all CLI init phase commands (`phase-op`, `execute-phase`, `plan-phase`, `verify-work`) to find phases in non-active milestones without requiring the `--milestone` flag. Previously, the CLI router auto-resolved `milestoneScope` to the active milestone, causing `findPhaseInternal` to search only that one milestone and miss phases in older milestones.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Add failing tests for cross-milestone phase lookup | 170b838 | tests/init.test.cjs |
| 1 (GREEN) | Implement cross-milestone retry in init commands and fix getRoadmapPhaseInternal | 2f09c76 | get-shit-done/bin/lib/init.cjs, get-shit-done/bin/lib/core.cjs |
| 3 | Full test suite — no regressions | (verified) | — |

## Implementation Details

### core.cjs: getRoadmapPhaseInternal

Added cross-milestone ROADMAP search when `milestoneScope` is `null` and layout is `milestone-scoped`. Previously the function only had this search for the non-null scope case. The new block mirrors the existing `milestoneScope`-provided cross-search and is placed before it for code symmetry.

### init.cjs: 4 init commands

Each command now follows the pattern:
1. Try `findPhaseInternal(cwd, phase, milestoneScope)` (active milestone)
2. If null AND milestoneScope is set: retry `findPhaseInternal(cwd, phase, null)` (cross-milestone)
3. `effectiveScope = phaseInfo?.milestone_scope || milestoneScope || null` (detected wins)

`cmdInitPhaseOp` additionally retries the ROADMAP fallback with null scope and recalculates `root` when a different milestone is found.

### init.cjs: autoCreatePhaseFromRoadmap

- Uses `foundScope = roadmapPhase.milestone_scope || scope` to ensure the directory is created in the correct milestone workspace
- Tags `phaseInfo.milestone_scope` when phase found in a different milestone than requested
- Adds retry-with-null at the end when explicit scope found nothing (no infinite recursion — null path goes through the `else` branch which never recurses)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Improvement] Refactored cmdInitPhaseOp to use `let effectiveScope` and `let root`**
- **Found during:** Task 1 (GREEN)
- **Issue:** After the ROADMAP cross-search, the `effectiveScope` needed to be updated to reflect which milestone was found, but it was declared as `const`
- **Fix:** Changed to `let effectiveScope` and `let root`, then recalculated after ROADMAP fallback when `roadmapPhase.milestone_scope` is set
- **Files modified:** `get-shit-done/bin/lib/init.cjs`
- **Commit:** 2f09c76

## Quality Gates

**Quality Level:** standard

| Task | Gate | Outcome | Detail |
|------|------|---------|--------|
| 1 | codebase_scan | passed | findPhaseInternal null-scope path already exists — reused via retry pattern |
| 1 | context7_lookup | skipped | N/A — no external library dependencies |
| 1 | test_baseline | passed | 37 init tests passing, 20 core tests passing |
| 1 | test_gate | passed | 6 new integration tests written and passing (TDD RED then GREEN) |
| 1 | diff_review | passed | clean diff — no duplicates, no TODOs, no naming conflicts |

**Summary:** 5 gates ran, 4 passed, 0 warned, 1 skipped, 0 blocked

## Test Results

- **Before:** 37 init tests, 20 core tests, 306 total (all passing)
- **After:** 43 init tests (+6 new), 20 core tests, 349 total (all passing)
- New tests cover: phase-op, execute-phase, plan-phase, verify-work cross-milestone lookup, effectiveScope correctness, ROADMAP-only cross-milestone fallback

## Self-Check: PASSED

- get-shit-done/bin/lib/init.cjs: FOUND
- get-shit-done/bin/lib/core.cjs: FOUND
- tests/init.test.cjs: FOUND
- 10-SUMMARY.md: FOUND
- Commit 170b838: FOUND
- Commit 2f09c76: FOUND
