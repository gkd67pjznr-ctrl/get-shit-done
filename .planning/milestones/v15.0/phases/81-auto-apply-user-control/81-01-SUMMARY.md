---
phase: 81-auto-apply-user-control
plan: "81-01"
subsystem: adaptive-learning
tags: [auto-apply, refine-skill, git-revert, suggestions, gate-enforcement]

requires:
  - phase: 80-auto-apply-safety-engine
    provides: auto-apply gates, audit log format (auto-applied.jsonl), runAutoApply()

provides:
  - revertAutoApply() function in refine-skill.cjs for undoing auto-applied changes via git revert
  - auto_apply_failed + failed_gate fields on gate-failed suggestions in suggestions.json
  - revert subcommand documented in /gsd:refine-skill command
  - 7 integration tests covering all revert error paths and gate-fail flag behavior

affects: [82-settings-toggle, any phase consuming refine-skill.cjs or auto-apply.cjs]

tech-stack:
  added: []
  patterns:
    - inline audit append (avoids circular dep with auto-apply.cjs)
    - hadGateFailure boolean + post-loop tmp-rename write-back
    - structured {ok, reason} return from all revert error paths

key-files:
  created:
    - tests/auto-apply-phase81.test.cjs
  modified:
    - .claude/hooks/lib/refine-skill.cjs
    - .claude/hooks/lib/auto-apply.cjs
    - .claude/commands/refine-skill.md

key-decisions:
  - "revertAutoApply appends audit entry inline rather than importing appendAuditEntry to avoid circular dependency"
  - "test file placed at tests/ (project convention) rather than src/tests/ (plan spec) — src/tests/ does not exist"
  - "hadGateFailure write-back runs once after loop, not per suggestion, to minimize I/O"

patterns-established:
  - "All revert error paths return {ok: false, reason: string} — never throw"
  - "suggestions.json write-back uses atomic tmp-rename pattern consistent with dismissSuggestion"

requirements-completed:
  - AUTO-06
  - AUTO-07

duration: 18min
completed: 2026-04-04
---

# Plan 81-01: Revert Subcommand and Failed-Check Surfacing Summary

**git-revert integration for auto-applied suggestions with gate-fail flags surfacing failed suggestions in manual review**

## Performance

- **Duration:** 18 min
- **Started:** 2026-04-04T~18:00Z
- **Completed:** 2026-04-04T~18:18Z
- **Tasks:** 4
- **Files modified:** 3 modified, 1 created

## Accomplishments

- Added `revertAutoApply()` to refine-skill.cjs: reads audit log, validates SHA, runs `git revert --no-edit`, appends reverted marker
- Extended auto-apply.cjs to flag gate-failed suggestions with `auto_apply_failed: true` and `failed_gate: '<gate>'`, writing back once after the loop
- Documented `/gsd:refine-skill revert <id>` with all five error reason codes in the command file
- 7 integration tests — all passing: 5 for revert error/happy paths, 2 for gate-fail flag behavior

## Task Commits

1. **Task 1: Implement revertAutoApply() and CLI** - `fa4343d` (feat)
2. **Task 2: Add auto_apply_failed flag and write-back** - `4c0b3db` (feat)
3. **Task 3: Extend /gsd:refine-skill with revert subcommand** - `dd6d847` (docs)
4. **Task 4: Integration tests** - `366cd6b` (test)

## Files Created/Modified

- `.claude/hooks/lib/refine-skill.cjs` — revertAutoApply() added, module.exports and CLI updated
- `.claude/hooks/lib/auto-apply.cjs` — hadGateFailure tracking, gate blocks flag suggestions, post-loop write-back
- `.claude/commands/refine-skill.md` — revert argument, step 8 with all error codes, success_criteria updated
- `tests/auto-apply-phase81.test.cjs` — 7 integration tests (new file)

## Decisions Made

- Inline audit append in revertAutoApply (no import from auto-apply.cjs) to avoid circular dependency — same data format as appendAuditEntry
- Test file placed at `tests/` matching project convention; `src/tests/` does not exist in this repo
- Write-back to suggestions.json happens once after the entire loop (not per suggestion) to keep I/O minimal

## Deviations from Plan

### Auto-fixed Issues

**1. Test file path deviation**
- **Found during:** Task 4 (writing integration tests)
- **Issue:** Plan specified `src/tests/auto-apply-phase81.test.cjs` but `src/tests/` does not exist; project uses `tests/` at root
- **Fix:** Created `tests/auto-apply-phase81.test.cjs` following established project convention
- **Files modified:** tests/auto-apply-phase81.test.cjs
- **Verification:** `node --test tests/auto-apply-phase81.test.cjs` — all 7 pass
- **Committed in:** 366cd6b

---

**Total deviations:** 1 auto-fixed (path correction)
**Impact on plan:** No scope change; test file is functionally equivalent and follows project conventions.

## Quality Gates

**Quality Level:** standard

| Task | Gate | Outcome | Detail |
|------|------|---------|--------|
| 1 | codebase_scan | passed | reviewed existing refine-skill.cjs and auto-apply.cjs before edits |
| 1 | test_baseline | passed | syntax check passed, exports verified |
| 1 | diff_review | passed | no appendAuditEntry import, all error paths return {ok,reason} |
| 2 | codebase_scan | passed | verified suggestion.status never mutated in gate blocks |
| 2 | test_gate | passed | hadGateFailure write-back confirmed outside loop via grep |
| 3 | diff_review | passed | all 5 error reason codes present, step numbering consistent |
| 4 | test_gate | passed | 7/7 tests pass including live git revert test |

**Summary:** 7 gates ran, 7 passed, 0 warned, 0 skipped, 0 blocked

## Issues Encountered

None.

## Next Phase Readiness

- revertAutoApply() available for Phase 82 (/gsd:settings auto_apply toggle)
- auto_apply_failed flags allow the settings toggle UI to show why suggestions are in manual review
- All requirements AUTO-06 and AUTO-07 satisfied

---
*Phase: 81-auto-apply-user-control*
*Completed: 2026-04-04*
