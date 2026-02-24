# Roadmap: GSD Enhanced Fork — v2.0 Concurrent Milestones

**Milestone:** v2.0 Concurrent Milestones
**Goal:** Enable multiple milestones to execute in parallel across separate Claude Code sessions with isolated workspaces, conflict awareness, and a compatibility layer for existing projects.
**Phases:** 8–13 (6 phases)
**Requirements:** 34 v2.0 requirements across 9 categories
**Depth:** Quick (per config.json)

---

## Phases

- [ ] **Phase 8: Path Architecture Foundation** - Central path resolver and CLI flag parsing — the dependency every other phase is built on
- [ ] **Phase 9: Milestone Workspace Initialization** - Physical workspace creation, scaffold files, and conflict manifest format
- [ ] **Phase 10: Compatibility Layer** - Legacy project detection and permanent zero-migration old-style support
- [ ] **Phase 11: Dashboard and Conflict Detection** - Live multi-milestone dashboard and advisory overlap detection
- [ ] **Phase 12: Full Routing Update** - All workflows, commands, and phase numbering updated to be milestone-aware
- [ ] **Phase 13: Test Coverage** - New test helpers, branch coverage on new functions, and end-to-end verification

---

## Phase Details

### Phase 8: Path Architecture Foundation
**Goal**: Milestone-scoped path resolution is available to all modules — any code that needs a planning path calls `planningRoot()` instead of building string literals, and the CLI parses `--milestone` for downstream routing
**Depends on**: Phase 7 (v1.1 complete)
**Requirements**: PATH-01, PATH-02, PATH-03, PATH-04
**Success Criteria** (what must be TRUE):
  1. Calling `planningRoot(cwd, 'v2.0')` returns `.planning/milestones/v2.0/` and calling `planningRoot(cwd)` returns `.planning/` — verified by unit test
  2. Calling `detectLayoutStyle(cwd)` returns `legacy`, `milestone-scoped`, or `uninitialized` based solely on the `concurrent: true` sentinel in `config.json`, not directory presence
  3. Running any `gsd-tools.cjs` command with `--milestone v2.0` threads the scope into phase, state, and roadmap commands without error
  4. The `is_last_phase` bug is fixed — completing a phase when future phases are unplanned does not prematurely terminate milestone routing
**Plans**: TBD

