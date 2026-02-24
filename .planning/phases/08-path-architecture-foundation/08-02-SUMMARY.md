---
phase: 08-path-architecture-foundation
plan: 02
subsystem: cli
tags: [milestone-flag, cli-parsing, init-commands, integration-tests]

requires:
  - "08-01 — planningRoot(cwd, milestoneScope) from core.cjs"
provides:
  - "--milestone global flag parsed in gsd-tools.cjs main() before command routing"
  - "milestoneScope threaded to cmdInitExecutePhase and cmdInitPlanPhase"
  - "milestone_scope and planning_root fields in init command JSON output"
  - "6 integration tests for --milestone flag parsing and init command wiring"
affects:
  - "09-milestone-workspace-initialization"
  - "12-command-routing"
  - "13-e2e-validation"

tech-stack:
  added: []
  patterns:
    - "--milestone flag parsing: copy of --cwd pattern (space form + equals form + missing value guard)"
    - "milestoneScope threaded as last positional param to avoid breaking existing callers"
    - "runGsdToolsFull used for error-case tests (captures stderr on non-zero exit)"

key-files:
  created:
    - tests/init.test.cjs (new tests appended to existing file)
  modified:
    - get-shit-done/bin/gsd-tools.cjs
    - get-shit-done/bin/lib/init.cjs

key-decisions:
  - "--milestone parsing uses same pattern as --cwd: space form (args.splice(milestoneIdx, 2)) and equals form (args.splice(indexOf, 1)), both strip flag before const command = args[0]"
  - "Missing value guard triggers only when next arg starts with '--' or is absent — not on plain words (consistent with --cwd behavior)"
  - "milestoneScope added as last parameter to cmdInitExecutePhase and cmdInitPlanPhase — existing callers unaffected"
  - "Error test uses '--milestone' with no following arg (triggers !value branch) rather than '--milestone --raw' (--raw is stripped first)"

patterns-established:
  - "Global flags (--cwd, --raw, --milestone) must all be parsed before const command = args[0]"
  - "milestoneScope=null is the default — all callers passing undefined/null get legacy .planning/ path from planningRoot"

requirements-completed: [PATH-03]

duration: 2min
completed: 2026-02-24
---

# Phase 8 Plan 02: --milestone CLI Flag Parsing Summary

**--milestone global flag parsed in gsd-tools.cjs main(), threaded to init execute-phase and plan-phase commands as milestoneScope, with milestone_scope and planning_root fields in JSON output and 6 passing integration tests**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-24T11:55:49Z
- **Completed:** 2026-02-24T11:57:51Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added `--milestone` flag parsing to `gsd-tools.cjs` main() following the exact `--cwd` pattern (space form + equals form + missing value guard), placed before `const command = args[0]`
- Threaded `milestoneScope` to `cmdInitExecutePhase` and `cmdInitPlanPhase` in the init routing block
- Added `planningRoot` to init.cjs destructured require from core.cjs
- Updated both init function signatures to accept `milestoneScope` as last param
- Added `milestone_scope` and `planning_root` fields to both init command JSON outputs
- Added 6 integration tests to `tests/init.test.cjs` — all pass, 3 pre-existing failures unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Parse --milestone flag in gsd-tools.cjs and thread to init commands** - `43327eb` (feat)
2. **Task 2: Integration tests for --milestone flag and init command wiring** - `d886815` (test)

## Files Created/Modified
- `get-shit-done/bin/gsd-tools.cjs` — Added --milestone flag parsing block after --raw, before command routing; updated execute-phase and plan-phase routing to pass milestoneScope
- `get-shit-done/bin/lib/init.cjs` — Added planningRoot to import; updated cmdInitExecutePhase and cmdInitPlanPhase signatures and result objects
- `tests/init.test.cjs` — Added 6-test describe block for PATH-03 milestone flag parsing

## Decisions Made
- `--milestone` parsing uses the exact same pattern as `--cwd` (the plan's designated template)
- Missing value guard checks `!value || value.startsWith('--')` — consistent with `--cwd` behavior; plain words are valid values
- `milestoneScope` added as the last positional parameter so all existing callers (other init subcommands) continue to work unchanged
- Error case test uses `--milestone` with no following argument (the `!value` branch) — using `--milestone --raw ...` doesn't work because `--raw` is stripped from args before `--milestone` is parsed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Error test adjusted to trigger correct missing-value branch**
- **Found during:** Task 2
- **Issue:** Plan specified `--milestone init plan-phase 1 --raw` as the error test input, but `init` is a plain word so the guard `!value || value.startsWith('--')` does not trigger — milestoneScope gets set to 'init' and command becomes 'plan-phase', producing "Unknown command: plan-phase" instead of the expected error
- **Fix:** Changed test to use `--milestone` with no following argument, which triggers the `!value` branch and produces "Missing value for --milestone"
- **Files modified:** tests/init.test.cjs
- **Commit:** d886815 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Test input corrected to match actual CLI behavior. Same error condition is still tested. No scope change.

## Issues Encountered
- Pre-existing failures: 3 tests in `config quality section` and `config auto-migration` suites fail due to `standard` vs `fast` default value mismatch — present in baseline before this plan, not caused by these changes

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `gsd-tools.cjs --milestone v2.0 init execute-phase <phase>` returns `milestone_scope: "v2.0"` and milestone-scoped `planning_root`
- `gsd-tools.cjs --milestone v2.0 init plan-phase <phase>` same behavior
- Phase 09 (milestone workspace initialization) can use `--milestone` flag to scope all init commands to the milestone path
- Phase 12 (command routing) will extend `milestoneScope` threading to remaining init subcommands

---
*Phase: 08-path-architecture-foundation*
*Completed: 2026-02-24*
