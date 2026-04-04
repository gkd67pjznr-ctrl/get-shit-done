---
phase: 80-auto-apply-safety-engine
plan: "01"
subsystem: hooks
tags: [auto-apply, safety-gates, skill-refinement, audit-log, jsonl]

# Dependency graph
requires:
  - phase: refine-skill
    provides: acceptSuggestion() for the actual apply flow; synchronous commit convention
  - phase: skill-metrics
    provides: skill-metrics.json with pre-computed attribution_confidence labels
provides:
  - runAutoApply({ cwd }) — five-gate safety engine for autonomous skill refinement
  - auto-applied.jsonl — append-only audit log with applied/skipped entries
affects:
  - 80-02 (SessionEnd hook wiring that calls runAutoApply)
  - future skill refinement automation

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Five-gate fail-fast pipeline (CONFIG -> RATE -> QUALITY -> CONFIDENCE -> SIZE)
    - Silent failure convention — module catches all exceptions, returns summary object
    - Fail-open quality gate — missing metrics file does not block suggestions
    - JSONL append audit log with reversal_instructions per applied entry

key-files:
  created:
    - .claude/hooks/lib/auto-apply.cjs

key-decisions:
  - "Use pre-computed attribution_confidence from skill-metrics.json rather than calling computeAttributionConfidence() directly, since skill-metrics.cjs does not export that function"
  - "Quality gate fails open when skill-metrics.json is missing or skill not found — avoids blocking suggestions when metrics haven't been computed yet"
  - "Gate ordering: CONFIG checked globally before looping, then RATE/QUALITY/CONFIDENCE/SIZE per suggestion — cheapest checks first"

patterns-established:
  - "Gate pipeline: each gate returns { pass: boolean, reason?, ...extra } — uniform interface"
  - "Audit entry shape: action, suggestion_id, skill, gate (skipped only), reason (skipped), commit_sha+before_diff+reversal_instructions (applied)"

requirements-completed:
  - AUTO-01
  - AUTO-02
  - AUTO-04
  - AUTO-05

# Metrics
duration: 25min
completed: 2026-04-04
---

# Plan 80-01: Auto-Apply Engine — Core Module with Five Safety Gates

**CommonJS auto-apply engine with CONFIG, RATE (7-day), QUALITY (attribution confidence), CONFIDENCE (>0.95, non-controversial), and SIZE (<20%) safety gates writing a full audit trail to auto-applied.jsonl**

## Performance

- **Duration:** 25 min
- **Started:** 2026-04-04T13:10:00Z
- **Completed:** 2026-04-04T13:35:00Z
- **Tasks:** 4 (all implemented in a single file pass)
- **Files modified:** 1 created

## Accomplishments
- Implemented all five safety gates in fail-fast order with correct semantics
- Audit log writes skipped entries (with gate name) and applied entries (with commit_sha, before_diff, reversal_instructions)
- Full end-to-end test confirmed: suggestion passing all gates gets applied and produces audit entry with all required fields
- Silent failure convention respected throughout — module never throws

## Task Commits

1. **Tasks T1-T4 (all gates + audit writer)** - `a16808d` (feat(hooks): add auto-apply safety engine with five ordered gates)

## Files Created/Modified
- `.claude/hooks/lib/auto-apply.cjs` — Auto-apply engine with five safety gates, audit log writer, and runAutoApply() export

## Decisions Made
- `computeAttributionConfidence` is not exported from `skill-metrics.cjs` — read the pre-computed `attribution_confidence` field from `skill-metrics.json` directly, with an inline fallback using the same thresholds (sessionCount >= 10 && correctionCount > 0 => 'high')
- Gate ordering kept as specified: CONFIG checked before the suggestion loop (applies to all); remaining four gates checked per suggestion

## Deviations from Plan

### Auto-fixed Issues

**1. [Missing export] computeAttributionConfidence not exported from skill-metrics.cjs**
- **Found during:** Task T2 (QUALITY gate implementation)
- **Issue:** Plan referenced `computeAttributionConfidence()` from `skill-metrics.cjs` but the module only exports `cmdSkillMetricsCompute` and `cmdSkillMetricsShow`
- **Fix:** Used pre-computed `attribution_confidence` field from skill-metrics.json; inlined the same threshold logic as a fallback for when the field is absent
- **Files modified:** .claude/hooks/lib/auto-apply.cjs
- **Verification:** Quality gate correctly blocks 'high' confidence skills and passes when metrics file is missing
- **Committed in:** a16808d (plan commit)

---

**Total deviations:** 1 auto-fixed (missing export — adapted to use pre-computed field)
**Impact on plan:** No scope change. The pre-computed field is more efficient and the inline fallback preserves correct behavior.

## Quality Gates

**Quality Level:** standard

| Task | Gate | Outcome | Detail |
|------|------|---------|--------|
| T1-T4 | codebase_scan | passed | refine-skill.cjs and skill-metrics.cjs read before implementation |
| T1-T4 | context7_lookup | skipped | no external libraries used |
| T1-T4 | test_baseline | skipped | no existing tests for this new module |
| T1-T4 | test_gate | passed | all plan verification snippets ran and passed |
| T1-T4 | diff_review | passed | clean implementation, no leftover debug code |

**Summary:** 5 gates ran, 3 passed, 0 warned, 2 skipped, 0 blocked

## Issues Encountered
None.

## Next Phase Readiness
- auto-apply.cjs is ready for Plan 80-02 to wire it into the SessionEnd hook (gsd-analyze-patterns.cjs)
- No blockers

---
*Phase: 80-auto-apply-safety-engine*
*Completed: 2026-04-04*
