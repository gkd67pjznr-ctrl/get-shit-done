---
phase: quick-8
plan: 01
subsystem: roadmap/phase-lookup
tags: [bug-fix, cross-milestone, tdd, milestone-scoped]
dependency_graph:
  requires: []
  provides: [cross-milestone-roadmap-get-phase, cross-milestone-find-phase, cross-milestone-getRoadmapPhaseInternal]
  affects: [roadmap.cjs, core.cjs, phase.cjs]
tech_stack:
  added: []
  patterns: [cross-milestone-fallback, helper-extraction, delegation-pattern]
key_files:
  created: []
  modified:
    - get-shit-done/bin/lib/roadmap.cjs
    - get-shit-done/bin/lib/core.cjs
    - get-shit-done/bin/lib/phase.cjs
    - tests/roadmap.test.cjs
    - tests/phase.test.cjs
decisions:
  - extractPhaseFromContent helper added to roadmap.cjs to avoid code duplication in fallback loop
  - cmdFindPhase delegates to findPhaseInternal (already cross-milestone-aware) rather than duplicating the loop
  - getRoadmapPhaseInternal adds milestone_scope field to result when phase found in non-primary milestone
metrics:
  duration: ~15 minutes
  completed: 2026-02-28
  tasks_completed: 3
  files_changed: 5
---

# Phase quick-8 Plan 01: Fix Cross-Milestone Phase Lookup Summary

**One-liner:** Fixed three functions to search all milestone ROADMAPs/phase-dirs when phase not found in active milestone, using TDD with 7 new tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write failing tests for cross-milestone phase lookup (RED) | 88c566f | tests/roadmap.test.cjs, tests/phase.test.cjs |
| 2 | Implement cross-milestone fallback in all three functions (GREEN) | e3fe785 | roadmap.cjs, core.cjs, phase.cjs |
| 3 | Full test suite regression check | 0c2c558 | (verification only) |

## What Was Built

Three functions that previously only searched the active milestone now fall back to searching all milestones when a phase is not found in the scoped ROADMAP/phases directory:

**cmdRoadmapGetPhase (roadmap.cjs):**
- Added `extractPhaseFromContent(content, phaseNum)` helper to parse phase data from ROADMAP content without duplication
- Added `_roadmapGetPhaseCrossMilestone(cwd, phaseNum, currentMilestoneScope)` to iterate all other milestone ROADMAPs
- When phase not found in primary ROADMAP (or primary ROADMAP missing), triggers cross-milestone search
- Returns `milestone_scope` field in result when phase found in non-primary milestone

**getRoadmapPhaseInternal (core.cjs):**
- Refactored with inline `parseFromContent` closure to support both primary and fallback paths
- After primary ROADMAP miss, searches other milestones if layout is milestone-scoped
- Returns `milestone_scope` field when found in a different milestone

**cmdFindPhase (phase.cjs):**
- Simplest fix: delegates to `findPhaseInternal(cwd, phase)` (which already handles cross-milestone search) when phase not found in scoped milestone's phases directory

## Deviations from Plan

None — plan executed exactly as written. The helper extraction pattern suggested in the plan was implemented as specified.

## Quality Gates

**Quality Level:** standard

| Task | Gate | Outcome | Detail |
|------|------|---------|--------|
| 1 | codebase_scan | passed | findPhaseInternal at line 246 — reference pattern used as specified |
| 1 | context7_lookup | skipped | N/A — no external library dependencies |
| 1 | test_baseline | passed | 82 tests passing before changes |
| 1 | test_gate | passed | 7 new tests written (RED: 2 suites failing as expected) |
| 1 | diff_review | passed | clean diff — only test additions |
| 2 | codebase_scan | passed | reused detectLayoutStyle, planningRoot, findPhaseInternal from core.cjs |
| 2 | context7_lookup | skipped | N/A — internal modules only |
| 2 | test_gate | passed | 89 tests passing (GREEN) |
| 2 | diff_review | passed | clean diff — no TODOs, no missing error paths |
| 3 | test_gate | passed | 334 tests passing, 0 failures |
| 3 | diff_review | passed | clean diff |

**Summary:** 11 gates ran, 9 passed, 2 skipped, 0 warned, 0 blocked

## Issues Encountered

None. The implementation was clean and all tests passed immediately after implementation.

## Smoke Test Results

All smoke tests run against the real project:

| Command | Expected | Actual |
|---------|----------|--------|
| `roadmap get-phase 3.1` | found=true, data from v3.0 | found=true, phase_name="Integration Fixes", milestone_scope="v3.0" |
| `roadmap get-phase 4` | found=true, data from v3.1 | found=true, phase_name="Bug Fixes" |
| `find-phase 4` | found=true in v3.1 | found=true, directory in v3.1/phases |
| `find-phase 3.1` | found=true (if dirs exist) | found=false (v3.0 phases dir is empty — correct behavior) |

Note: `find-phase 3.1` returns `found=false` because v3.0's phases directory has no subdirectories on disk for this project — the phases were tracked in ROADMAP.md but directories were not created. This is correct behavior: `findPhaseInternal` requires actual phase directories to exist.

## Self-Check: PASSED

- SUMMARY.md exists at `.planning/quick/8-fix-roadmap-get-phase-to-correctly-find-/8-SUMMARY.md`
- Commit 88c566f (RED): tests/roadmap.test.cjs, tests/phase.test.cjs
- Commit e3fe785 (GREEN): roadmap.cjs, core.cjs, phase.cjs
- Commit 0c2c558 (regression): full suite verification
