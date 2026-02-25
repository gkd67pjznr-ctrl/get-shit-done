# Roadmap: GSD Enhanced Fork

## Milestones

- [x] **v1.0 MVP** — Phases 1-4 (shipped 2026-02-24)
- [x] **v1.1 Quality UX** — Phases 5-7 (shipped 2026-02-24)
- [ ] **v2.0 Concurrent Milestones** — Phases 8-14 (in progress)

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
**Goal:** Expose layout_style detection in phase-execution init commands and prove three-state compatibility (uninitialized, legacy, milestone-scoped) with comprehensive tests, ensuring old-style projects work unchanged without migration.
**Depends on:** Phase 8 (path architecture — detectLayoutStyle and planningRoot)
**Requirements:** [COMPAT-01, COMPAT-02, COMPAT-03]
**Plans:** 1/1 plans complete
Plans:
- [ ] 10-01-PLAN.md — Add layout_style to init commands, test helpers, and three-state compatibility tests

### Phase 11: Dashboard and Conflict Detection
**Goal:** Live multi-milestone dashboard showing progress across all active milestones, plus advisory overlap detection that warns when milestones touch the same files.
**Depends on:** Phase 9 (milestone workspaces with conflict.json), Phase 10 (compatibility layer for old-style graceful degrade)
**Requirements:** [DASH-01, DASH-02, DASH-03, DASH-04, CNFL-02, CNFL-03, CNFL-04]
**Plans:** 3/3 plans complete
Plans:
- [ ] 11-01-PLAN.md — TDD cmdMilestoneWriteStatus and cmdManifestCheck in milestone.cjs
- [ ] 11-02-PLAN.md — cmdProgressRenderMulti, CLI routing, and new-milestone workflow update
- [ ] 11-03-PLAN.md — Wire milestone write-status into execute-phase and plan-phase workflows at checkpoints

### Phase 12: Full Routing Update
**Goal:** All workflows, commands, and phase numbering updated to be milestone-aware — `--milestone` flag threaded through every gsd-tools.cjs call, phase numbering resets per milestone, and canonical path variable glossary committed.
**Depends on:** Phase 8 (path architecture), Phase 11 (dashboard for progress routing)
**Requirements:** [ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04, ROUTE-05, PHASE-01, PHASE-02, PHASE-03, TEAM-01]
**Plans:** 2/2 plans complete
Plans:
- [ ] 12-01-PLAN.md — Thread milestoneScope through remaining init commands, cmdPhaseComplete, path variable glossary, and integration tests
- [ ] 12-02-PLAN.md — Thread MILESTONE_FLAG through workflow files and document Agent Teams research findings

### Phase 13: Test Coverage
**Goal:** Comprehensive test coverage for all v2.0 concurrent milestone functionality — new test helpers, branch coverage on new functions, and end-to-end verification across both layout modes.
**Depends on:** Phase 14 (integration wiring fix — E2E tests must validate working code)
**Requirements:** [TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06]

### Phase 14: Integration Wiring Fix
**Goal:** Fix 2 cross-phase integration gaps and 1 broken E2E flow found by milestone audit — add `MILESTONE_VERSION` extraction to workflow MILESTONE_FLAG blocks so STATUS.md checkpoint writes succeed, and wire `cmdMilestoneUpdateManifest` into the execute-phase workflow so conflict detection has populated `files_touched` arrays.
**Depends on:** Phase 12 (full routing complete)
**Requirements:** Gap closure — fixes integration issues affecting [DASH-01, DASH-02, DASH-03, CNFL-01, CNFL-02]
**Gap Closure:** Closes INTEGRATION-1 (high), INTEGRATION-2 (low), and STATUS.md checkpoint flow gap from v2.0 audit
**Recommended execution order:** Execute Phase 14 BEFORE Phase 13
**Plans:** 1 plan
Plans:
- [ ] 14-01-PLAN.md — Fix MILESTONE_VERSION extraction and wire update-manifest into execute-phase wave loop

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
| 10. Compatibility Layer | 1/1 | Complete    | 2026-02-24 | - |
| 11. Dashboard and Conflict Detection | 3/3 | Complete    | 2026-02-24 | - |
| 12. Full Routing Update | 2/2 | Complete    | 2026-02-24 | - |
| 13. Test Coverage | v2.0 | 0/? | Not started | - |
| 14. Integration Wiring Fix | v2.0 | 0/? | Not started | - |
