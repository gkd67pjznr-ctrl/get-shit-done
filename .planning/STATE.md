# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** Claude writes code like a senior engineer who always checks the codebase first, always reads the docs, always writes tests, and never takes shortcuts — enforced by the framework, not dependent on ad-hoc prompting.
**Current focus:** v2.0 Concurrent Milestones

## Current Position

Phase: 12 — Full Routing Update (complete)
Plan: 02 (complete)
Status: Phase 12 complete — MILESTONE_FLAG threaded through all 7 workflow files; Agent Teams research documented (TEAM-01); all ROUTE-* and TEAM-01 requirements satisfied
Last activity: 2026-02-24 — 12-02 complete: full workflow routing layer for milestone-scoped concurrent execution

**Progress:** [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 13 (v1.0: 8, v1.1: 5)
- Average duration: ~2 min
- Total execution time: ~26 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2 | 3 min | 1.5 min |
| 02-executor-sentinel | 3 | 3 min | 1 min |
| 03-quality-dimensions | 2 | 2 min | 1 min |
| 04-wire-quality-scan-handoff | 1 | 3 min | 3 min |
| 05-config-foundation | 2 | 5 min | 2.5 min |
| 06-commands-and-ux | 2 | 8 min | 4 min |
| 07-quality-observability | 1 | 2 min | 2 min |
| 08-path-architecture-foundation | 2 (P01: 4min, P02: 2min) | 6 min | 3 min |
| 09-milestone-workspace-initialization | 2 (P01: 4min, P02: 5min) | 9 min | 4.5 min |
| 10-compatibility-layer | 1 | 8 min | 8 min |
| Phase 11-dashboard-conflict-detection P01 | 2 | 2 tasks | 2 files |
| Phase 11-dashboard-conflict-detection P02 | 8min | 2 tasks | 4 files |
| Phase 12-full-routing-update P01 | 12min | 2 tasks | 5 files |
| Phase 12 P02 | 3min | 2 tasks | 8 files |
| Phase 14-integration-wiring-fix P01 | 1 | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Full v1.0 + v1.1 decision logs archived with milestones.

**v2.0 decisions:**
- `planningRoot()` is the single path resolver — all modules call it, no string literals
- `detectLayoutStyle()` uses `concurrent: true` sentinel in config.json, never directory presence
- Workspace isolation is directory-based — no file locking (stale locks from killed sessions)
- Dashboard writes are lock-free — per-milestone STATUS.md files, aggregated at read time
- Conflict detection is advisory only — warns on overlap, never blocks execution
- Agent Teams deferred to v2.x — wrong for inter-milestone concurrency; session resumption not supported
- `atomicWrite()` implemented inline in gsd-tools.cjs (15 lines) — avoids write-file-atomic Node 20+ constraint
- `planningRoot(cwd, milestoneScope)` uses truthiness check — null/undefined/empty all return legacy `.planning/` path
- `detectLayoutStyle` reads config.json only — directory presence detection is forbidden
- `is_last_phase` ROADMAP fallback: checks `[x]` completion to avoid false negatives on already-complete higher phases
- [Phase 08]: --milestone flag parsed before command routing using --cwd pattern (space + equals forms)
- [Phase 08]: milestoneScope added as last param to init functions — existing callers unaffected
- [Phase 08]: Error test uses --milestone with no following arg (triggers !value branch); plain words are valid flag values
- [Phase 09-milestone-workspace-initialization]: Tests use spawnSync child process pattern because output() and error() both call process.exit() — direct invocation kills test runner
- [Phase 09-P02]: conflict_marked_complete: false for old-style projects without workspace — no error, clean backward compat
- [Phase 09-P02]: layout_style + milestones_dir + milestones_dir_exists added together in cmdInitNewMilestone — full workspace context in one init call
- [Phase 10-compatibility-layer]: layout_style field placed after planning_root in result objects — grouped with other v2.0 compatibility fields
- [Phase 11-dashboard-conflict-detection]: cmdMilestoneWriteStatus uses try/catch for MILESTONES.md update — STATUS.md write must succeed even if MILESTONES.md is absent
- [Phase 11-dashboard-conflict-detection]: cmdManifestCheck always exits 0 (advisory only) — conflict detection warns on overlap, never blocks (CNFL-04)
- [Phase 11-dashboard-conflict-detection]: table format test uses no --raw flag so output() emits JSON (with --raw and rawValue set, output() emits raw text not JSON)
- [Phase 11-dashboard-conflict-detection P03]: write-status checkpoint calls placed at plan-start (plan-phase.md §9), plan-complete (execute-phase.md step 4a), and phase-complete (execute-phase.md update_roadmap) — all guarded by layout_style === "milestone-scoped"
- [Phase 12-01]: searchPhaseInDir used directly in cmdPhaseComplete when milestoneScope set — findPhaseInternal hardcodes root phases dir, cannot be changed without breaking all callers
- [Phase 12-01]: cmdInitPhaseOp path fields (state_path, roadmap_path, requirements_path) now use planningRoot-relative paths — milestone workspace paths returned to callers
- [Phase 12-01]: milestoneScope as last param pattern maintained for all 5 new init functions — backward compat preserved (undefined -> null -> legacy path)
- [Phase 12]: transition.md adds init execute-phase call in load_project_state to obtain layout_style — no prior init existed in that workflow
- [Phase 12]: complete-milestone.md extracts MILESTONE_VERSION from first arg of $ARGUMENTS — version is always arg 1 when invoked as /gsd:complete-milestone v2.0
- [Phase 12]: standalone workflows extract --milestone from $ARGUMENTS via sed — users can invoke verify-work, progress, resume-project with --milestone flag
- [Phase 14-integration-wiring-fix]: MILESTONE_VERSION uses alias (MILESTONE_VERSION=$MILESTONE_SCOPE) not a separate jq call — avoids redundant subshell and ensures same source as MILESTONE_FLAG
- [Phase 14-integration-wiring-fix]: update-manifest placed as step 4b in wave loop, collecting all plans' files_modified — safe because cmdMilestoneUpdateManifest deduplicates with Set

### Pending Todos

- Run grep inventory before Phase 12 planning: count `.planning/phases`, `.planning/STATE.md`, `.planning/ROADMAP.md` across all file types (94/83/67/30 empirically measured in research)

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 12-02-PLAN.md — Phase 12 full-routing-update complete
Resume file: .planning/phases/12-full-routing-update/12-02-SUMMARY.md
