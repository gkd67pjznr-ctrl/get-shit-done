---
phase: 25-observer-agent-and-suggestion-pipeline
plan: "01"
subsystem: adaptive-learning
tags: [observer, suggestions, corrections, patterns, guardrails, bounded-learning]

# Dependency graph
requires:
  - phase: 22-correction-capture-hook
    provides: write-correction.cjs with readCorrections()
  - phase: 23-preference-tracking
    provides: write-preference.cjs with readPreferences()
provides:
  - analyze-patterns.cjs CJS library with analyzePatterns() observer engine
  - suggestions.json atomic write pipeline with guardrails
  - CATEGORY_SKILL_MAP linking taxonomy categories to target skills
affects:
  - phase-26 (suggestion review UI or command)
  - any consumer of suggestions.json

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD Wave 0 — test scaffold written first, implementation written second
    - Atomic file write via tmp + rename for suggestions.json
    - Cross-scope aggregation groups by category, ignoring scope
    - Watermark pattern using last_analyzed_at to avoid re-processing

key-files:
  created:
    - tests/hooks/analyze-patterns.test.ts
    - .claude/hooks/lib/analyze-patterns.cjs
  modified: []

key-decisions:
  - "CATEGORY_SKILL_MAP is a top-level constant that maps all 14 correction taxonomy categories to target skill names"
  - "Cross-scope aggregation: corrections grouped by category only (scope ignored), so 3 corrections in 3 different scopes still trigger one suggestion"
  - "Active preference dedup uses category:scope colon-separated key — same pattern as Phase 24 hook"
  - "Retired preferences do NOT block suggestion creation — only active (retired_at === null) preferences block"
  - "require() for write-correction.cjs and write-preference.cjs placed inside main function body to allow isolated unit testing"
  - "generateSuggestionId uses epoch seconds + zero-padded counter (001, 002...) for uniqueness within document"

patterns-established:
  - "Observer engine pattern: read-filter-aggregate-guardrail-write cycle for suggestions"
  - "Guardrail check returns { pass: boolean, reason?, cooldown_expires? } object"
  - "autoDismissExpired mutates in place before new suggestion processing"
  - "suggestions.json document shape: { metadata: { last_analyzed_at, version, skipped_suggestions[] }, suggestions[] }"

requirements-completed:
  - OBSV-01
  - OBSV-02
  - OBSV-03

# Metrics
duration: 15min
completed: 2026-03-10
---

# Plan 25-01: analyze-patterns.cjs Core Library and Tests

**Deterministic observer engine that reads corrections, aggregates cross-scope patterns by category, enforces bounded-learning guardrails, and writes suggestions.json atomically**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-10T21:30:00Z
- **Completed:** 2026-03-10T21:45:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created 23-test Vitest scaffold for analyze-patterns.cjs covering all describe blocks from the plan
- Implemented analyzePatterns() observer engine with cross-scope aggregation, watermark filtering, dedup against active preferences, 3-correction threshold, 7-day cooldown, 30-day auto-dismiss, and atomic writes
- All 23 tests pass with zero regressions in the full test suite

## Task Commits

Each task was committed atomically:

1. **Task 1: Create test scaffold for analyze-patterns** - `86dc622` (test)
2. **Task 2: Implement analyze-patterns.cjs** - `44c7885` (feat)

## Files Created/Modified

- `tests/hooks/analyze-patterns.test.ts` - Full 23-test TDD scaffold with helpers, 8 describe blocks
- `.claude/hooks/lib/analyze-patterns.cjs` - Observer engine: getSuggestionsConfig, loadSuggestions, writeSuggestionsAtomic, generateSuggestionId, summarizeScopes, checkGuardrails, autoDismissExpired, analyzePatterns

## Decisions Made

- Cross-scope aggregation groups corrections by `diagnosis_category` ignoring scope — so patterns that span multiple files still count toward a single suggestion
- `require()` for write-correction.cjs and write-preference.cjs placed inside the main `analyzePatterns()` function body (not at module top level) — allows isolated unit testing with partial module environments without crashes
- Retired preferences (retired_at truthy) do NOT block suggestion generation — only active preferences (retired_at === null) are in the dedup set
- `generateSuggestionId` uses epoch seconds + zero-padded counter loop to guarantee uniqueness within the current document on the same second

## Deviations from Plan

None — plan executed exactly as written.

## Quality Gates

**Quality Level:** standard

| Task | Gate | Outcome | Detail |
|------|------|---------|--------|
| 1 | codebase_scan | passed | preference-tracking.test.ts used as structural reference |
| 1 | test_baseline | passed | 38 pre-existing vitest failures, 0 new failures |
| 1 | test_gate | passed | file parses, produces module-not-found failures as expected |
| 1 | diff_review | passed | clean test scaffold matching plan spec |
| 2 | codebase_scan | passed | write-correction.cjs and write-preference.cjs patterns reused |
| 2 | test_baseline | passed | 38 vitest test file failures (pre-existing), no new failures |
| 2 | test_gate | passed | all 23 tests pass |
| 2 | diff_review | passed | implementation matches plan spec exactly |

**Summary:** 8 gates ran, 8 passed, 0 warned, 0 skipped, 0 blocked

## Issues Encountered

None.

## Next Phase Readiness

- `analyze-patterns.cjs` is fully functional and ready to be wired into a hook or CLI command
- `suggestions.json` schema is stable — consumers can read it via the documented document shape
- OBSV-01, OBSV-02, OBSV-03 requirements satisfied — phase 25 can proceed to plan 25-02 if planned

---
*Phase: 25-observer-agent-and-suggestion-pipeline*
*Completed: 2026-03-10*
