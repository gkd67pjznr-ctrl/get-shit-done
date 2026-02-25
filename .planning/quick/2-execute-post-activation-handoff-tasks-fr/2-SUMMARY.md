---
phase: quick-2
plan: 01
subsystem: tests
tags: [milestone-scoped, test-coverage, environment-isolation, fix]
dependency_graph:
  requires: []
  provides: [milestone-scoped test coverage for core/phase/roadmap, clean test environment isolation]
  affects: [tests/core.test.cjs, tests/phase.test.cjs, tests/roadmap.test.cjs, tests/commands.test.cjs, tests/init.test.cjs]
tech_stack:
  added: []
  patterns: [createConcurrentProject fixture pattern, runGsdToolsFull with HOME+GSD_HOME isolation]
key_files:
  modified:
    - tests/core.test.cjs
    - tests/phase.test.cjs
    - tests/roadmap.test.cjs
    - tests/commands.test.cjs
    - tests/init.test.cjs
decisions:
  - Override both HOME and GSD_HOME in environment-sensitive tests to prevent user's ~/.gsd/defaults.json and ~/.claude/gsd-local-patches/ from leaking into test assertions
  - Use findPhaseInternal and getRoadmapPhaseInternal via direct require in core tests (not CLI) to test internal milestone routing without subprocess overhead
metrics:
  duration: ~8 minutes
  completed: 2026-02-25
  tasks_completed: 2
  files_modified: 5
---

# Quick Task 2: Execute Post-Activation Handoff Tasks Summary

**One-liner:** 9 milestone-scoped tests added for v3.0 workspace routing + 4 pre-existing test failures fixed via HOME/GSD_HOME environment isolation, bringing full suite to 275/275 passing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add milestone-scoped tests for core, phase, and roadmap | c523caa | tests/core.test.cjs, tests/phase.test.cjs, tests/roadmap.test.cjs |
| 2 | Fix 4 pre-existing test failures (environment isolation) | 489568f | tests/commands.test.cjs, tests/init.test.cjs |

## What Was Built

### Task 1: 9 New Milestone-Scoped Tests

**tests/core.test.cjs** — New `describe('milestone-scoped core functions')` block (4 tests):
- `findPhaseInternal with milestoneScope finds phase in workspace` — createConcurrentProject('v3.0'), creates `3.1-test-phase` dir, asserts `found: true` with path containing `milestones/v3.0`
- `findPhaseInternal with milestoneScope returns null for missing phase` — asserts `findPhaseInternal(tmpDir, '99', 'v3.0')` returns null/not found
- `getRoadmapPhaseInternal with milestoneScope reads milestone ROADMAP` — writes ROADMAP with Phase 3.1 section, asserts correct name/goal returned
- `normalizePhaseName with milestone-style dot-hierarchy` — asserts `3.1` stays `3.1`, `3.2.1` stays `3.2.1`, `15` stays `15`

**tests/phase.test.cjs** — New `describe('milestone-scoped phase operations')` block (4 tests):
- `cmdFindPhase with milestoneScope finds phase in workspace`
- `cmdPhasePlanIndex with milestoneScope indexes workspace phases`
- `cmdPhaseAdd with milestoneScope generates milestone-prefix numbering`
- `phases list with --milestone lists milestone workspace phases`

**tests/roadmap.test.cjs** — New `describe('milestone-scoped roadmap update-plan-progress')` block (1 test):
- `cmdRoadmapUpdatePlanProgress with milestoneScope reads/writes workspace ROADMAP` — verifies checkbox `- [ ]` flips to `- [x]` in milestone workspace ROADMAP.md

### Task 2: 4 Test Failures Fixed

**Root cause 1** — `check-patches` test (tests/commands.test.cjs line 768): `cmdCheckPatches` checks `~/.claude/gsd-local-patches/` via `os.homedir()`. User has real `backup-meta.json` there, causing `has_patches: true` instead of expected `false`. Fix: added `HOME: gsdHomeDir` to `runGsdToolsFull` env overrides.

**Root cause 2** — 3 config quality tests (tests/init.test.cjs): `cmdConfigEnsureSection` loads `~/.gsd/defaults.json` for quality defaults. User's real defaults.json has `quality.level: "standard"`, overriding the expected `"fast"` default. Fix: switched all 3 tests from `runGsdTools` to `runGsdToolsFull` with `{ GSD_HOME: isolatedHome, HOME: isolatedHome }` pointing to fresh temp dirs.

## Test Results

| Metric | Before | After |
|--------|--------|-------|
| Tests passing | 262 | 275 |
| Tests failing | 4 | 0 |
| New tests added | — | 9 |
| Fixed failures | — | 4 |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All files exist on disk. Both task commits (c523caa, 489568f) confirmed in git log. Full test suite verified at 275/275 passing, 0 failing.
