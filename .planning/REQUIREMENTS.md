# Requirements: GSD Enhanced Fork

**Defined:** 2026-02-24
**Core Value:** Claude writes code like a senior engineer who always checks the codebase first, always reads the docs, always writes tests, and never takes shortcuts — enforced by the framework, not dependent on ad-hoc prompting.

## v2.0 Requirements

Requirements for concurrent milestone execution. Each maps to roadmap phases.

### Path Architecture

- [ ] **PATH-01**: `planningRoot(cwd, milestoneScope)` function in core.cjs returns `.planning/` for old-style or `.planning/milestones/<v>/` for new-style projects
- [ ] **PATH-02**: `detectLayoutStyle(cwd)` checks config.json for `concurrent: true` sentinel, returns `legacy`, `milestone-scoped`, or `uninitialized`
- [ ] **PATH-03**: `--milestone <version>` global CLI flag parsed by gsd-tools.cjs and threaded to all phase/state/roadmap commands
- [ ] **PATH-04**: `is_last_phase` bug fixed — phase completion routing no longer prematurely marks phases as last when future phases are unplanned

### Workspace Isolation

- [ ] **WKSP-01**: Each milestone creates its own folder at `.planning/milestones/<version>/` containing STATE.md, ROADMAP.md, REQUIREMENTS.md, phases/, and research/
- [ ] **WKSP-02**: Global `.planning/` root retains only project-wide files: PROJECT.md, config.json, MILESTONES.md
- [ ] **WKSP-03**: `new-milestone` workflow creates milestone workspace with all required scaffold files
- [ ] **WKSP-04**: `complete-milestone` marks milestone workspace as complete and updates MILESTONES.md

### Compatibility

- [ ] **COMPAT-01**: Old-style projects (root-level STATE.md, ROADMAP.md, phases/) auto-detected and routed through legacy code paths without migration
- [ ] **COMPAT-02**: Detection uses explicit `concurrent: true` sentinel in config.json, not directory presence
- [ ] **COMPAT-03**: Compatibility is permanent — old-style projects are never forced to migrate

### Phase Numbering

- [ ] **PHASE-01**: Phase numbering resets to 01 per milestone (not global sequential)
- [ ] **PHASE-02**: Cross-milestone phase references use qualified format `<version>/phase-<NN>`
- [ ] **PHASE-03**: `phase-complete` command accepts `--milestone` flag and routes to milestone-scoped phase folder

### Dashboard

- [ ] **DASH-01**: Each milestone writes STATUS.md in its workspace folder at natural checkpoints (plan start, plan complete, phase complete)
- [ ] **DASH-02**: `/gsd:progress` reads all active milestone STATUS.md files and renders multi-milestone summary table
- [ ] **DASH-03**: MILESTONES.md repurposed as live dashboard with structured per-milestone sections updated independently by concurrent sessions
- [ ] **DASH-04**: Old-style projects show single-milestone progress (graceful degrade)

### Conflict Detection

- [ ] **CNFL-01**: Each milestone workspace contains conflict.json declaring files_touched (source files the milestone intends to modify)
- [ ] **CNFL-02**: `manifest-check` command reads all active milestone conflict.json files and reports overlapping file paths
- [ ] **CNFL-03**: Overlap detection runs automatically during `/gsd:new-milestone` workflow
- [ ] **CNFL-04**: Conflicts are advisory (warnings only) — do not block execution

### Routing

- [ ] **ROUTE-01**: All workflow files pass `--milestone` to gsd-tools.cjs calls when in milestone-scoped mode
- [ ] **ROUTE-02**: All init commands return milestone-scoped paths when `--milestone` is provided
- [ ] **ROUTE-03**: `/gsd:progress`, `/gsd:health`, `/gsd:complete-milestone`, `/gsd:resume-work` updated to be milestone-aware
- [ ] **ROUTE-04**: Canonical path variable glossary committed as reference before workflow/agent editing begins
- [ ] **ROUTE-05**: Agent specs remain unchanged — paths flow through `<files_to_read>` from orchestrators

