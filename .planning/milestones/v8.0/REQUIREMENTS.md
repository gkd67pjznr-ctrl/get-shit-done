# Requirements: GSD Enhanced Fork — v8.0

**Defined:** 2026-04-02
**Core Value:** Claude writes code like a senior engineer who always checks the codebase first, always reads the docs, always writes tests, and never takes shortcuts — enforced by the framework, not dependent on ad-hoc prompting.

## v8.0 Requirements

### Skill Feedback Loop

- [ ] **SKILL-01**: `analyze-patterns.cjs` runs automatically on a trigger (SessionStart hook or phase boundary)
- [ ] **SKILL-02**: `scan-state.json` is populated with watermark after analysis runs
- [ ] **SKILL-03**: Pending suggestions are surfaced at session start when `suggest_on_session_start: true`
- [ ] **SKILL-04**: Accepted suggestions modify the target SKILL.md file and commit the change
- [ ] **SKILL-05**: Dismissed suggestions are removed from `suggestions.json`
- [ ] **SKILL-06**: Full loop verified end-to-end: correction → pattern detected → suggestion generated → surfaced → skill refined → loaded in next session

### Quality Sentinel Gates

- [ ] **GATE-01**: Quality gates execute deterministically via hooks or wrappers (not agent instructions)
- [ ] **GATE-02**: Gate execution approach decided and implemented (hooks, orchestrator wrapper, or hybrid)
- [ ] **GATE-03**: Gate outcomes persist to `gate-executions.jsonl` with real execution data
- [ ] **GATE-04**: Gate execution respects quality level config (fast=skip, standard=warn, strict=block)
- [ ] **GATE-05**: Dashboard Gate Health page displays real gate execution data
- [ ] **GATE-06**: Running `/gsd:quick` produces verifiable gate execution entries

## Future Requirements

(None deferred — scope is focused on closing existing gaps)

## Out of Scope

| Feature | Reason |
|---------|--------|
| New observation categories or correction types | Existing 14 are sufficient |
| New quality gates beyond the 5 defined | Fix what exists first |
| Dashboard UI redesign | Just needs data flowing |
| Milestone-scoped layout changes | Working fine |
| GSD upstream compatibility | Fork-specific work |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SKILL-01 | Phase 33 | Pending |
| SKILL-02 | Phase 33 | Pending |
| SKILL-03 | Phase 33 | Pending |
| SKILL-04 | Phase 34 | Pending |
| SKILL-05 | Phase 34 | Pending |
| SKILL-06 | Phase 34 | Pending |
| GATE-01 | Phase 35 | Pending |
| GATE-02 | Phase 35 | Pending |
| GATE-03 | Phase 35 | Pending |
| GATE-04 | Phase 35 | Pending |
| GATE-05 | Phase 36 | Pending |
| GATE-06 | Phase 36 | Pending |

**Coverage:**
- v8.0 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-04-02*
*Last updated: 2026-04-02 after roadmap creation*
