# Roadmap: GSD Enhanced Fork

## Milestones

- [x] **v1.0 MVP** — Phases 1-4 (shipped 2026-02-24)
- [x] **v1.1 Quality UX** — Phases 5-7 (shipped 2026-02-24)
- [ ] **v2.0 Concurrent Milestones** — Phases 8-13 (in progress)

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

### v2.0 Concurrent Milestones (In Progress)

**Milestone Goal:** Enable multiple milestones to execute in parallel across separate Claude Code sessions with isolated workspaces, conflict awareness, and a compatibility layer for existing projects.

- [x] **Phase 8: Path Architecture Foundation** - Central path resolver and CLI flag parsing — the dependency every other phase is built on (completed 2026-02-24)
  **Plans:** 2 plans
  **Requirements:** [PATH-01, PATH-02, PATH-03, PATH-04]
  Plans:
  - [ ] 08-01-PLAN.md — TDD planningRoot, detectLayoutStyle, and is_last_phase bug fix
  - [ ] 08-02-PLAN.md — --milestone CLI flag parsing and init command wiring
### Phase 9: Milestone Workspace Initialization
**Goal:** Enable `new-milestone` to create isolated workspace directories with all required scaffold files, and define the conflict manifest format for cross-milestone overlap detection.
**Depends on:** Phase 8 (path architecture)
**Requirements:** [WKSP-01, WKSP-02, WKSP-03, WKSP-04, CNFL-01]
**Plans:** 2/2 plans complete
Plans:
- [ ] 09-01-PLAN.md — TDD cmdMilestoneNewWorkspace and cmdMilestoneUpdateManifest
- [ ] 09-02-PLAN.md — CLI routing, complete-milestone extension, and init layout_style

### Phase 10: Compatibility Layer
Legacy project detection and permanent zero-migration old-style support
- [ ] **Phase 11: Dashboard and Conflict Detection** - Live multi-milestone dashboard and advisory overlap detection
- [ ] **Phase 12: Full Routing Update** - All workflows, commands, and phase numbering updated to be milestone-aware
- [ ] **Phase 13: Test Coverage** - New test helpers, branch coverage on new functions, and end-to-end verification

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
| 8. Path Architecture Foundation | 2/2 | Complete   | 2026-02-24 | - |
| 9. Milestone Workspace Initialization | 2/2 | Complete   | 2026-02-24 | - |
| 10. Compatibility Layer | v2.0 | 0/? | Not started | - |
| 11. Dashboard and Conflict Detection | v2.0 | 0/? | Not started | - |
| 12. Full Routing Update | v2.0 | 0/? | Not started | - |
| 13. Test Coverage | v2.0 | 0/? | Not started | - |
