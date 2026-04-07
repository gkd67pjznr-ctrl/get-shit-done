# Requirements: GSD Enhanced Fork — v15.0 Autonomous Learning

**Defined:** 2026-04-04
**Core Value:** Claude writes code like a senior engineer who always checks the codebase first, always reads the docs, always writes tests, and never takes shortcuts — enforced by the framework, not dependent on ad-hoc prompting.

## v15.0 Requirements

Requirements for Autonomous Learning milestone. Each maps to roadmap phases.

### Learning Loop Automation

- [ ] **AUTO-01**: System auto-applies skill refinements when confidence > 0.95, <20% content change, no controversial flag, and auto_apply enabled
- [ ] **AUTO-02**: Auto-apply is opt-in via `adaptive_learning.auto_apply: false` config key with kill switch behavior
- [ ] **AUTO-03**: Every auto-applied change is logged to `auto-applied.jsonl` with before/after diff, confidence, source corrections, and reversal instructions
- [ ] **AUTO-04**: Maximum 1 auto-apply per skill per 7-day window (rate limiting)
- [ ] **AUTO-05**: Auto-apply skips high-performing skills (quality score "high" from skill-metrics.json)
- [ ] **AUTO-06**: User can revert an auto-applied change via `/gsd:refine-skill revert <id>`
- [ ] **AUTO-07**: Failed auto-apply checks surface the change as a normal manual suggestion

### Adaptive Code Review Profiles

- [ ] **REVP-01**: System generates per-project review profile from corrections.jsonl category distribution
- [ ] **REVP-02**: Review profile stored as `.planning/patterns/review-profile.json` with category weights and sample size
- [ ] **REVP-03**: Code-review skill reads review-profile.json and adjusts review focus for high-weight categories
- [ ] **REVP-04**: Profile requires minimum 10 corrections before generation (insufficient data guard)
- [ ] **REVP-05**: Profile refreshes at session start via session-start hook

### Decision Audit Trail

- [ ] **DAUD-01**: System parses Key Decisions table from PROJECT.md extracting decision text and rationale
- [ ] **DAUD-02**: System matches corrections against decision keywords using Jaccard token overlap
- [ ] **DAUD-03**: Tension flagged when 3+ corrections match a decision's keywords with confidence scoring
- [ ] **DAUD-04**: `/gsd:digest` surfaces decision tensions with evidence (which corrections, which decision, confidence)

## Future Requirements

None deferred — all features from MILESTONE-CONTEXT.md included in v15.0.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Per-skill auto-apply toggle | Global config sufficient for v15.0; per-skill override is future enhancement |
| CLAUDE.md decision auditing | CLAUDE.md conventions enforced by hooks, not by audit — PROJECT.md only for v15.0 |
| Write-path auto-apply (code changes) | Auto-apply limited to skill refinements only — code changes require human review |
| Real-time profile updates during session | Session-start refresh is sufficient; mid-session updates add complexity without clear value |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTO-01 | Phase 53 | Pending |
| AUTO-02 | Phase 53 | Pending |
| AUTO-03 | Phase 53 | Pending |
| AUTO-04 | Phase 53 | Pending |
| AUTO-05 | Phase 53 | Pending |
| AUTO-06 | Phase 54 | Pending |
| AUTO-07 | Phase 54 | Pending |
| REVP-01 | Phase 55 | Pending |
| REVP-02 | Phase 55 | Pending |
| REVP-03 | Phase 55 | Pending |
| REVP-04 | Phase 55 | Pending |
| REVP-05 | Phase 55 | Pending |
| DAUD-01 | Phase 56 | Pending |
| DAUD-02 | Phase 56 | Pending |
| DAUD-03 | Phase 56 | Pending |
| DAUD-04 | Phase 56 | Pending |

**Coverage:**
- v15.0 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-04*
*Last updated: 2026-04-04 after roadmap creation*
