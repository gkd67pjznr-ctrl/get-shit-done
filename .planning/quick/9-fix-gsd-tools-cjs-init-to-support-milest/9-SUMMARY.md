---
phase: quick-9
plan: "01"
subsystem: core
tags: [bug-fix, milestone-detection, tdd, version-sort]
dependency_graph:
  requires: []
  provides: [detectLayoutStyle-directory-fallback, compareVersions-helper, resolveActiveMilestone-numeric-sort]
  affects: [init-plan-phase, init-execute-phase, init-phase-op, init-verify-work]
tech_stack:
  added: []
  patterns: [directory-based-detection, numeric-version-comparison]
key_files:
  created: []
  modified:
    - get-shit-done/bin/lib/core.cjs
    - tests/core.test.cjs
    - tests/routing.test.cjs
    - tests/init.test.cjs
decisions:
  - "Use hasValidConfig flag (set after successful JSON.parse) to distinguish invalid-config from missing-config, preserving original uninitialized return value for invalid JSON"
  - "Export compareVersions for testability; place before resolveActiveMilestone in module"
  - "Directory-based fallback requires STATE.md presence (not just a dir) to avoid false positives from empty version directories"
metrics:
  duration: "~8 minutes"
  completed: "2026-03-02"
  tasks_completed: 3
  files_modified: 4
---

# Quick Task 9: Fix gsd-tools.cjs init to support milestone-scoped layout without concurrent flag

**One-liner:** Fixed `detectLayoutStyle()` to detect milestone workspaces via directory presence and `resolveActiveMilestone()` to sort versions numerically, enabling init commands to work in projects created via the `new-milestone` workflow.

## Objective

The `new-milestone` workflow creates `.planning/milestones/<version>/` directories but never sets `concurrent: true` in `config.json` (only `migrate.cjs` does). This caused `detectLayoutStyle()` to return `'legacy'` even when milestones exist, making all init commands return `phase_found: false` and null paths.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write failing tests for all three bugs (RED) | 97837bb | tests/core.test.cjs, tests/routing.test.cjs |
| 2 | Fix detectLayoutStyle and resolveActiveMilestone (GREEN) | 4524bb7 | get-shit-done/bin/lib/core.cjs |
| 3 | Integration tests for init plan-phase/execute-phase without concurrent flag | e0d31a0 | tests/init.test.cjs |

## Implementation

### Fix 1: detectLayoutStyle() — Directory-based fallback

Added a two-phase approach:
1. Try config.json — if `concurrent === true`, return 'milestone-scoped' immediately (existing behavior)
2. If config absent or `concurrent` not true, check `.planning/milestones/vX.Y/STATE.md` existence
3. Return based on `hasValidConfig` flag (set only after successful JSON.parse, avoiding the invalid-JSON edge case)

Key design decision: `hasValidConfig` is set AFTER `JSON.parse` succeeds, so invalid JSON (which catches) leaves it `false` and returns `'uninitialized'` — preserving the existing test expectation.

### Fix 2: compareVersions() + resolveActiveMilestone() — Numeric sort

Created `compareVersions(a, b)` helper that splits version strings by `.`, converts to Number, and compares part-by-part. Replaced all three `.sort()` calls in `resolveActiveMilestone` with `.sort(compareVersions)`. Exported `compareVersions` for testability.

## Test Coverage

- **Before:** 58 tests in core.test.cjs + routing.test.cjs, 276 in full suite (343 total with init.test.cjs)
- **RED phase:** 64 tests (58 + 6 new), 4 failing — confirmed bugs
- **GREEN phase:** 64 tests, 64 passing — bugs fixed
- **After Task 3:** 343 tests, 343 passing, 0 failures

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] hasValidConfig flag positioning**
- **Found during:** Task 2 (GREEN)
- **Issue:** Initial implementation set `hasConfig = true` before `JSON.parse()`, causing invalid-JSON to return `'legacy'` instead of `'uninitialized'` — broke existing test "returns uninitialized when config.json contains invalid JSON"
- **Fix:** Renamed to `hasValidConfig`, moved flag assignment AFTER the `JSON.parse()` call so only successfully-parsed configs set it
- **Files modified:** get-shit-done/bin/lib/core.cjs
- **Commit:** 4524bb7 (second attempt in same commit)

## Issues Encountered

None beyond the auto-fixed deviation above.

## Smoke Test

```
node get-shit-done/bin/gsd-tools.cjs init plan-phase 3.1 --raw
→ phase_found: True, layout_style: milestone-scoped, milestone_scope: v3.1
```

The gsdup project itself (which uses milestone-scoped layout with `concurrent: true`) continues to work correctly. The fix is additive — existing behavior is unchanged, only the fallback path is new.

## Self-Check: PASSED

- [x] get-shit-done/bin/lib/core.cjs — modified, exists on disk
- [x] tests/core.test.cjs — modified, exists on disk
- [x] tests/routing.test.cjs — modified, exists on disk
- [x] tests/init.test.cjs — modified, exists on disk
- [x] Commit 97837bb — verified in git log
- [x] Commit 4524bb7 — verified in git log
- [x] Commit e0d31a0 — verified in git log
- [x] Full test suite: 343 pass, 0 fail
