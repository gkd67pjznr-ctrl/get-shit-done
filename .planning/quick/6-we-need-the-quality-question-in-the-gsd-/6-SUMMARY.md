---
phase: quick-6
plan: "01"
subsystem: workflows
tags: [quality, onboarding, settings, ux]
dependency_graph:
  requires: []
  provides: [quality-question-in-onboarding, quality-question-in-settings]
  affects: [new-project.md, settings.md]
tech_stack:
  added: []
  patterns: [AskUserQuestion with quality options, config.json quality field template]
key_files:
  created: []
  modified:
    - get-shit-done/workflows/new-project.md
    - get-shit-done/workflows/settings.md
decisions:
  - "Standard recommended for interactive/settings flows; Fast recommended for auto mode flow"
  - "Quality question placed as last question in Round 1 (after Git Tracking) in both flows"
  - "Updated installed copies at /Users/tmac/.claude/... in addition to repo copies"
metrics:
  duration: "4 minutes"
  completed_date: "2026-02-27"
  tasks_completed: 2
  files_modified: 2
---

# Quick Task 6: Add Quality Question to GSD Onboarding and Settings Workflows — Summary

**One-liner:** Added quality enforcement level question (fast/standard/strict) to new-project.md onboarding flows and settings.md workflow with config.json template updates.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add quality question to new-project.md onboarding flows | 0ce9ced | get-shit-done/workflows/new-project.md |
| 2 | Add quality question to settings.md workflow | dae0e06 | get-shit-done/workflows/settings.md |

## What Was Built

### Task 1 — new-project.md

Three targeted edits:

**Edit 1 — Step 2a Round 1 (auto mode):** Added Quality as 4th question with Fast as recommended option. Updated header from "3 questions" to "4 questions". In auto mode, Fast is recommended because auto mode prioritizes speed.

**Edit 2 — Step 5 Round 1 (interactive mode):** Added Quality as 5th question with Standard as recommended option. Updated header from "4 questions" to "5 questions". In interactive mode, Standard is recommended for quality gate feedback without blocking.

**Edit 3 — Config templates:** Added `"quality": { "level": "fast|standard|strict" }` field adjacent to `"model_profile"` in both the auto mode and interactive mode config.json output templates.

### Task 2 — settings.md

Five targeted edits:

**Edit 1 — present_settings AskUserQuestion:** Added Quality as 8th question with Standard as recommended option.

**Edit 2 — read_current step:** Added `quality.level` to the parsed values list with default of `standard`.

**Edit 3 — update_config JSON template:** Added `"quality": { "level": "fast" | "standard" | "strict" }` field adjacent to `model_profile`.

**Edit 4 — confirm step display table:** Added `| Quality Level | {fast/standard/strict} |` row after Git Branching.

**Edit 5 — save_as_defaults JSON template:** Added `"quality": { "level": <current> }` field.

Also updated success criteria from "7 settings" to "8 settings (profile + 5 workflow toggles + git branching + quality level)".

## Deviations from Plan

### Auto-fixed Issues

None. Plan executed exactly as specified.

### Notes on Scope

The plan specified editing files at `/Users/tmac/.claude/get-shit-done/workflows/`. These installed copies were edited. Additionally, the same changes were applied to the repo copies at `get-shit-done/workflows/` so the git history captures the changes. The installed and repo copies differ only in path style (`/Users/tmac/.claude/...` vs `~/.claude/...`), which was preserved.

## Verification Results

All success criteria met:

- Quality question appears in new-project.md Step 5 Round 1 (interactive) with Standard recommended
- Quality question appears in new-project.md Step 2a Round 1 (auto) with Fast recommended
- Both config.json templates in new-project.md include "quality": { "level": "..." }
- Quality question appears in settings.md questionnaire with Standard recommended
- Config template in settings.md includes quality.level
- Defaults template in settings.md includes quality.level
- Settings confirmation table includes Quality Level row
- No unrelated changes to either file

## Self-Check: PASSED
