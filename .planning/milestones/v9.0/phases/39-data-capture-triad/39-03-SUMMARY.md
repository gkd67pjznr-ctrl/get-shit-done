---
phase: 39
plan: "03"
name: Debt Impact Analysis
status: complete
completed_at: "2026-04-03"
duration_estimate: "~45 minutes"
tasks_completed: 5
tasks_total: 5
deviations: 0
requirements_completed:
  - DIMP-01
  - DIMP-02
  - DIMP-03
---

# Phase 39 Plan 03 Summary: Debt Impact Analysis

## Outcome

All 5 tasks completed. All 24 debt tests pass. Full suite shows 994 pass / 3 fail (3 pre-existing failures in config-get, scan-state.json, and tmux parser — unrelated to this plan).

## What Was Built

### cmdDebtImpact (get-shit-done/bin/lib/debt.cjs)

New exported function that reads DEBT.md and corrections.jsonl to compute correction-weighted impact scores for each debt entry. Key behaviors:

- Primary signal: `source_phase` correlation — corrections with matching `phase` field
- Secondary signal: component substring match (case-insensitive) when corrections have a `component` field
- Union deduplication by object identity to avoid double-counting
- `link_confidence`: high (3+), medium (1-2), low (0 matches)
- Sort: `correction_count` descending, then `id` ascending as tiebreaker
- Read-only — never modifies DEBT.md
- Graceful: returns `{ entries: [], total: 0 }` when DEBT.md missing

### CLI Router (gsd-tools.cjs)

Added `debt impact` subcommand case that calls `cmdDebtImpact(cwd, {}, raw)`. Updated usage comment and error message to include `impact` in available subcommands.

### /gsd:fix-debt Enhancement (commands/gsd/fix-debt.md)

Added Step 1a that fetches impact data before entry selection. When corrections data exists, displays a ranked table showing `link_confidence` and `correction_count` for each entry. Added two entries to `<success_criteria>`.

### Tests (tests/debt.test.cjs)

Added 5 new DIMP tests in a `describe('debt impact', ...)` block:
1. Ranked entries with link_confidence (high for 3+, low for 0)
2. Medium confidence for 1-2 corrections
3. Sort order: higher correction_count first
4. Empty array when DEBT.md missing (exits 0)
5. Read-only: DEBT.md content identical before and after

## Deviations

None. Implementation followed the plan exactly.

## Commits

- `test(debt-impact): add DIMP test cases for cmdDebtImpact (RED phase)` — 9ebee1c
- `feat(debt-impact): implement cmdDebtImpact in debt.cjs` — 5c602ff
- `feat(debt-impact): wire debt impact subcommand in gsd-tools.cjs CLI router` — 6ce61bc
- `feat(debt-impact): surface correction-linked impact data in fix-debt Step 1` — 0c1ff9a

## Requirements Satisfied

- DIMP-01: cmdDebtImpact reads DEBT.md and corrections.jsonl and outputs ranked entries
- DIMP-02: link_confidence thresholds (high/medium/low) and source_phase correlation
- DIMP-03: /gsd:fix-debt Step 1 surfaces impact data before selection
