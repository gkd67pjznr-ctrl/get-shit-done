# Roadmap: v2.0 Concurrent Milestones

**Milestone Goal:** Enable multiple milestones to execute in parallel across separate Claude Code sessions with isolated workspaces, conflict awareness, and a compatibility layer for existing projects.

## Phases

- [x] **Phase 8: Path Architecture Foundation** - Central path resolver and CLI flag parsing — the dependency every other phase is built on (completed 2026-02-24)
- [x] **Phase 9: Milestone Workspace Initialization** - Physical workspace creation, scaffold files, and conflict manifest format (completed 2026-02-24)
- [x] **Phase 10: Compatibility Layer** - Legacy project detection and permanent zero-migration old-style support (completed 2026-02-24)
- [x] **Phase 11: Dashboard and Conflict Detection** - Live multi-milestone dashboard and advisory overlap detection (completed 2026-02-24)
- [x] **Phase 12: Full Routing Update** - All workflows, commands, and phase numbering updated to be milestone-aware (completed 2026-02-24)
- [x] **Phase 13: Test Coverage** - New test helpers, branch coverage on new functions, and end-to-end verification (completed 2026-02-24)
- [x] **Phase 14: Integration Wiring Fix** - Close gap-audit findings: dashboard, conflict detection, and routing fixes (completed 2026-02-25)

### Phase 8: Path Architecture Foundation

**Goal:** Milestone-scoped path resolution is available to all modules — any code that needs a planning path calls `planningRoot()` instead of building string literals, and the CLI parses `--milestone` for downstream routing.

**Requirements:** PATH-01, PATH-02, PATH-03, PATH-04

**Plans:** 2/2 plans complete

Plans:
- [x] 08-01-PLAN.md — planningRoot() central resolver with detectLayoutStyle() and unit tests
- [x] 08-02-PLAN.md — CLI --milestone flag parsing and is_last_phase bug fix

### Phase 9: Milestone Workspace Initialization

**Goal:** Creating a new milestone physically constructs an isolated workspace at `.planning/milestones/<version>/` with all required scaffold files, including the conflict manifest declaring intended file ownership.

**Requirements:** WKSP-01, WKSP-02, WKSP-03, WKSP-04, CNFL-01

**Plans:** 2/2 plans complete

Plans:
- [x] 09-01-PLAN.md — Workspace scaffold creation and conflict manifest format
- [x] 09-02-PLAN.md — Milestone workspace finalization and MILESTONES.md updates

### Phase 10: Compatibility Layer

**Goal:** Old-style projects (root-level `STATE.md`, `ROADMAP.md`, `phases/`) are automatically detected and routed through legacy code paths — they never need to migrate and are permanently valid.

**Requirements:** COMPAT-01, COMPAT-02, COMPAT-03

**Plans:** 1/1 plans complete

Plans:
- [x] 10-01-PLAN.md — Legacy detection and permanent zero-migration support

### Phase 11: Dashboard and Conflict Detection

**Goal:** Concurrent milestone status is visible at a glance and file ownership conflicts are surfaced before code is written — without blocking execution.

**Requirements:** DASH-01, DASH-02, DASH-03, DASH-04, CNFL-02, CNFL-03, CNFL-04

**Plans:** 3/3 plans complete

Plans:
- [x] 11-01-PLAN.md — STATUS.md per-milestone checkpoint writes
- [x] 11-02-PLAN.md — Multi-milestone progress dashboard rendering
- [x] 11-03-PLAN.md — Conflict manifest overlap detection and auto-fire during new-milestone

### Phase 12: Full Routing Update

**Goal:** Every GSD workflow, command, and agent resolves paths through the milestone-scoped resolver — no hardcoded `.planning/` string literals remain in active code paths, and phase numbering is milestone-local.

**Requirements:** ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04, ROUTE-05, PHASE-01, PHASE-02, PHASE-03, TEAM-01

**Plans:** 2/2 plans complete

Plans:
- [x] 12-01-PLAN.md — Workflow and command --milestone flag threading
- [x] 12-02-PLAN.md — Agent spec cleanup and canonical path variable glossary

### Phase 13: Test Coverage

**Goal:** New routing and isolation logic has dedicated tests in both layout modes, existing tests remain green throughout, and branch coverage on new functions meets the 90%+ threshold.

**Requirements:** TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06

**Plans:** 2/2 plans complete

Plans:
- [x] 13-01-PLAN.md — createConcurrentProject() helper and path resolution tests
- [x] 13-02-PLAN.md — E2E lifecycle tests and branch coverage validation

### Phase 14: Integration Wiring Fix

**Goal:** Close gap-audit findings — wire dashboard STATUS.md writes, conflict detection auto-fire, and fix routing bugs discovered during integration testing.

**Requirements:** DASH-01, DASH-02, DASH-03, CNFL-01, CNFL-02 (fixes)

**Plans:** 1/1 plans complete

Plans:
- [x] 14-01-PLAN.md — Integration wiring fixes for dashboard, conflict detection, and routing

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 8. Path Architecture Foundation | 2/2 | Complete | 2026-02-24 |
| 9. Milestone Workspace Initialization | 2/2 | Complete | 2026-02-24 |
| 10. Compatibility Layer | 1/1 | Complete | 2026-02-24 |
| 11. Dashboard and Conflict Detection | 3/3 | Complete | 2026-02-24 |
| 12. Full Routing Update | 2/2 | Complete | 2026-02-24 |
| 13. Test Coverage | 2/2 | Complete | 2026-02-24 |
| 14. Integration Wiring Fix | 1/1 | Complete | 2026-02-25 |

---
