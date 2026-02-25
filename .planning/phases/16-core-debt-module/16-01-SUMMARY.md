---
phase: 16-core-debt-module
plan: 01
subsystem: infra
tags: [debt-tracking, markdown-table, fs-appendFileSync, cli-router, TDD]

requires: []
provides:
  - "get-shit-done/bin/lib/debt.cjs: cmdDebtLog, cmdDebtList, cmdDebtResolve + helpers"
  - "DEBT.md schema: 10-column markdown table at .planning/DEBT.md (TD-NNN auto-increment)"
  - "gsd-tools CLI: debt log/list/resolve subcommands fully routed"
  - "tests/debt.test.cjs: 19-test TDD suite covering all three commands and edge cases"
affects: [17-debt-migration, 18-debt-agent-wiring, 19-fix-debt-workflow]

tech-stack:
  added: []
  patterns:
    - "debt.cjs follows milestone.cjs module skeleton (CommonJS, output/error from core.cjs)"
    - "DEBT.md is project-level at .planning/DEBT.md — intentionally NOT milestone-scoped (source_phase/source_plan carry provenance)"
    - "fs.appendFileSync provides O_APPEND atomic writes for concurrent debt log calls"
    - "parseDebtRows: find header by '| id |', skip separator, split on '|' delimiters"
    - "getNextDebtId: TD-\\d+ regex self-filters separator row, no NaN risk"
    - "cmdDebtResolve: [^|]* per cell in regex (not .*) prevents cross-cell matching"

key-files:
  created:
    - get-shit-done/bin/lib/debt.cjs
    - tests/debt.test.cjs
  modified:
    - get-shit-done/bin/gsd-tools.cjs

key-decisions:
  - "DEBT.md is project-level (.planning/DEBT.md), not milestone-scoped — consistent with STATE.md v3.0 design decision; source_phase/source_plan fields carry provenance"
  - "debt log uses fs.appendFileSync (O_APPEND) for kernel-atomic single-row writes — no npm lock dependency"
  - "debt resolve uses [^|]* regex per cell to safely match rows with special chars in free-text fields"
  - "escapeRegex imported from core.cjs (confirmed exported) — no inline duplication"
  - "Type and severity fields accept any string — loose validation deferred to Phase 18 (WIRE-03)"

patterns-established:
  - "TDD RED/GREEN pattern: write failing tests first, commit as test(), implement to pass, commit as feat()"
  - "Pipe sanitization: sanitize = (v) => (v || '').replace(/\\|/g, '/') — all free-text fields before table insertion"
  - "Graceful empty: cmdDebtList returns { entries: [], total: 0 } when DEBT.md absent (not error exit)"

requirements-completed: [DEBT-01, DEBT-02, DEBT-03, DEBT-04]

duration: 2min
completed: 2026-02-25
---

# Phase 16 Plan 01: Core Debt Module Summary

**TDD-built tech debt tracking module: DEBT.md schema, debt log/list/resolve CLI commands, and full 19-test suite — all four DEBT requirements delivered in one atomic plan**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-25T16:52:49Z
- **Completed:** 2026-02-25T16:54:50Z
- **Tasks:** 1 (TDD: RED commit + GREEN commit)
- **Files modified:** 3

## Accomplishments

- Created `get-shit-done/bin/lib/debt.cjs` with `cmdDebtLog`, `cmdDebtList`, `cmdDebtResolve`, `getNextDebtId`, `parseDebtRows` — all four DEBT requirements (DEBT-01 through DEBT-04)
- Wrote `tests/debt.test.cjs` with 19 tests covering all three commands, all filter combinations, all error exits, and the separator-row edge case — 19/19 pass GREEN
- Updated `get-shit-done/bin/gsd-tools.cjs` with `require('./lib/debt.cjs')`, `case 'debt':` routing block, and JSDoc Debt Operations section
- Full regression: 255/259 tests pass (4 pre-existing failures in unrelated test files, unchanged from before)

## Task Commits

TDD execution with two atomic commits:

1. **RED phase: failing tests** - `294329d` (test)
2. **GREEN phase: implementation + wiring** - `5fac2a0` (feat)

_TDD plan type — two commits per plan cycle (test → feat)_

## Files Created/Modified

- `get-shit-done/bin/lib/debt.cjs` - Three commands + two private helpers. DEBT.md path hardcoded as project-level
- `tests/debt.test.cjs` - 19-test TDD suite, describe blocks per command, beforeEach/afterEach temp project lifecycle
- `get-shit-done/bin/gsd-tools.cjs` - Added debt require, case 'debt': router block, JSDoc Debt Operations section

## Decisions Made

- **DEBT.md is project-level** — hardcoded at `.planning/DEBT.md`, not milestone-scoped. Consistent with v3.0 STATE.md design decision. `source_phase`/`source_plan` fields carry provenance instead.
- **`escapeRegex` imported from `core.cjs`** — confirmed exported at line 432. No inline duplication needed.
- **`[^|]*` per cell in `cmdDebtResolve` regex** — prevents cross-cell matching when free-text fields contain special regex characters (per RESEARCH.md Pitfall 1).
- **Loose type/severity validation** — accept any string in `debt log`. Strict enum enforcement deferred to Phase 18 (WIRE-03 quality-gate integration).

## Deviations from Plan

None — plan executed exactly as written. Implementation followed the module skeleton, router case block, and helper patterns from RESEARCH.md verbatim.

## Issues Encountered

None. Pre-existing 4 test failures in `commands.test.cjs` and `init.test.cjs` are unrelated to this plan (check-patches and config-ensure-section features not yet implemented in those suites).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `debt.cjs` module is complete and all three CLI commands are routed correctly
- DEBT.md schema is established and tested — ready for Phase 17 (debt migration) and Phase 18 (agent wiring)
- `debt log/list/resolve` commands are usable immediately for manual debt tracking

---
*Phase: 16-core-debt-module*
*Completed: 2026-02-25*
