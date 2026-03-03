---
phase: quick-12
plan: "01"
subsystem: workflows
tags: [milestone-scoped, plan-phase, planner-agent, path-resolution]
key-decisions:
  - Use planning_root from init JSON for all directory construction, never hardcode .planning/phases/
  - Pass phase_dir and planning_root through planning_context block to gsd-planner agent
  - planner-subagent-prompt.md template paths updated to use {phase_dir}/{planning_root} placeholders
key-files:
  modified:
    - get-shit-done/workflows/plan-phase.md
    - agents/gsd-planner.md
    - get-shit-done/templates/planner-subagent-prompt.md
metrics:
  duration: "6 minutes"
  completed: "2026-03-03"
  tasks_completed: 3
  tasks_total: 3
---

# Quick Task 12: Fix plan-phase to consistently use milestone-scoped directories

**One-liner:** Fixed plan-phase.md mkdir fallback and planner context to use `planning_root` from init JSON, and updated gsd-planner.md execution steps to use `phase_dir`/`planning_root` variables instead of hardcoded `.planning/phases/` paths.

## What Was Done

When `concurrent: true` is active (milestone-scoped layout), the `plan-phase` workflow was writing PLAN.md files to the wrong location because:
1. The mkdir fallback in step 2 hardcoded `.planning/phases/`
2. The planner prompt in step 8 didn't pass `phase_dir`, `planning_root`, or `padded_phase` to the agent
3. The gsd-planner agent had hardcoded `.planning/phases/` in all its execution steps

All three files were updated to use the dynamic paths from init JSON.

## Tasks Completed

### Task 1: plan-phase.md

**Commit:** 9826446

Changes made to `/Users/tmac/Projects/gsdup/get-shit-done/workflows/plan-phase.md`:

1. Added `planning_root` to the step 1 parse list
2. Changed mkdir fallback from `.planning/phases/${padded_phase}-${phase_slug}` to `${planning_root}/phases/${padded_phase}-${phase_slug}`
3. Added `**Phase directory:** {phase_dir}`, `**Planning root:** {planning_root}`, `**Padded phase:** {padded_phase}` to the planner prompt `<planning_context>` block
4. Fixed revision prompt path from `{PHASE_DIR}` to `{phase_dir}`
5. Fixed offer_next display path from `.planning/phases/{phase-dir}/*-PLAN.md` to `{phase_dir}/*-PLAN.md`

### Task 2: gsd-planner.md and planner-subagent-prompt.md

**Commit:** 872199e

Changes made to `/Users/tmac/Projects/gsdup/agents/gsd-planner.md`:

1. `load_project_state`: Added note to extract `phase_dir`, `planning_root`, `padded_phase` from `<planning_context>`
2. `identify_phase`: Changed `cat .planning/ROADMAP.md` / `ls .planning/phases/` to use `${planning_root}` and `${phase_dir}`
3. `read_project_history`: Changed SUMMARY.md path to use `${planning_root}/phases/`
4. `gather_phase_context`: Clarified that `phase_dir` comes from `<planning_context>` when spawned, or init JSON when standalone
5. `write_phase_prompt`: Changed write target from `.planning/phases/XX-name/` to `${phase_dir}/${padded_phase}-{NN}-PLAN.md`
6. `update_roadmap`: Changed ROADMAP.md path to use `${planning_root}/ROADMAP.md`
7. `git_commit`: Updated file paths to use `${phase_dir}/${padded_phase}-*-PLAN.md` and `${planning_root}/ROADMAP.md`
8. `revision_mode Step 1`: Use `${phase_dir}/${padded_phase}-*-PLAN.md`
9. `revision_mode Step 6`: Use `${phase_dir}/${padded_phase}-*-PLAN.md`
10. `plan_format output`: Changed SUMMARY.md path to `${phase_dir}/{phase}-{plan}-SUMMARY.md`

Changes made to `/Users/tmac/Projects/gsdup/get-shit-done/templates/planner-subagent-prompt.md`:

1. Added `phase_dir`, `planning_root`, `padded_phase` to `<planning_context>` block
2. Changed `@.planning/STATE.md`, `@.planning/ROADMAP.md`, `@.planning/REQUIREMENTS.md` to use `{planning_root}` prefix
3. Changed `@.planning/phases/{phase_dir}/...` to `@{phase_dir}/...` (phase_dir already includes full path)
4. Updated Placeholders table with `{planning_root}` and `{padded_phase}` entries
5. Fixed Continuation section `@.planning/phases/{phase_dir}/` to `@{phase_dir}/`

### Task 3: Verification

All verification steps passed:
- `init plan-phase 3.1` returns: `phase_dir: ".planning/milestones/v3.1/phases/3.1-integration-fixes"`, `planning_root: ".planning/milestones/v3.1"`, `milestone_scope: "v3.1"`, `padded_phase: "3.1"`
- No remaining hardcoded `.planning/phases/` in operational code in any of the three files
- All 349 tests pass (no regressions)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Also updated gsdup project source files**

The plan listed `~/.claude/` paths as the files to modify, but those are the deployed/installed copies. The gsdup project at `/Users/tmac/Projects/gsdup/` is the source of truth that gets committed to git. Both the project source files and the installed `~/.claude/` files were updated to keep them in sync. The project source files are what gets committed and tracked in version control.

## Verification

- No hardcoded `.planning/phases/` in plan-phase.md operational code: CONFIRMED
- gsd-planner.md execution steps reference phase_dir/planning_root variables: CONFIRMED (20 references)
- Planner prompt includes phase_dir and planning_root from init JSON: CONFIRMED
- init plan-phase still returns correct milestone-scoped paths: CONFIRMED
- Existing tests pass (349/349): CONFIRMED

## Self-Check: PASSED

Files confirmed to exist:
- `/Users/tmac/Projects/gsdup/get-shit-done/workflows/plan-phase.md` - FOUND
- `/Users/tmac/Projects/gsdup/agents/gsd-planner.md` - FOUND
- `/Users/tmac/Projects/gsdup/get-shit-done/templates/planner-subagent-prompt.md` - FOUND
- `/Users/tmac/Projects/gsdup/.planning/quick/12-fix-plan-phase-to-consistently-use-miles/12-SUMMARY.md` - FOUND

Commits confirmed:
- `9826446` - plan-phase.md fix - FOUND
- `872199e` - gsd-planner.md + planner-subagent-prompt.md fix - FOUND
