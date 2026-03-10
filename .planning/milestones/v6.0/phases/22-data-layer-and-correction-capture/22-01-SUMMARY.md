---
phase: 22-data-layer-and-correction-capture
plan: "01"
subsystem: data-layer
tags: [correction-capture, jsonl, rotation, retention, cjs, vitest]

# Dependency graph
requires: []
provides:
  - write-correction.cjs shared library with require() and CLI invocation APIs
  - JSONL rotation at max_entries with dated archive naming (collision-safe)
  - Retention cleanup of archives older than retention_days on each rotation
  - Taxonomy validation against 14-category two-tier correction taxonomy
  - Token cap validation (word-count proxy: >100 words rejects)
  - Vitest test suite with 17 test cases covering CAPT-03 and CAPT-04 behaviors
affects:
  - 22-02 (edit-based detection — requires write-correction.cjs)
  - 22-03 (self-report — requires write-correction.cjs and CLI invocation)
  - 22-04 (revert detection — requires write-correction.cjs)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CJS library (module.exports) for require()-able hook utilities"
    - "Silent failure pattern — never throw, always return { written, reason }"
    - "CLI dual-mode: require.main === module guard for CLI vs library use"
    - "Word-count proxy for token estimation (split on whitespace)"

key-files:
  created:
    - .claude/hooks/lib/write-correction.cjs
    - tests/hooks/correction-capture.test.ts
  modified: []

key-decisions:
  - "Used git add -f for .claude/hooks/lib/write-correction.cjs because .claude/ is in .gitignore — the file is source code (not generated) and must be tracked"
  - "rotateFile() receives retentionDays parameter from writeCorrection() caller — avoids re-reading config inside rotation helper"
  - "validateEntry() checks diagnosis_category against a hardcoded Set of 14 values — fast O(1) lookup, no external dependency"

patterns-established:
  - "CJS module in .claude/hooks/lib/ for shared hook utilities requiring require() compatibility"
  - "Silent failure: all errors caught, returned as { written: false, reason, error } — never thrown"
  - "Taxonomy enforcement at write time — rejects unknown categories before persisting"

requirements-completed:
  - CAPT-03
  - CAPT-04

# Metrics
duration: 15min
completed: 2026-03-10
---

# Phase 22 Plan 01: Correction Write Library and JSONL Rotation Summary

**Shared JSONL write library for correction capture with taxonomy validation, silent failure, rotation at 1000 entries, and retention cleanup — plus 17 Vitest tests proving all behaviors**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-10T02:30:00Z
- **Completed:** 2026-03-10T02:45:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Created `.claude/hooks/lib/write-correction.cjs` — the foundational write path all three correction channels (self-report, edit detection, revert detection) will call
- Implemented taxonomy validation against all 14 categories, token cap validation (100-word proxy), field truncation, JSONL rotation with collision-safe archive naming, and retention cleanup
- Created `tests/hooks/correction-capture.test.ts` with 17 Vitest cases covering every CAPT-03 and CAPT-04 behavior; all pass

## Task Commits

All tasks collapsed into one atomic commit per plan instructions:

1. **Tasks 1-3: write-correction library, tests, and full suite verification** - `bbc2017` (feat)

## Files Created/Modified
- `.claude/hooks/lib/write-correction.cjs` - Shared correction write library with require() and CLI invocation APIs
- `tests/hooks/correction-capture.test.ts` - Vitest test suite, 17 test cases

## Decisions Made
- Used `git add -f` to force-add `.claude/hooks/lib/write-correction.cjs` since `.claude/` is in `.gitignore`. The library is source code that plans 22-02 and 22-03 depend on — it must be tracked.
- `rotateFile()` receives `retentionDays` from the outer `writeCorrection()` call rather than re-reading config, avoiding redundant I/O on the hot path.
- Taxonomy enforced via a hardcoded `Set` of 14 values — O(1) lookup, no external dependency, easy to update when taxonomy changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Gitignore bypass] .claude/ directory is gitignored**
- **Found during:** Task 3 (commit)
- **Issue:** `git add .claude/hooks/lib/write-correction.cjs` rejected because `.gitignore` contains `.claude/`
- **Fix:** Used `git add -f` to force-add the file. The library is required source code, not a generated artifact.
- **Files modified:** none additional
- **Verification:** File appears in commit `bbc2017`
- **Committed in:** `bbc2017`

---

**Total deviations:** 1 auto-fixed (gitignore bypass)
**Impact on plan:** Required for correctness — downstream plans 22-02 and 22-03 need this file committed.

## Quality Gates

**Quality Level:** standard

| Task | Gate | Outcome | Detail |
|------|------|---------|--------|
| 1 | codebase_scan | passed | Reviewed gsd-snapshot-session.js and schema.ts before writing |
| 1 | context7_lookup | skipped | No external library queries needed — pure Node.js stdlib |
| 1 | test_baseline | passed | 956/958 passing (2 pre-existing failures in config and tmux) |
| 2 | test_gate | passed | 17/17 Vitest tests pass |
| 3 | diff_review | passed | Clean diff, no unintended changes |

**Summary:** 5 gates ran, 4 passed, 0 warned, 1 skipped, 0 blocked

## Issues Encountered
None beyond the gitignore deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `writeCorrection()` is exported and fully tested — plans 22-02 (edit detection) and 22-03 (self-report) can `require()` it immediately
- CLI invocation is ready for plan 22-03's self-report skill to call `node write-correction.cjs '<json>' '<cwd>'`
- No blockers

---
*Phase: 22-data-layer-and-correction-capture*
*Completed: 2026-03-10*
