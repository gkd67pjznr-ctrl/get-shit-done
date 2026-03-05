---
phase: 16
plan: 16
type: quick
subsystem: init
tags: [phase-numbering, milestone, init, workflow, agent-docs]
dependency_graph:
  requires: []
  provides: [getHighestPhaseNumber, next_starting_phase in cmdInitNewMilestone]
  affects: [init.cjs, new-milestone workflow, gsd-roadmapper agent]
tech_stack:
  added: []
  patterns: [scan-all-milestone-dirs, regex-phase-extraction, multi-source-aggregation]
key_files:
  created: []
  modified:
    - get-shit-done/bin/lib/init.cjs
    - tests/init.test.cjs
    - get-shit-done/workflows/new-milestone.md
    - agents/gsd-roadmapper.md
decisions:
  - getHighestPhaseNumber scans three sources: milestone phase dirs, root ROADMAP.md Phases X-Y ranges, root STATE.md completed milestones table
  - Integer base extraction regex `/^(\d+)(?:\.\d+)*-/` handles both zero-padded integers and decimal phases correctly
  - Export getHighestPhaseNumber from module.exports for direct unit testability
metrics:
  duration: ~15 minutes
  completed: 2026-03-05
  tasks_completed: 2
  files_changed: 4
---

# Quick Task 16: Fix Milestone Phase Numbering Summary

**One-liner:** Automated phase number continuity via `getHighestPhaseNumber` scanning all milestones, returning `next_starting_phase: 15` for this project.

## What Was Built

### Task 1: getHighestPhaseNumber() and cmdInitNewMilestone update

Added `getHighestPhaseNumber(cwd)` function to `get-shit-done/bin/lib/init.cjs` that:

1. Scans `.planning/milestones/*/phases/` — extracts integer base from directory names using regex `/^(\d+)(?:\.\d+)*-/`
   - `"01-setup"` → 1, `"14-final"` → 14, `"3.1-hotfix"` → 3
2. Parses root `.planning/ROADMAP.md` for `Phases X-Y` patterns — uses the Y (end) value
3. Parses root `.planning/STATE.md` completed milestones table rows for `X-Y` phase range column

Returns the maximum integer found across all sources, or 0 if nothing found.

Updated `cmdInitNewMilestone()` to call `getHighestPhaseNumber(cwd)` and include two new fields:
- `highest_phase: 14` — transparency into what was detected
- `next_starting_phase: 15` — the actionable value for roadmapper

Exported `getHighestPhaseNumber` from `module.exports` for testability.

### Task 2: Workflow and agent documentation updates

**get-shit-done/workflows/new-milestone.md:**
- Step 7 extract line: added `next_starting_phase`, `highest_phase` to the field list
- Step 10 starting phase comment: replaced manual MILESTONES.md lookup with computed `next_starting_phase`
- Step 10 roadmapper instruction: changed `[N]` to `${next_starting_phase}`
- Added root ROADMAP.md update sub-step before commit (ensures future `getHighestPhaseNumber` works correctly)

**agents/gsd-roadmapper.md:**
- Replaced `"New milestone: Start at 1"` with `"Use starting_phase_number from orchestrator context"`

## Verification Results

1. Init test suite: 84/84 tests pass (6 new tests added)
2. Full test suite: 722/723 pass — 1 pre-existing failure in config-get (unrelated to this task)
3. `node get-shit-done/bin/gsd-tools.cjs init new-milestone` returns `next_starting_phase: 15` (correct — highest phase is 14 from v2.0)
4. new-milestone.md has 4 references to `next_starting_phase`
5. gsd-roadmapper.md no longer contains "Start at 1" hardcode

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

One pre-existing test failure in `config.test.cjs` (the `"gets a top-level value"` test expecting `model_profile: balanced`) was present before this task and unrelated to these changes.

## Self-Check

- [x] `get-shit-done/bin/lib/init.cjs` modified — `getHighestPhaseNumber` function added, `cmdInitNewMilestone` updated
- [x] `tests/init.test.cjs` modified — 6 new tests in `getHighestPhaseNumber (PHASE-NUM-01)` describe block
- [x] `get-shit-done/workflows/new-milestone.md` modified — all 4 changes applied
- [x] `agents/gsd-roadmapper.md` modified — hardcoded "Start at 1" replaced
- [x] Task 1 commit: `5bbbb95`
- [x] Task 2 commit: `03eaf7d`