### Phase 9: Milestone Workspace Initialization
**Goal**: Creating a new milestone physically constructs an isolated workspace at `.planning/milestones/<version>/` with all required scaffold files, including the conflict manifest declaring intended file ownership
**Depends on**: Phase 8
**Requirements**: WKSP-01, WKSP-02, WKSP-03, WKSP-04, CNFL-01
**Success Criteria** (what must be TRUE):
  1. Running `new-milestone` for version `v2.0` creates the directory `.planning/milestones/v2.0/` containing `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `conflict.json`, `phases/`, and `research/`
  2. The global `.planning/` root retains only `PROJECT.md`, `config.json`, and `MILESTONES.md` — no per-milestone files live at root in a concurrent project
  3. Each milestone workspace contains a `conflict.json` with a `files_touched` array that the milestone populates at creation time
  4. Running `complete-milestone` marks the milestone workspace as complete and updates MILESTONES.md with a completion entry
**Plans**: TBD

### Phase 10: Compatibility Layer
**Goal**: Old-style projects (root-level `STATE.md`, `ROADMAP.md`, `phases/`) are automatically detected and routed through legacy code paths — they never need to migrate and are permanently valid
**Depends on**: Phase 8
**Requirements**: COMPAT-01, COMPAT-02, COMPAT-03
**Success Criteria** (what must be TRUE):
  1. An old-style v1.x project runs all existing GSD commands unchanged — no errors, no prompts to migrate, no behavioral difference from before v2.0
  2. An old-style project that already has a `.planning/milestones/` archive directory (from prior `complete-milestone` calls) is correctly identified as `legacy`, not `milestone-scoped`
  3. A new concurrent project and an old-style project can coexist in the same Claude Code workspace with both routing correctly based on their respective `config.json` sentinel values
**Plans**: TBD

### Phase 11: Dashboard and Conflict Detection
**Goal**: Concurrent milestone status is visible at a glance and file ownership conflicts are surfaced before code is written — without blocking execution
**Depends on**: Phase 9, Phase 10
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, CNFL-02, CNFL-03, CNFL-04
**Success Criteria** (what must be TRUE):
  1. `MILESTONES.md` contains a structured per-milestone section that each concurrent session updates independently — no shared write target
  2. Running `/gsd:progress` when two milestones are active renders a summary table showing each milestone's current phase, plan count, and status
  3. Running `manifest-check` with two overlapping `conflict.json` files prints the overlapping file paths as a warning and exits without blocking
  4. Conflict overlap detection fires automatically during `new-milestone` initialization — the user sees any conflicts before planning begins
  5. Old-style single-milestone projects running `/gsd:progress` see their existing single-milestone view unchanged (graceful degrade)
**Plans**: TBD

### Phase 12: Full Routing Update
**Goal**: Every GSD workflow, command, and agent resolves paths through the milestone-scoped resolver — no hardcoded `.planning/` string literals remain in active code paths, and phase numbering is milestone-local
**Depends on**: Phase 8, Phase 9, Phase 10, Phase 11
**Requirements**: ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04, ROUTE-05, PHASE-01, PHASE-02, PHASE-03, TEAM-01
**Success Criteria** (what must be TRUE):
  1. Running `/gsd:plan-phase --milestone v2.0` creates `phase-01` under `.planning/milestones/v2.0/phases/` — phase numbering resets per milestone, not globally sequential
  2. Cross-milestone phase references in dashboards and logs use the qualified format `v2.0/phase-01`, never bare `phase-08`
  3. All GSD commands that accept `--milestone` (`progress`, `health`, `complete-milestone`, `resume-work`) return milestone-scoped paths and status without error
  4. A canonical path variable glossary is committed before any workflow or agent file is edited — no agent invents its own variable name for the same path
  5. Agent spec files contain no hardcoded `.planning/` string literals — all paths flow through `<files_to_read>` from orchestrators
  6. Agent Teams research conclusion is documented: Agent Teams are recommended for intra-milestone parallel phases, not inter-milestone concurrency
**Plans**: TBD

### Phase 13: Test Coverage
**Goal**: New routing and isolation logic has dedicated tests in both layout modes, existing 102+ tests remain green throughout, and branch coverage on new functions meets the 90%+ threshold
**Depends on**: Phase 8, Phase 9, Phase 10, Phase 11, Phase 12
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06
**Success Criteria** (what must be TRUE):
  1. `createConcurrentProject()` helper exists alongside (not replacing) the existing `createTempProject()` — all 102+ existing tests continue to use the old helper and pass without modification
  2. Path resolution tests cover both old-style and new-style layouts: `planningRoot()` returns the correct path in both modes
  3. Compatibility detection tests cover all three project states: new uninitialized, old-style with milestone archives, and new-style concurrent with `concurrent: true` sentinel
  4. Conflict manifest overlap tests verify that two milestones declaring the same file path produce a warning output containing that path
  5. Branch coverage on new functions in `core.cjs` and `commands.cjs` is at or above 90%
  6. At least one end-to-end test executes plan→execute→verify in both old-style and new-style layout modes and passes
**Plans**: TBD

---

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
| 8. Path Architecture Foundation | v2.0 | 0/? | Not started | - |
| 9. Milestone Workspace Initialization | v2.0 | 0/? | Not started | - |
| 10. Compatibility Layer | v2.0 | 0/? | Not started | - |
| 11. Dashboard and Conflict Detection | v2.0 | 0/? | Not started | - |
| 12. Full Routing Update | v2.0 | 0/? | Not started | - |
| 13. Test Coverage | v2.0 | 0/? | Not started | - |

---

*Created: 2026-02-24*
*Milestone: v2.0 Concurrent Milestones*
