# Requirements: v3.0 Tech Debt System

**Defined:** 2026-02-25
**Core Value:** Claude writes code like a senior engineer who always checks the codebase first, always reads the docs, always writes tests, and never takes shortcuts — enforced by the framework, not dependent on ad-hoc prompting.

## Integration Fixes

- [x] **INTG-01**: `cmdInitPlanPhase` returns milestone-aware paths via `planningRoot()` instead of hardcoded `.planning/`
- [x] **INTG-02**: `cmdRoadmapGetPhase` and `cmdRoadmapAnalyze` respect `--milestone` flag for milestone-scoped ROADMAP.md

## Debt Tracking

- [x] **DEBT-01**: DEBT.md hub exists with structured entry format (TD-NNN IDs, 10 fields: id, type, severity, component, description, date_logged, logged_by, status, source_phase, source_plan)
- [x] **DEBT-02**: `gsd-tools debt log` command appends a new debt entry atomically (concurrent-safe via append-only writes)
- [x] **DEBT-03**: `gsd-tools debt list` command returns debt entries filtered by status, severity, or type (JSON output)
- [x] **DEBT-04**: `gsd-tools debt resolve` command transitions a debt entry's status (open → in-progress → resolved/deferred)

## Planning Directory Cleanup and GSD Flow Fixes

- [x] **CLEAN-01**: Orphaned/misplaced files in `.planning/milestones/` are normalized
- [x] **CLEAN-02**: Stale tracking files updated
- [x] **FLOW-01**: `cmdRoadmapUpdatePlanProgress` flips individual plan-level checkboxes when phase is complete
- [x] **FLOW-02**: `cmdMilestoneComplete` finalizes milestone workspace ROADMAP before archiving

## Agent Wiring

- [ ] **WIRE-01**: Executor agent auto-logs discovered debt via `debt log` when Quality Sentinel finds issues that can't be fixed in the current plan
- [x] **WIRE-02**: Verifier agent auto-logs unresolved quality dimension findings via `debt log`
- [x] **WIRE-03**: Debt logging is gated on quality level (fast=off, standard=critical/high only, strict=all severities)
- [x] **WIRE-04**: Debt entries include source phase and source plan provenance fields

## Debt Resolution

- [ ] **FIXD-01**: `/gsd:fix-debt` skill reads DEBT.md, selects an entry (by ID or priority), and routes through debugger agent for diagnosis
- [ ] **FIXD-02**: `/gsd:fix-debt` applies fix via plan execution, verifies result, and marks entry resolved

## Migration Tool

- [x] **MIGR-01**: `gsd-tools migrate --dry-run` inspects `.planning/` layout against current spec and reports what would change
- [x] **MIGR-02**: `gsd-tools migrate --apply` performs additive-only structural changes with undo manifest (never destructive)
- [x] **MIGR-03**: Migration is idempotent — running `--apply` multiple times produces the same result

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INTG-01 | Phase 3.1 | Complete |
| INTG-02 | Phase 3.1 | Complete |
| DEBT-01 | Phase 3.2 | Complete |
| DEBT-02 | Phase 3.2 | Complete |
| DEBT-03 | Phase 3.2 | Complete |
| DEBT-04 | Phase 3.2 | Complete |
| CLEAN-01 | Phase 3.2.1 | Complete |
| CLEAN-02 | Phase 3.2.1 | Complete |
| FLOW-01 | Phase 3.2.1 | Complete |
| FLOW-02 | Phase 3.2.1 | Complete |
| MIGR-01 | Phase 3.3 | Complete |
| MIGR-02 | Phase 3.3 | Complete |
| MIGR-03 | Phase 3.3 | Complete |
| WIRE-01 | Phase 3.4 | Pending |
| WIRE-02 | Phase 3.4 | Complete |
| WIRE-03 | Phase 3.4 | Complete |
| WIRE-04 | Phase 3.4 | Complete |
| FIXD-01 | Phase 3.5 | Pending |
| FIXD-02 | Phase 3.5 | Pending |

---
*Last updated: 2026-02-26*
