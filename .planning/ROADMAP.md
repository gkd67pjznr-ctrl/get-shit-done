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

- [ ] **Phase 15: Integration Fixes** - Fix milestone-scoped path resolution bugs in `cmdInitPlanPhase` and roadmap commands
- [ ] **Phase 16: Core Debt Module** - DEBT.md schema, `debt.cjs` CLI commands, concurrent-safe writes
- [ ] **Phase 17: Migration Tool** - `migrate.cjs` with dry-run default, additive-only apply, and undo manifest
- [ ] **Phase 18: Agent Wiring** - Executor, verifier, and debugger auto-log discovered debt with quality-level gating
- [ ] **Phase 19: /gsd:fix-debt Skill** - On-demand orchestrator skill routing debt entries through diagnosis and fix execution

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
| 15. Integration Fixes | v3.0 | 0/? | Not started | - |
| 16. Core Debt Module | v3.0 | 0/? | Not started | - |
| 17. Migration Tool | v3.0 | 0/? | Not started | - |
| 18. Agent Wiring | v3.0 | 0/? | Not started | - |
| 19. /gsd:fix-debt Skill | v3.0 | 0/? | Not started | - |
