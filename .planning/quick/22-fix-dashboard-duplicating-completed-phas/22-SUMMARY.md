---
quick_task: "22"
status: Complete
commit: 4b9c21f
date: "2026-03-09"
---

# Summary: Quick Task 22 — Fix Dashboard Duplicating Completed Phases

## What Was Done

Fixed `parseRoadmapFile()` in `get-shit-done/bin/lib/server.cjs` to correctly count phases in older ROADMAP formats. The function was matching every column-0 checkbox line, including plan-level entries, causing inflated phase counts (e.g., v1.0 showed 12 phases instead of 4).

## Fixes Applied

### Fix 1 — Filter PLAN.md lines
Added guard to skip lines where `rest` contains "PLAN.md" (case-insensitive). This filters the older `- [x] 01-01-PLAN.md — description` format used in v1.0/v1.1 ROADMAPs.

### Fix 2 — Filter NN-NN: plan-number format (deviation from plan)
Added additional guard to skip lines matching `^\d{2}-\d{2}[\s:-]`. This catches the plan-level entries in v3.1 Phase Details sections (e.g., `- [x] 07-01: Delete migrate.cjs...`) that don't contain "PLAN.md" but are still plan-level lines causing duplicates. The original plan only specified PLAN.md filtering, but inspection showed this second format was also present.

### Fix 3 — Strip markdown bold before numMatch
Added `const cleanRest = rest.replace(/\*\*/g, '').trim()` and applied `numMatch` to `cleanRest` instead of `rest`. This fixes phase number extraction for bold-formatted lines like `**Phase 17: Name**`.

### Fix 4 — Support decimal phase numbers
Updated `numMatch` regex from `(\d+)` to `(\d+(?:\.\d+)*)` to match decimal phase numbers like `16.1`, `3.2.1`, etc.

### Fix 5 — Deduplicate by phase number
Added deduplication block after the loop: keeps first occurrence of each phase number, always keeps null-number entries.

## Verification Results

All milestone ROADMAPs now return correct phase counts:

| Milestone | Before | After | Expected |
|-----------|--------|-------|----------|
| v1.0 | 12 | 4 | 4 |
| v1.1 | ~14 | 7 | 7 |
| v2.0 | ~12 | 6 | 6 |
| v3.0 | correct | 6 | 6 |
| v3.1 | 19 | 7 | 7 |
| v4.0 | correct | 7 | 7 |
| v5.0 | correct | 5 | 5 |

Phase numbers extracted correctly:
- v3.0: `3.1, 3.2, 3.2.1, 3.3, 3.4, 3.5` (decimal support working)
- v4.0: `12, 13, 14, 15, 16, 16.1, 16.2` (decimal support working)
- v5.0: `17, 18, 19, 20, 21` (bold-stripping working)

## Deviations

- Added a second plan-level filter (`/^\d{2}-\d{2}[\s:-]/`) not specified in the original plan. This was necessary to handle the `07-01:` plan-reference format found in v3.1 Phase Details sections. Without this, v3.1 showed 9 phases (7 real + 2 duplicates `07`/`08`). The deduplication safety net did not catch these because `"7"` and `"07"` are different strings.

## Files Modified

- `get-shit-done/bin/lib/server.cjs` — `parseRoadmapFile()` function (lines 69-107)
