# Requirements: GSD Enhanced Fork

**Defined:** 2026-02-25
**Core Value:** Claude writes code like a senior engineer who always checks the codebase first, always reads the docs, always writes tests, and never takes shortcuts — enforced by the framework, not dependent on ad-hoc prompting.

## v3.0 Requirements

Requirements for v3.0 Tech Debt System. Each maps to roadmap phases.

### Integration Fixes

- [x] **INTG-01**: `cmdInitPlanPhase` returns milestone-aware paths via `planningRoot()` instead of hardcoded `.planning/`
- [x] **INTG-02**: `cmdRoadmapGetPhase` and `cmdRoadmapAnalyze` respect `--milestone` flag for milestone-scoped ROADMAP.md

### Debt Tracking

- [ ] **DEBT-01**: DEBT.md hub exists with structured entry format (TD-NNN IDs, 10 fields: id, type, severity, component, description, date_logged, logged_by, status, source_phase, source_plan)
- [ ] **DEBT-02**: `gsd-tools debt log` command appends a new debt entry atomically (concurrent-safe via append-only writes)
- [ ] **DEBT-03**: `gsd-tools debt list` command returns debt entries filtered by status, severity, or type (JSON output)
- [ ] **DEBT-04**: `gsd-tools debt resolve` command transitions a debt entry's status (open → in-progress → resolved/deferred)

### Agent Wiring

- [ ] **WIRE-01**: Executor agent auto-logs discovered debt via `debt log` when Quality Sentinel finds issues that can't be fixed in the current plan
- [ ] **WIRE-02**: Verifier agent auto-logs unresolved quality dimension findings via `debt log`
- [ ] **WIRE-03**: Debt logging is gated on quality level (fast=off, standard=critical/high only, strict=all severities)
- [ ] **WIRE-04**: Debt entries include source phase and source plan provenance fields

### Debt Resolution

- [ ] **FIXD-01**: `/gsd:fix-debt` skill reads DEBT.md, selects an entry (by ID or priority), and routes through debugger agent for diagnosis
- [ ] **FIXD-02**: `/gsd:fix-debt` applies fix via plan execution, verifies result, and marks entry resolved

### Migration Tool

- [ ] **MIGR-01**: `gsd-tools migrate --dry-run` inspects `.planning/` layout against current spec and reports what would change
- [ ] **MIGR-02**: `gsd-tools migrate --apply` performs additive-only structural changes with undo manifest (never destructive)
- [ ] **MIGR-03**: Migration is idempotent — running `--apply` multiple times produces the same result

## Future Requirements

Deferred to v3.x after validation. Tracked but not in current roadmap.

### Observability

- **OBSV-01**: Debt metrics (open/resolved counts) displayed in `/gsd:progress` output
- **OBSV-02**: Debt pruning command (`debt-archive`) moves resolved entries to DEBT-ARCHIVE.md

### Planner Integration

- **PLAN-01**: Planner reads DEBT.md for open items related to phase components before writing tasks

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Automatic debt prioritization/scoring | Auto-scores create false confidence; filter by severity/category instead |
| Real-time debt dashboard / web UI | GSD is file-based, no daemon processes; `/gsd:progress` shows counts inline |
| Debt estimation and burndown tracking | Effort estimation for debt is unreliable; resolution_plan text field is sufficient |
| Automatic debt resolution without human review | All code changes go through plan→execute→verify with human in the loop |
| Debt sync to external systems (Jira, Linear) | DEBT.md is already version-controlled and searchable; no sync infrastructure needed |
| Per-milestone DEBT.md isolation | Debt is project-level cross-cutting; entries carry source_phase for provenance |
| Destructive migration (delete old files) | Additive only; old files stay until human explicitly deletes after verification |
| Agent Teams integration | Concurrent milestones solved multi-session parallelism; Agent Teams adds complexity for unclear value |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INTG-01 | Phase 15 | Complete |
| INTG-02 | Phase 15 | Complete |
| DEBT-01 | Phase 16 | Pending |
| DEBT-02 | Phase 16 | Pending |
| DEBT-03 | Phase 16 | Pending |
| DEBT-04 | Phase 16 | Pending |
| MIGR-01 | Phase 17 | Pending |
| MIGR-02 | Phase 17 | Pending |
| MIGR-03 | Phase 17 | Pending |
| WIRE-01 | Phase 18 | Pending |
| WIRE-02 | Phase 18 | Pending |
| WIRE-03 | Phase 18 | Pending |
| WIRE-04 | Phase 18 | Pending |
| FIXD-01 | Phase 19 | Pending |
| FIXD-02 | Phase 19 | Pending |

**Coverage:**
- v3.0 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after roadmap creation*
