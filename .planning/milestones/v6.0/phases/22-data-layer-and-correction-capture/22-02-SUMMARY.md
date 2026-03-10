---
phase: "22"
plan: "02"
status: complete
commit: 924ad16
duration_min: 20
---

# Summary: Plan 22-02 — PostToolUse Hook for Edit and Revert Detection

## What Was Built

Three artifacts produced and committed in one atomic commit (924ad16):

1. `.claude/hooks/gsd-correction-capture.js` — PostToolUse hook that implements:
   - **Edit detection**: Records every file Claude writes (Write/Edit tools) to a session tracking file at `/tmp/gsd-session-{session_id}-files.json`. On each subsequent tool call, scans all tracked files for mtime/size changes not caused by the current Claude write. Fires a `process.convention_violation` correction entry when an external edit is found.
   - **Revert detection**: Matches Bash tool commands against four git revert patterns (`git revert`, `git reset --hard`, `git checkout --`, `git restore`). Fires a `process.regression` correction entry when matched.
   - **State reading**: `getCurrentPhaseAndMilestone()` reads the active milestone's STATE.md, extracting the phase integer and milestone string for tagging correction entries.
   - **Silent failure**: Entire script body is wrapped in try/catch; always exits 0.

2. `.claude/settings.json` — Added PostToolUse entry with `matcher: "Write|Edit|Bash"` and `timeout: 5`. Placed after the existing `phase-boundary-check.sh` entry to preserve ordering.

3. `tests/hooks/correction-capture.test.ts` — Appended 3 new Vitest suites (7 test cases):
   - Revert detection (3 cases): git revert fires, git reset --hard fires, non-revert bash does not fire
   - Edit detection (2 cases): Write tool records file to tracking JSON, external mtime change triggers edit_detection entry
   - Silent failure (2 cases): malformed stdin exits 0, empty stdin exits 0

## Verification

- `vitest run tests/hooks/correction-capture.test.ts`: 24/24 tests pass (17 from 22-01 + 7 new)
- `npm test`: 956 pass, 2 fail (pre-existing failures: config-get, parseTmuxOutput)
- Hook exits 0 with all stdin variations

## Deviations

None. Plan was followed as specified.

## Key Insight Applied

PostToolUse fires after Claude's own tool use, not after user actions. Edit detection therefore works indirectly: record what Claude wrote, then check on future tool calls whether those files changed externally. This is the correct architectural interpretation from RESEARCH.md.
