# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-24)

**Core value:** Claude writes code like a senior engineer who always checks the codebase first, always reads the docs, always writes tests, and never takes shortcuts — enforced by the framework, not dependent on ad-hoc prompting.
**Current focus:** v2.0 Concurrent Milestones

## Current Position

Phase: 11 — Dashboard Conflict Detection (in progress)
Plan: 01 (complete)
Status: Phase 11 plan 01 complete — cmdMilestoneWriteStatus and cmdManifestCheck implemented via TDD, DASH-01/DASH-03/CNFL-02/CNFL-04 satisfied
Last activity: 2026-02-24 — 11-01 complete: STATUS.md writer, MILESTONES.md dashboard update, manifest overlap detector, 10 new tests

**Progress:** [████████░░] 75%

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

### Pending Todos

- Run grep inventory before Phase 12 planning: count `.planning/phases`, `.planning/STATE.md`, `.planning/ROADMAP.md` across all file types (94/83/67/30 empirically measured in research)

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-24
Stopped at: 11-01-PLAN.md complete — Phase 11 plan 01 complete
Resume file: .planning/phases/11-dashboard-conflict-detection/11-01-SUMMARY.md
