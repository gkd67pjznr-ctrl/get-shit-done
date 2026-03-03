---
phase: quick-13
plan: "01"
subsystem: planning
tags: [feasibility, legacy-strip, architecture, analysis]
dependency_graph:
  requires: []
  provides: [FEASIBILITY-01]
  affects: [v3.1-milestone]
tech_stack:
  added: []
  patterns: []
key_files:
  created:
    - .planning/quick/13-feasibility-analysis-rebuild-gsd-with-mi/FEASIBILITY.md
  modified: []
decisions:
  - "Path A (surgical strip) recommended over rebuild — 1,437 lines deletable in 3-5 sessions vs 3-4 months for rebuild"
  - "Upstream git pull remains viable after Path A — conflicts are bounded to known legacy touch points"
  - "Execution order: migrate.cjs delete first (pure deletion), then core.cjs simplification, then dependents, then workflows"
metrics:
  duration: "~20 minutes"
  completed: "2026-03-03"
  tasks_completed: 1
  files_created: 1
---

# Quick Task 13: Feasibility Analysis — Rebuild GSD with Milestone-Only Layout

**One-liner:** Quantified audit recommending surgical legacy strip (~1,437 lines, 3-5 sessions) over ground-up rebuild, with upstream pull preserved under Path A.

## What Was Done

Performed a comprehensive audit of the GSD codebase to answer two questions:
1. Should GSD be rebuilt from scratch (milestone-only) or surgically stripped of legacy code?
2. Can upstream GSD updates still be pulled under each approach?

Produced `FEASIBILITY.md` (488 lines) covering all 6 required sections with real line counts from the codebase.

## Key Findings

### Legacy Surface Area Is Bounded

The dual-layout complexity lives in a small number of files:

| Scope | Size |
|-------|------|
| `migrate.cjs` (delete entirely) | 694 lines |
| `compat.test.cjs` + `migrate.test.cjs` (delete entirely) | 550 lines |
| `detectLayoutStyle()` + legacy branches in `core.cjs` | ~95 lines |
| Call sites in `init.cjs`, `roadmap.cjs`, `phase.cjs`, `commands.cjs`, `gsd-tools.cjs` | ~91 lines |
| Workflow `layout_style` conditionals (7 files) | ~20 lines |
| Test cleanup (partial `core.test.cjs`, `init.test.cjs`) | ~35 lines |
| **Total removable** | **~1,437 lines (19% reduction)** |

Eight files (`verify.cjs`, `state.cjs`, `milestone.cjs`, `frontmatter.cjs`, `template.cjs`, `debt.cjs`, `config.cjs`, `milestone.cjs`) have zero legacy references and need no changes.

### Path A Is the Clear Winner

The existing code is architecturally sound — `findPhaseInternal` already prioritizes milestone paths before the legacy fallback. The legacy code is surface area, not structural. Path A preserves 349 existing tests and all battle-tested edge case handling (normalizePhaseName decimals, cross-milestone fallbacks, etc.).

Path B (ground-up rebuild) would cost 3-4 months and produce a hard fork that cannot receive upstream updates. Path C (upstream PR) has high effort and uncertain acceptance.

### Upstream Pull Remains Viable

After Path A, `git pull origin main` produces merge conflicts only in the known legacy touch points. Resolution is always mechanical — keep the fork's simplified version, accept upstream additions. Files untouched by Path A (`state.cjs`, `milestone.cjs`, `debt.cjs`, `verify.cjs`, etc.) can receive upstream improvements with zero conflicts.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 6e232d9 | feat(quick-13): add FEASIBILITY.md with quantified legacy-strip analysis |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FEASIBILITY.md exists: confirmed (488 lines, requirement was 100+)
- Commit 6e232d9 exists: confirmed
- All 6 sections covered: Current State Inventory, Three Paths Analysis, Root Layout Definition, Code Deletions for Path A, Recommendation, Update Path Deep Dive
