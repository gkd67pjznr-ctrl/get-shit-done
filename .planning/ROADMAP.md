# Roadmap: GSD Enhanced Fork

## Milestones

- [x] **v1.0 MVP** — Phases 1-4 (shipped 2026-02-24)
- [x] **v1.1 Quality UX** — Phases 5-7 (shipped 2026-02-24)
- [x] **v2.0 Concurrent Milestones** — Phases 8-14 (shipped 2026-02-25)
- [ ] **v3.0 Tech Debt System** — Phases 15-19 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-4) — SHIPPED 2026-02-24</summary>

- [x] Phase 1: Foundation (2/2 plans) — completed 2026-02-23
- [x] Phase 2: Executor Sentinel (3/3 plans) — completed 2026-02-23
- [x] Phase 3: Quality Dimensions (2/2 plans) — completed 2026-02-23
- [x] Phase 4: Wire Quality Scan Handoff (1/1 plan) — completed 2026-02-24

</details>

<details>
<summary>v1.1 Quality UX (Phases 5-7) — SHIPPED 2026-02-24</summary>

- [x] Phase 5: Config Foundation (2/2 plans) — completed 2026-02-24
- [x] Phase 6: Commands and UX (2/2 plans) — completed 2026-02-24
- [x] Phase 7: Quality Observability (1/1 plan) — completed 2026-02-24

</details>

<details>
<summary>v2.0 Concurrent Milestones (Phases 8-14) — SHIPPED 2026-02-25</summary>

- [x] Phase 8: Path Architecture Foundation (2/2 plans) — completed 2026-02-24
- [x] Phase 9: Milestone Workspace Initialization (2/2 plans) — completed 2026-02-24
- [x] Phase 10: Compatibility Layer (1/1 plan) — completed 2026-02-24
- [x] Phase 11: Dashboard and Conflict Detection (3/3 plans) — completed 2026-02-24
- [x] Phase 12: Full Routing Update (2/2 plans) — completed 2026-02-24
- [x] Phase 13: Test Coverage (2/2 plans) — completed 2026-02-25
- [x] Phase 14: Integration Wiring Fix (1/1 plan) — completed 2026-02-25

</details>

### v3.0 Tech Debt System (In Progress)

**Milestone Goal:** Build infrastructure for systematic tech debt tracking and resolution, plus a project migration tool for existing `.planning/` folders.

- [x] **Phase 15: Integration Fixes** - Fix milestone-scoped path resolution bugs in `cmdInitPlanPhase` and roadmap commands (completed 2026-02-25)
- [ ] **Phase 16: Core Debt Module** - DEBT.md schema, `debt.cjs` CLI commands, concurrent-safe writes
- [ ] **Phase 17: Migration Tool** - `migrate.cjs` with dry-run default, additive-only apply, and undo manifest
- [ ] **Phase 18: Agent Wiring** - Executor, verifier, and debugger auto-log discovered debt with quality-level gating
- [ ] **Phase 19: /gsd:fix-debt Skill** - On-demand orchestrator skill routing debt entries through diagnosis and fix execution

### Phase 15: Integration Fixes

**Goal:** Fix milestone-scoped path resolution bugs so that `cmdInitPlanPhase` and roadmap commands work correctly with milestone-scoped layouts.

**Requirements:** INTG-01, INTG-02

**Scope:**
- `cmdInitPlanPhase` returns milestone-aware paths via `planningRoot()` instead of hardcoded `.planning/`
- `cmdRoadmapGetPhase` and `cmdRoadmapAnalyze` respect `--milestone` flag for milestone-scoped ROADMAP.md

**Plans:** 1/1 plans complete

Plans:
- [ ] 15-01-PLAN.md — Fix milestone-scoped path resolution in init and roadmap commands with regression tests

### Phase 16: Core Debt Module

**Goal:** Create the DEBT.md schema and `debt.cjs` CLI commands for structured tech debt tracking with concurrent-safe writes.

**Requirements:** DEBT-01, DEBT-02, DEBT-03, DEBT-04

**Scope:**
- DEBT.md hub with structured entry format (TD-NNN IDs, 10 fields)
- `gsd-tools debt log` command for atomic append
- `gsd-tools debt list` command with filtering (JSON output)
- `gsd-tools debt resolve` command for status transitions

### Phase 17: Migration Tool

**Goal:** Build `migrate.cjs` that inspects and upgrades existing `.planning/` folders with dry-run default, additive-only apply, and undo manifest.

**Requirements:** MIGR-01, MIGR-02, MIGR-03

**Scope:**
- `gsd-tools migrate --dry-run` inspects layout and reports changes
- `gsd-tools migrate --apply` performs additive-only structural changes with undo manifest
- Idempotent — running `--apply` multiple times produces same result

### Phase 18: Agent Wiring

**Goal:** Wire executor, verifier, and debugger agents to auto-log discovered debt with quality-level gating.

**Requirements:** WIRE-01, WIRE-02, WIRE-03, WIRE-04

**Scope:**
- Executor auto-logs debt when Quality Sentinel finds unfixable issues
- Verifier auto-logs unresolved quality dimension findings
- Debt logging gated on quality level (fast=off, standard=critical/high, strict=all)
- Entries include source phase and plan provenance

### Phase 19: /gsd:fix-debt Skill

**Goal:** Create on-demand orchestrator skill that routes debt entries through diagnosis and fix execution.

**Requirements:** FIXD-01, FIXD-02

**Scope:**
- Skill reads DEBT.md, selects entry by ID or priority, routes through debugger
- Applies fix via plan execution, verifies result, marks entry resolved

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-02-23 |
| 2. Executor Sentinel | v1.0 | 3/3 | Complete | 2026-02-23 |
| 3. Quality Dimensions | v1.0 | 2/2 | Complete | 2026-02-23 |
| 4. Wire Quality Scan Handoff | v1.0 | 1/1 | Complete | 2026-02-24 |
| 5. Config Foundation | v1.1 | 2/2 | Complete | 2026-02-24 |
| 6. Commands and UX | v1.1 | 2/2 | Complete | 2026-02-24 |
| 7. Quality Observability | v1.1 | 1/1 | Complete | 2026-02-24 |
| 8. Path Architecture Foundation | v2.0 | 2/2 | Complete | 2026-02-24 |
| 9. Milestone Workspace Initialization | v2.0 | 2/2 | Complete | 2026-02-24 |
| 10. Compatibility Layer | v2.0 | 1/1 | Complete | 2026-02-24 |
| 11. Dashboard and Conflict Detection | v2.0 | 3/3 | Complete | 2026-02-24 |
| 12. Full Routing Update | v2.0 | 2/2 | Complete | 2026-02-24 |
| 13. Test Coverage | v2.0 | 2/2 | Complete | 2026-02-25 |
| 14. Integration Wiring Fix | v2.0 | 1/1 | Complete | 2026-02-25 |
| 15. Integration Fixes | 1/1 | Complete    | 2026-02-25 | - |
| 16. Core Debt Module | v3.0 | 0/? | Not started | - |
| 17. Migration Tool | v3.0 | 0/? | Not started | - |
| 18. Agent Wiring | v3.0 | 0/? | Not started | - |
| 19. /gsd:fix-debt Skill | v3.0 | 0/? | Not started | - |
