---
phase: 09-milestone-workspace-initialization
plan: 01
subsystem: milestone
tags: [milestone, workspace, conflict-manifest, filesystem, tdd]

# Dependency graph
requires: []
provides:
  - cmdMilestoneNewWorkspace exported from milestone.cjs — creates .planning/milestones/<version>/ directory tree with scaffold files and conflict.json
  - cmdMilestoneUpdateManifest exported from milestone.cjs — merges file lists into conflict.json files_touched with deduplication
  - Integration tests in milestone.test.cjs covering all workspace and manifest behaviors
affects: [09-02-PLAN.md, any plan that routes milestone new-workspace or update-manifest CLI commands]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Child process pattern for testing functions that call process.exit (spawnSync with inline -e script)"
    - "Idempotency via fs.existsSync guard before each writeFileSync"
    - "Set deduplication for merge: [...new Set([...existing, ...incoming])]"

key-files:
  created:
    - tests/milestone.test.cjs (extended with 10 new tests)
  modified:
    - get-shit-done/bin/lib/milestone.cjs (added cmdMilestoneNewWorkspace, cmdMilestoneUpdateManifest, updated module.exports)

key-decisions:
  - "Tests use spawnSync child process pattern because output() and error() both call process.exit() — direct invocation kills test runner"
  - "conflict.json stored as pretty-printed JSON (2-space indent) for human readability"
  - "workspace_dir in output result is absolute path to enable downstream consumers to locate workspace"

patterns-established:
  - "Child process pattern: spawnSync(process.execPath, ['-e', script]) for testing functions with process.exit"
  - "Idempotency guard: if (!fs.existsSync(path)) { fs.writeFileSync(...) } for all scaffold files"

requirements-completed: [WKSP-01, CNFL-01]

# Metrics
duration: 4min
completed: 2026-02-24
---

# Phase 09 Plan 01: Milestone Workspace Scaffold and Conflict Manifest Summary

**cmdMilestoneNewWorkspace creates isolated .planning/milestones/<version>/ workspace trees; cmdMilestoneUpdateManifest tracks file changes in conflict.json with Set deduplication**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-24T13:03:52Z
- **Completed:** 2026-02-24T13:07:43Z
- **Tasks:** 2 (RED + GREEN TDD)
- **Files modified:** 2

## Accomplishments

- cmdMilestoneNewWorkspace creates full workspace directory tree (phases/, research/, STATE.md, ROADMAP.md, REQUIREMENTS.md, conflict.json) with idempotency
- conflict.json initialized with version, created_at, status "active", and empty files_touched array
- cmdMilestoneUpdateManifest merges file lists into conflict.json with Set deduplication and accumulation across multiple calls
- Both functions exported from milestone.cjs; 12/12 tests pass (2 existing + 10 new)

## Task Commits

Each task was committed atomically:

1. **RED: Add failing tests** - `0beda4b` (test)
2. **GREEN: Implement functions + fix test approach** - `97bd44f` (feat)

_Note: TDD tasks committed as test → feat_

## Files Created/Modified

- `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/milestone.cjs` - Added cmdMilestoneNewWorkspace, cmdMilestoneUpdateManifest, updated module.exports
- `/Users/tmac/Projects/gsdup/tests/milestone.test.cjs` - Added 10 new integration tests using child process pattern

## Decisions Made

- Tests use `spawnSync` child process pattern (inline -e script) because both `output()` and `error()` call `process.exit()`, which would kill the test runner if called directly in a `beforeEach` or `test` callback.
- conflict.json uses 2-space pretty-print for human readability in workspace directories.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rewrote tests from direct function calls to child process invocation**
- **Found during:** GREEN phase (running tests after implementation)
- **Issue:** Plan suggested calling functions directly, but `output()` ends with `process.exit(0)` — calling functions inline caused the test process to exit after the first beforeEach call, giving false positives (0 failures, 1 test instead of 12)
- **Fix:** Replaced direct `milestone.cmdMilestoneNewWorkspace(...)` calls with `spawnSync(process.execPath, ['-e', script])` helpers; error tests check exit code and stderr instead of using assert.throws
- **Files modified:** tests/milestone.test.cjs
- **Verification:** `node --test tests/milestone.test.cjs` reports `# tests 12` `# pass 12` `# fail 0`
- **Committed in:** `97bd44f` (GREEN phase commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — silent test failure due to process.exit)
**Impact on plan:** Fix necessary for test correctness. Tests now validate all behaviors including error cases with proper exit code assertions.

## Issues Encountered

- Initial test structure using direct function calls silently passed (process exited with 0, test runner reported 0 failures). Discovered by checking `# tests 1` vs expected `# tests 12`. Fixed by switching to child process pattern.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Both functions exported and tested — ready for Plan 02 to wire them into the CLI router (gsd-tools.cjs command dispatch)
- conflict.json schema established: `{ version, created_at, status, files_touched[] }`
- No blockers

---
*Phase: 09-milestone-workspace-initialization*
*Completed: 2026-02-24*
