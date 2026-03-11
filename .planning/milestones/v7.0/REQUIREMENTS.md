# Requirements: GSD Enhanced Fork — v7.0 Quality Enforcement Observability

**Defined:** 2026-03-10
**Core Value:** Claude writes code like a senior engineer who always checks the codebase first, always reads the docs, always writes tests, and never takes shortcuts — enforced by the framework, not dependent on ad-hoc prompting.

## v7.0 Requirements

Requirements for quality enforcement observability. Each maps to roadmap phases.

### Gate Persistence

- [x] **GATE-01**: Gate execution events written to `gate-executions.jsonl` during every executor run (5 sentinel steps persisted)
- [x] **GATE-02**: Quality level field added to correction entries in `corrections.jsonl`
- [x] **GATE-03**: Context7 invocations logged to `context7-calls.jsonl` with library, tokens requested vs cap, and usage flag
- [x] **GATE-04**: Research and evaluate additional MCP servers, tools, or libraries for quality gating beyond Context7

### Dashboard — Gate Health Page

- [x] **DASH-01**: Dedicated Gate Health page (standalone page like patterns page) with full gate metrics
- [x] **DASH-02**: Gate outcome distribution visualization (passed/warned/blocked/skipped rates)
- [x] **DASH-03**: Quality level usage distribution across sessions
- [x] **DASH-04**: Per-gate firing rates and warn rates
- [x] **DASH-05**: Context7 utilization metrics (calls, token usage, cap hits)

### Dashboard — Overview Integration

- [x] **DASH-06**: Quality level indicator on each project header in overview page
- [x] **DASH-07**: Gate firing rates shown in milestone line items
- [x] **DASH-08**: Gate metrics summary in tmux terminal session cards

### Analytics

- [ ] **ANLZ-01**: Gate-to-correction attribution analysis script (heuristic mapping from correction categories to gates)
- [ ] **ANLZ-02**: Attribution summary output to `gate-attribution.jsonl`

## Future Requirements

### v7.1 (deferred)

- **ANLZ-03**: Automated periodic attribution analysis (cron-based or session-boundary triggered)
- **ANLZ-04**: Quality level optimization recommendations based on accumulated gate/correction data
- **DASH-09**: Historical gate health trends (week-over-week comparison)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time gate blocking UI | Gate blocking is a config-level decision (strict mode), not a dashboard feature |
| Quality level auto-switching | Users must intentionally choose enforcement level; auto-switching undermines trust |
| Gate modification from dashboard | Dashboard is read-only; quality config changes go through `/gsd:set-quality` |
| Per-file gate coverage | Gate granularity is per-task, not per-file; file-level tracking adds complexity without value |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| GATE-01 | Phase 28 | Complete |
| GATE-02 | Phase 28 | Complete |
| GATE-03 | Phase 28 | Complete |
| GATE-04 | Phase 29 | Complete |
| DASH-01 | Phase 30 | Complete |
| DASH-02 | Phase 30 | Complete |
| DASH-03 | Phase 30 | Complete |
| DASH-04 | Phase 30 | Complete |
| DASH-05 | Phase 30 | Complete |
| DASH-06 | Phase 31 | Complete |
| DASH-07 | Phase 31 | Complete |
| DASH-08 | Phase 31 | Complete |
| ANLZ-01 | Phase 32 | Pending |
| ANLZ-02 | Phase 32 | Pending |

**Coverage:**
- v7.0 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 after roadmap creation*
