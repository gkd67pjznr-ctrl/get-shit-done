---
phase: 27-cross-project-inheritance-and-skill-loading
plan: "01"
subsystem: patterns
tags: [cross-project, preferences, promotion, user-level, gsd-home]

# Dependency graph
requires:
  - phase: 23-preference-promotion-library
    provides: write-preference.cjs with checkAndPromote() and upsertPreference()
provides:
  - promote-preference.cjs with promoteToUserLevel() and readUserPreferences()
  - Cross-project preference promotion at ~/.gsd/preferences.json (PREF-03)
  - Wiring in checkAndPromote() with silent failure guard
affects:
  - 27-02 (LOAD-01 workflow loading will read user-level preferences)
  - Any phase reading ~/.gsd/ directory

# Tech tracking
tech-stack:
  added: []
  patterns:
    - GSD_HOME env var for test-isolated user-level file writes (established in init.cjs, extended here)
    - Atomic tmp+rename write for user-level JSON file
    - Silent failure try/catch guard for non-critical cross-project promotion calls

key-files:
  created:
    - .claude/hooks/lib/promote-preference.cjs
    - tests/hooks/promote-preference.test.ts
  modified:
    - .claude/hooks/lib/write-preference.cjs
    - tests/hooks/preference-tracking.test.ts

key-decisions:
  - "Project ID = path.basename(cwd) — acceptable for v6.0, machine-dependent limitation documented"
  - "promoteToUserLevel wrapped in try/catch in checkAndPromote — never breaks project-level writes"
  - "User-level store uses JSON (not JSONL) — read-heavy aggregated file suits single JSON doc"
  - "GSD_HOME env var resolves gsd home at call time — module stateless, tests set env before calling"

patterns-established:
  - "Pattern: require('./promote-preference.cjs') inside try/catch in write-preference.cjs — circular dependency prevention and graceful degradation"
  - "Pattern: test isolation via process.env.GSD_HOME = tmpDir in beforeEach, delete in afterEach"

requirements-completed:
  - PREF-03

# Metrics
duration: 15min
completed: 2026-03-11
---

# Phase 27-01: Cross-Project Preference Promotion Library Summary

**promoteToUserLevel() tracks same category+scope preferences across projects, promoting to ~/.gsd/preferences.json when 3+ distinct projects contribute the same pattern (PREF-03)**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-11T10:40:00Z
- **Completed:** 2026-03-11T10:55:00Z
- **Tasks:** 4
- **Files modified:** 4

## Accomplishments
- New `promote-preference.cjs` module with `promoteToUserLevel()` and `readUserPreferences()` exports
- Atomic writes to `~/.gsd/preferences.json` with mkdirSync for missing directory and tmp+rename
- GSD_HOME env var override for full test isolation — no writes to real user directory during tests
- `checkAndPromote()` in `write-preference.cjs` wired to call `promoteToUserLevel()` with silent failure guard
- 12 unit tests in `promote-preference.test.ts`, 2 wiring tests appended to `preference-tracking.test.ts`
- All 159 hooks tests pass, full suite 973/975 (2 pre-existing config quality failures)

## Task Commits

All tasks combined into one atomic commit:

1. **Tasks 27-01-01 through 27-01-04** - `25e987f` (feat: add cross-project preference promotion via promote-preference.cjs)

## Files Created/Modified
- `.claude/hooks/lib/promote-preference.cjs` - New module: promoteToUserLevel(), readUserPreferences(), atomic JSON writes to GSD_HOME
- `tests/hooks/promote-preference.test.ts` - Unit tests: 12 tests covering all behaviors
- `.claude/hooks/lib/write-preference.cjs` - Added promoteToUserLevel call after upsertPreference with try/catch guard
- `tests/hooks/preference-tracking.test.ts` - Added 2 wiring tests in "checkAndPromote cross-project wiring" describe block

## Decisions Made
- Project ID uses `path.basename(cwd)` — simple, matches dashboard convention, machine-dependent limitation accepted for v6.0
- `require('./promote-preference.cjs')` is inside the try/catch block in `checkAndPromote` — prevents module load errors from propagating
- User-level store is JSON (not JSONL) since it is read-heavy and aggregated; project-level is JSONL since it is append-heavy

## Deviations from Plan

None - plan executed exactly as written.

## Quality Gates

**Quality Level:** standard

| Task | Gate | Outcome | Detail |
|------|------|---------|--------|
| 01 | codebase_scan | passed | GSD_HOME pattern confirmed in init.cjs, atomic write pattern confirmed in write-preference.cjs |
| 01 | test_baseline | passed | 147 hooks tests passing before changes |
| 01 | test_gate | passed | 12 new unit tests all green |
| 01 | diff_review | passed | clean implementation matching research spec |
| 02 | test_gate | passed | 12/12 promote-preference tests green |
| 03 | test_gate | passed | 25/25 preference-tracking tests green (2 new wiring tests) |
| 04 | test_gate | passed | 159 hooks tests, 973/975 full suite (2 pre-existing failures) |

**Summary:** 7 gates ran, 7 passed, 0 warned, 0 skipped, 0 blocked

## Issues Encountered
None.

## Next Phase Readiness
- PREF-03 complete — cross-project promotion library available
- Plan 27-02 (LOAD-01: workflow learned context loading) can proceed
- `~/.gsd/preferences.json` will be created on first cross-project promotion

---
*Phase: 27-cross-project-inheritance-and-skill-loading*
*Completed: 2026-03-11*
