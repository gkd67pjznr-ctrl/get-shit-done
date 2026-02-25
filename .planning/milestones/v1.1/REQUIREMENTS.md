# Requirements Archive: v1.1 Quality UX

**Archived:** 2026-02-24
**Status:** SHIPPED

For current requirements, see `.planning/REQUIREMENTS.md`.

---

# Requirements: GSD Enhanced Fork

**Defined:** 2026-02-23
**Core Value:** Claude writes code like a senior engineer who always checks the codebase first, always reads the docs, always writes tests, and never takes shortcuts — enforced by the framework, not dependent on ad-hoc prompting.

## v1.1 Requirements

Requirements for v1.1 Quality UX. Each maps to roadmap phases.

### Quality Config

- [x] **QCFG-01**: User can run `/gsd:set-quality` to set quality.level (fast/standard/strict) for current project
- [x] **QCFG-02**: Any GSD command auto-adds missing `quality` config block with appropriate default when not present
- [x] **QCFG-03**: `~/.gsd/defaults.json` stores global defaults that new projects inherit during config initialization
- [x] **QCFG-04**: User can set global defaults via `/gsd:set-quality --global` (writes to `~/.gsd/defaults.json`)

### Quality Observability

- [x] **QOBS-01**: SUMMARY.md includes a "Quality Gates" section showing what checks ran and their outcomes
- [x] **QOBS-02**: `/gsd:progress` output displays current `quality.level` for the project
- [x] **QOBS-03**: Config validation warns when required sections are missing instead of silently falling back

### Infrastructure

- [x] **INFR-01**: Context7 per-query token cap is configurable via `quality.context7_token_cap` in config
- [x] **INFR-02**: `/gsd:help` shows `/gsd:reapply-patches` reminder at top when patches exist to reapply

## Future Requirements

### Milestone Isolation (v2.0)

- **MISO-01**: Each milestone gets its own directory with self-contained ROADMAP.md, STATE.md, REQUIREMENTS.md
- **MISO-02**: PROJECT.md stays at `.planning/` root as shared context across milestones
- **MISO-03**: User can plan milestone B while milestone A is executing without file conflicts
- **MISO-04**: Concurrent milestone execution with milestone-scoped phase numbering
- **MISO-05**: All GSD commands can discern which milestone and phase are being referenced

## Out of Scope

| Feature | Reason |
|---------|--------|
| Rewriting GSD core workflow | v1.0 decision — this is an upgrade, not a rewrite |
| Milestone folder restructuring | Deferred to v2.0 — requires deep architecture changes |
| New quality gate types (security, a11y) | Beyond current scope — focus on making existing gates usable |
| Custom quality rules | Premature — need to validate existing gates work first |
| Quality dashboard/reporting UI | CLI-only project — text output is sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| QCFG-01 | Phase 6 | Complete |
| QCFG-02 | Phase 5 | Complete |
| QCFG-03 | Phase 5 | Complete |
| QCFG-04 | Phase 6 | Complete |
| QOBS-01 | Phase 7 | Complete |
| QOBS-02 | Phase 6 | Complete |
| QOBS-03 | Phase 5 | Complete |
| INFR-01 | Phase 5 | Complete |
| INFR-02 | Phase 6 | Complete |

**Coverage:**
- v1.1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0

---
*Requirements defined: 2026-02-23*
*Last updated: 2026-02-23 after v1.1 roadmap creation*
