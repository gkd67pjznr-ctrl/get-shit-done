---
phase: 91
plan: 03
title: "Workflow injection — cmdInitPlanPhase plan_suggestions and plan-phase.md planning_intelligence block"
status: complete
completed: "2026-04-06"
commits:
  - 810ba16
  - 8eefb1b
  - 9ee955b
---

# Plan 91-03 Summary: Workflow Injection

## Outcome

All four tasks complete. `cmdInitPlanPhase` now emits `plan_suggestions` and `task_performance` fields in its JSON output. `plan-phase.md` Step 1 parses them into shell variables and Step 8 conditionally renders a `<planning_intelligence>` reference table in the planner prompt. The updated workflow was propagated to `~/.claude/get-shit-done/` via the installer.

## Tasks Executed

### 91-03-01: Add plan_suggestions and task_performance to cmdInitPlanPhase
- File: `get-shit-done/bin/lib/init.cjs`
- Inserted two isolated try/catch blocks immediately before `output(result, raw)` at line 248
- First block requires `plan-similarity.cjs` and calls `searchSimilarPlans` with threshold 0.65 and limit 3
- Second block requires `task-classifier.cjs` and calls `buildTypePerformanceTable`
- Both degrade to `[]` on any error including MODULE_NOT_FOUND
- Verified: module loads cleanly; `--raw` JSON output includes `plan_suggestions: true task_performance: true`
- Commit: `810ba16`

### 91-03-02: Add PLAN_SUGGESTIONS and TASK_PERFORMANCE parse lines to plan-phase.md Step 1
- File: `get-shit-done/workflows/plan-phase.md`
- Added two `jq -c` extraction lines after the MILESTONE_FLAG block using `echo "$INIT" | jq` (consistent with existing pattern in the file)
- Updated the "Parse JSON for:" description line to document both new fields
- Verified: grep finds both variable assignment lines at lines 36-37
- Commit: `8eefb1b`

### 91-03-03: Add planning_intelligence block to plan-phase.md Step 8
- File: `get-shit-done/workflows/plan-phase.md`
- Added bash block in Step 8 that builds `INTELLIGENCE_BLOCK` conditionally based on `SUGGESTION_COUNT` and `TASK_PERF_COUNT`
- SIM_TABLE rendered only when `SUGGESTION_COUNT > 0` with columns: Plan, Phase, Match%, Corrections, Keyword%, Task-Type%, File-Pattern%
- PERF_TABLE rendered only when `TASK_PERF_COUNT > 0` with columns: Task Type, Median Corrections, Best Example From
- `INTELLIGENCE_BLOCK` wrapped in `<planning_intelligence>` XML with framing note about structural reference only
- Injected `{INTELLIGENCE_BLOCK}` as interpolation point in the planner prompt between `</planning_context>` and `<downstream_consumer>`
- When both arrays are empty, `INTELLIGENCE_BLOCK` is empty string — renders as a clean blank line, no noise
- Verified: grep finds 5 references (`planning_intelligence` x2, `INTELLIGENCE_BLOCK` x3) in Step 8 area
- Commit: `9ee955b`

### 91-03-04: Run install.cjs to propagate plan-phase.md to ~/.claude/
- Ran `node /Users/tmac/Projects/gsdup/bin/install.js --claude --global`
- Verified: `~/.claude/get-shit-done/workflows/plan-phase.md` contains all new variables (PLAN_SUGGESTIONS, TASK_PERFORMANCE, INTELLIGENCE_BLOCK)
- No separate commit required (runtime operation)

## Deviations

- **project-claude/install.cjs not found:** The plan referenced `node project-claude/install.cjs` but this project uses `node bin/install.js --claude --global` as its installer. Used the correct script. Same deployment outcome achieved.

## Verification Results

```
plan_suggestions: true task_performance: true   # init --raw JSON output
grep count planning_intelligence/INTELLIGENCE_BLOCK: 5   # plan-phase.md
INTELLIGENCE_BLOCK count in ~/.claude/: 3   # installed file
Test suite: 1275 pass / 4 fail (4 pre-existing failures — no regressions)
```

## Files Modified

- `get-shit-done/bin/lib/init.cjs` — two try/catch blocks added before `output(result, raw)`
- `get-shit-done/workflows/plan-phase.md` — Step 1 parse lines + Step 8 intelligence block
- `~/.claude/get-shit-done/workflows/plan-phase.md` — propagated by installer (not committed)