### Test Coverage

- [ ] **TEST-01**: `createConcurrentProject()` test helper created alongside existing `createTempProject()`
- [ ] **TEST-02**: Tests for milestone-scoped path resolution in both old-style and new-style layouts
- [ ] **TEST-03**: Tests for compatibility detection across all three states (new project, old-with-archives, new-style concurrent)
- [ ] **TEST-04**: Tests for conflict manifest overlap detection
- [ ] **TEST-05**: 90%+ branch coverage on new functions in core.cjs and commands.cjs
- [ ] **TEST-06**: End-to-end test executing plan→execute→verify in both layout modes

### Agent Teams Documentation

- [ ] **TEAM-01**: Research findings documented — Agent Teams recommended for intra-milestone parallel phases, not inter-milestone concurrency

## v2.1 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Agent Teams Integration

- **TEAM-02**: Scaffold/hook points in architecture for Agent Teams integration for parallel phases within a single milestone
- **TEAM-03**: `/gsd:parallel-phases` workflow using Agent Teams for intra-milestone phase parallelism

### Enhanced Conflict Detection

- **CNFL-05**: Opt-in enforcement mode where overlapping manifest conflicts block milestone execution (not just warn)
- **CNFL-06**: `manifest-diff` command showing what each conflicting milestone changed in overlapping files

### Dashboard Enhancements

- **DASH-05**: `/gsd:progress --watch` polls STATUS.md files and refreshes display on interval
- **DASH-06**: Cross-milestone dependency tracking — milestone A declares dependency on milestone B's completion

### Advanced Isolation

- **WKSP-05**: Automatic git worktree creation per milestone for OS-level source file isolation

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| File locking for concurrent writes | Stale locks from killed sessions worse than no locks; workspace isolation eliminates the need |
| Automatic conflict resolution | Semantic correctness of concurrent code changes cannot be automated; surface conflicts, leave resolution to humans |
| Centralized "active milestone" state | Creates split-brain when sessions interrupted; lock-free model with explicit --milestone flag is correct |
| Nested concurrent milestones | Agent Teams docs confirm "no nested teams"; exponential coordination complexity |
| Rewriting milestone/phase lifecycle | Concurrency is execution context, not lifecycle; PROJECT.md explicitly excludes lifecycle changes |
| Real-time inter-session sync | Requires always-on daemon; file-based STATUS.md polling at checkpoints is sufficient |
| Custom quality rules per milestone | Premature; validate concurrent execution works first before layering quality customization |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PATH-01 | — | Pending |
| PATH-02 | — | Pending |
| PATH-03 | — | Pending |
| PATH-04 | — | Pending |
| WKSP-01 | — | Pending |
| WKSP-02 | — | Pending |
| WKSP-03 | — | Pending |
| WKSP-04 | — | Pending |
| COMPAT-01 | — | Pending |
| COMPAT-02 | — | Pending |
| COMPAT-03 | — | Pending |
| PHASE-01 | — | Pending |
| PHASE-02 | — | Pending |
| PHASE-03 | — | Pending |
| DASH-01 | — | Pending |
| DASH-02 | — | Pending |
| DASH-03 | — | Pending |
| DASH-04 | — | Pending |
| CNFL-01 | — | Pending |
| CNFL-02 | — | Pending |
| CNFL-03 | — | Pending |
| CNFL-04 | — | Pending |
| ROUTE-01 | — | Pending |
| ROUTE-02 | — | Pending |
| ROUTE-03 | — | Pending |
| ROUTE-04 | — | Pending |
| ROUTE-05 | — | Pending |
| TEST-01 | — | Pending |
| TEST-02 | — | Pending |
| TEST-03 | — | Pending |
| TEST-04 | — | Pending |
| TEST-05 | — | Pending |
| TEST-06 | — | Pending |
| TEAM-01 | — | Pending |

**Coverage:**
- v2.0 requirements: 34 total
- Mapped to phases: 0
- Unmapped: 34 (pending roadmap creation)

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-24 after initial definition*
