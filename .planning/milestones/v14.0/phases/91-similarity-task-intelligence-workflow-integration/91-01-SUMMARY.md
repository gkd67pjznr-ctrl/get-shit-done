---
phase: 91-similarity-task-intelligence-workflow-integration
plan: "01"
subsystem: plan-similarity
tags: [tfidf, cosine-similarity, jaccard, plan-index, similarity-scoring]

requires:
  - phase: 90-plan-indexer-foundation
    provides: plan-index.json schema with idf, plans, tfidf_vector, tokens, tags, task_pattern, age_weight, superseded_by

provides:
  - plan-similarity.cjs module with searchSimilarPlans, adaptSkeleton, cosineSimilarity, jaccardTokens
  - Hybrid TF-IDF cosine + Jaccard + tag_overlap scoring (weights 0.70/0.20/0.10)
  - Age-decay multiplier applied after composite formula
  - Superseded entry exclusion before scoring
  - adaptSkeleton for phase-plan prefix substitution in files_modified
  - Full SIM-01 through SIM-05 test coverage (8 passing tests)

affects:
  - 91-02 (plan-suggestions integration into plan-phase output)
  - 91-03 (init integration for plan_suggestions metadata)
  - Any phase that consumes similarity results for workflow integration

tech-stack:
  added: []
  patterns:
    - Read plan-index.json directly via fs.readFileSync rather than importing plan-indexer.cjs — avoids coupling
    - planningRoot(cwd, null) used to resolve index path (not milestone-scoped)
    - Hybrid scoring: composite = 0.70*tfidf + 0.20*jaccard + 0.10*tag_overlap, then * age_weight
    - inferTaskTypes and inferFilePatterns are best-effort inline keyword inference (no imports from plan-indexer)
    - Return [] on any error (try/catch entire body of searchSimilarPlans)

key-files:
  created:
    - get-shit-done/bin/lib/plan-similarity.cjs
    - tests/plan-similarity.test.cjs
  modified: []

key-decisions:
  - "Read plan-index.json directly (not via searchIndex) to access both plans and idf in one read, avoiding coupling"
  - "TASK_TYPE_KEYWORDS inlined in plan-similarity.cjs — not imported from plan-indexer.cjs"
  - "adaptSkeleton uses currentPhase string directly (not auto-inferred) for maximum flexibility at call site"

patterns-established:
  - "plan-similarity.cjs: all scoring functions are pure functions — no side effects, no I/O except loadIndex"
  - "Error boundary: entire searchSimilarPlans body wrapped in try/catch; module never throws to caller"

requirements-completed:
  - SIM-01
  - SIM-04
  - SIM-05

status: complete
completed_at: "2026-04-06"
duration: ~30min
---

# Plan 91-01: plan-similarity.cjs Summary

**TF-IDF cosine + Jaccard hybrid scorer reading plan-index.json directly, with age-decay, superseded exclusion, and skeleton adaptation — 8 tests covering SIM-01, SIM-04, SIM-05**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- `plan-similarity.cjs` implemented with 10 functions: loadIndex, tokenize, cosineSimilarity, jaccardTokens, inferTaskTypes, inferFilePatterns, adaptSkeleton, scoreEntry, buildQueryVec, searchSimilarPlans
- Hybrid formula exactly `0.70 * tfidf_cosine + 0.20 * jaccard + 0.10 * tag_overlap`, then multiplied by `age_weight`
- Superseded entries (where `superseded_by !== null`) excluded before scoring
- `adaptSkeleton` replaces `/\d{2}-\d{2}/` prefixes in files_modified paths
- 8 tests pass covering all required SIM-01, SIM-04, SIM-05 requirement groups
- No regressions: full suite 1275/1279 pass (4 pre-existing failures unchanged)

## Task Commits

1. **Task 91-01-01: Create test stubs** - `c3f51c2` (test)
2. **Task 91-01-02: Implement plan-similarity.cjs** - `76bff9b` (feat)
3. **Task 91-01-03: Fill in test implementations** - `4c647e8` (test)

## Files Created/Modified

- `get-shit-done/bin/lib/plan-similarity.cjs` - Hybrid scorer with searchSimilarPlans, adaptSkeleton, cosineSimilarity, jaccardTokens exports
- `tests/plan-similarity.test.cjs` - 8 tests covering hybrid formula weights, threshold gating, skeleton adaptation, superseded exclusion, age_weight decay

## Decisions Made

- Read `plan-index.json` directly via `JSON.parse(fs.readFileSync(...))` rather than importing `plan-indexer.cjs` — avoids coupling and matches documented pattern
- `TASK_TYPE_KEYWORDS` inlined verbatim from `plan-indexer.cjs` TASK_TYPE_PATTERNS — keeps modules decoupled
- `adaptSkeleton` accepts `currentPhase` as a plain string (not auto-inferred from cwd) for flexibility at the call site

## Deviations from Plan

None — plan executed exactly as written.

## Quality Gates

**Quality Level:** standard

| Task | Gate | Outcome | Detail |
|------|------|---------|--------|
| 01 | codebase_scan | passed | plan-indexer.cjs reviewed for tokenize/TASK_TYPE_PATTERNS patterns to inline |
| 02 | test_baseline | passed | 8 stubs failing with TODO — expected |
| 02 | test_gate | passed | module loads, exports 4 functions |
| 03 | test_gate | passed | 8/8 tests pass |
| 03 | diff_review | passed | no PLAN.md reads at runtime confirmed by code review |

**Summary:** 5 gates ran, 5 passed, 0 warned, 0 skipped, 0 blocked

## Issues Encountered

None.

## Next Phase Readiness

- `plan-similarity.cjs` is ready for use by phase 91 plans 02 and 03
- `searchSimilarPlans(cwd, { goal, limit, threshold })` is the primary API for downstream integration
- SIM-02 threshold integration tested inline; full integration with init/plan-phase is for 91-03

---
*Phase: 91-similarity-task-intelligence-workflow-integration*
*Completed: 2026-04-06*
