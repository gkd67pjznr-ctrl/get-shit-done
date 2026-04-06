---
phase: 90
plan: "02"
status: complete
subsystem: planning-intelligence
tags: [plan-indexer, cli, milestone-hook, staleness-detection]

requires:
  - phase: 90-01
    provides: buildIndex, refreshIndex, plan-indexer.cjs with TF-IDF builder

provides:
  - searchIndex(cwd, query) — reads pre-built index, warns on staleness
  - cmdPlanIndex(cwd, options, raw) — CLI handler for plan-index --rebuild
  - plan-index hook in cmdMilestoneComplete (auto-rebuilds on milestone complete)
  - gsd plan-index --rebuild CLI subcommand

affects: [91-similarity, 92-prompt-scoring, milestone-complete-workflow]

tech-stack:
  added: []
  patterns:
    - "Staleness detection: compare built_at against 14-day threshold at query time"
    - "Non-fatal hook pattern: try/catch wrapper around refreshIndex in cmdMilestoneComplete"
    - "CLI case pattern: follows mcp-classify case block style in gsd-tools.cjs"

key-files:
  created: []
  modified:
    - get-shit-done/bin/lib/plan-indexer.cjs
    - get-shit-done/bin/lib/milestone.cjs
    - get-shit-done/bin/gsd-tools.cjs
    - tests/plan-indexer.test.cjs

key-decisions:
  - "searchIndex never triggers a rebuild — read-only, warn-only for missing or stale index"
  - "Hook wrapped in try/catch: index rebuild failure must never abort milestone completion"
  - "Staleness threshold is 14 days (STALENESS_DAYS constant)"

patterns-established:
  - "Non-fatal hook pattern: try/catch around refreshIndex, failure silently ignored"
  - "stdout warning pattern: process.stdout.write for indexer warnings (not stderr)"

requirements-completed:
  - IDX-05
  - IDX-06

one-liner: "searchIndex with 14-day staleness detection, plan-index CLI subcommand, and auto-rebuild hook in cmdMilestoneComplete"

duration: 25min
completed: 2026-04-06
completed_at: "2026-04-06"
---

# Plan 90-02: Milestone-Complete Hook, CLI Subcommand, and Staleness Detection — Summary

**searchIndex with 14-day staleness detection, plan-index CLI subcommand, and auto-rebuild hook in cmdMilestoneComplete**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-04-06
- **Tasks:** 4
- **Files modified:** 4

## Accomplishments

- `searchIndex(cwd, query)` implemented — reads pre-built index, warns to stdout when missing or stale (>14 days)
- `cmdPlanIndex(cwd, options, raw)` implemented — handles `--rebuild` flag, outputs plan count and built_at
- `cmdMilestoneComplete` wired with try/catch hook: `refreshIndex(cwd)` fires as final step, failure never blocks completion
- `plan-index --rebuild` case added to gsd-tools.cjs switch router; `node gsd-tools.cjs plan-index --rebuild` exits 0 and writes plan-index.json (indexes 50 plans in current project)
- 5 new tests added (tests 12-16); all 16 plan-indexer tests pass; full suite: 1259 pass, 3 pre-existing failures (no regression)

## Task Commits

1. **Task 90-02-01: Extend plan-indexer.test.cjs with IDX-05 and IDX-06 stubs** - `e6e3cfc` (test)
2. **Task 90-02-02: Add searchIndex with staleness detection to plan-indexer.cjs** - `2d70960` (feat)
3. **Task 90-02-03: Add plan-index hook to cmdMilestoneComplete in milestone.cjs** - `b0db0ff` (feat)
4. **Task 90-02-04: Add plan-index case to gsd-tools.cjs switch router** - `93e8225` (feat)

## Files Created/Modified

- `get-shit-done/bin/lib/plan-indexer.cjs` — added `searchIndex`, `cmdPlanIndex`, `STALENESS_DAYS`; updated `module.exports`
- `get-shit-done/bin/lib/milestone.cjs` — added try/catch refreshIndex hook at end of `cmdMilestoneComplete`
- `get-shit-done/bin/gsd-tools.cjs` — added `plan-index` case in switch router; added usage comment entry
- `tests/plan-indexer.test.cjs` — updated import to include `refreshIndex, searchIndex`; appended 5 new tests

## Decisions Made

- `searchIndex` is read-only — never triggers a rebuild, consistent with the "no side effects at query time" principle
- Warnings go to `process.stdout.write` (not stderr) to match the existing indexer warning pattern established in `buildIndex`
- The `require('./plan-indexer.cjs')` inside the try/catch in milestone.cjs uses inline require to avoid circular dependency risk

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Phase 90 complete: plan-index.json is built, refreshed on milestone completion, queryable with staleness detection
- Phase 91 (similarity scorer) can now read `searchIndex` as its entry point and build cosine similarity on top of the TF-IDF vectors
- No blockers

---
*Phase: 90-plan-indexer-foundation*
*Completed: 2026-04-06*
