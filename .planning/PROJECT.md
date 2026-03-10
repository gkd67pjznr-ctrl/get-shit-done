# GSD Enhanced Fork

## What This Is

A forked, upgraded version of the GSD (Get Shit Done) framework for Claude Code that adds quality enforcement, concurrent milestone execution, systematic tech debt management, and adaptive learning integration. Quality layers eliminate "slop" via a Quality Sentinel, Context7 library lookup, mandatory testing, and quality dimensions — completing a full Plan→Execute→Verify quality enforcement loop. Concurrent milestone support enables multiple milestones to execute in parallel with isolated workspaces. Tech debt infrastructure provides structured tracking (DEBT.md), agent auto-logging with quality-level gating, and an on-demand `/gsd:fix-debt` resolution skill. Adaptive learning merges gsd-skill-creator into core — one package, one install, native observation in every workflow command, 16 auto-loading skills, and integrated analysis commands.

## Core Value

Claude writes code like a senior engineer who always checks the codebase first, always reads the docs, always writes tests, and never takes shortcuts — enforced by the framework, not dependent on ad-hoc prompting.

## Requirements

### Validated

- ✓ Quality Sentinel system in executor agent (pre-task codebase scan, during-task quality gates, post-task diff review) — v1.0
- ✓ Context7 integration in executor agent (library lookup before implementation, API verification, no hand-rolling) — v1.0
- ✓ Mandatory test step in execution flow (write tests for new logic, run existing tests before commit) — v1.0
- ✓ Pre-implementation codebase scan (find existing patterns, reuse utilities, establish test baseline) — v1.0
- ✓ Enhanced verifier with code quality checks (duplication detection, dead code, test coverage, pattern consistency) — v1.0
- ✓ Planner quality directives (task actions include which code to reuse, which docs to consult, what tests to write) — v1.0
- ✓ Config quality level toggle (strict/standard/fast enforcement levels) — v1.0
- ✓ Fix `is_last_phase` bug in `cmdPhaseComplete` — v1.0
- ✓ Fix roadmap-aware phase routing so transition correctly identifies next unplanned phase — v1.0
- ✓ All changes are additive (extend, don't replace existing GSD behavior) — v1.0
- ✓ `/gsd:set-quality` command for per-project quality level switching (fast/standard/strict) — v1.1
- ✓ Config migration to auto-add `quality` block to existing projects missing it — v1.1
- ✓ Quality observability — surface quality gate activity in summaries and output — v1.1
- ✓ Global defaults via `~/.gsd/defaults.json` for new project inheritance — v1.1
- ✓ `/gsd:help` shows `/gsd:reapply-patches` reminder after updates — v1.1
- ✓ Quality level displayed in `/gsd:progress` output — v1.1
- ✓ Config validation — warn on missing sections instead of silent fallback — v1.1
- ✓ Context7 token cap configuration and verification — v1.1

- ✓ `planningRoot()` central path resolver for milestone-scoped and legacy projects — v2.0
- ✓ `detectLayoutStyle()` three-state detection (legacy/milestone-scoped/uninitialized) via config.json sentinel — v2.0
- ✓ `--milestone` CLI flag parsed and threaded to all init commands and workflows — v2.0
- ✓ `is_last_phase` ROADMAP.md fallback for incomplete unplanned phases — v2.0
- ✓ Milestone workspace isolation (`.planning/milestones/<v>/` with STATE.md, ROADMAP.md, REQUIREMENTS.md, conflict.json) — v2.0
- ✓ Lock-free multi-milestone dashboard (per-milestone STATUS.md, MILESTONES.md live updates) — v2.0
- ✓ Advisory conflict detection (manifest-check reads all active conflict.json, warns on overlap, never blocks) — v2.0
- ✓ Legacy compatibility layer (old-style projects auto-detected, zero migration required, permanent support) — v2.0
- ✓ Full routing update (MILESTONE_FLAG in all 7 workflows, milestoneScope in all 7 init commands) — v2.0
- ✓ Milestone-scoped phase numbering (resets per workspace, qualified cross-references) — v2.0
- ✓ E2E test coverage for both layout modes (legacy + milestone-scoped lifecycle tests) — v2.0
- ✓ Agent Teams research documented (recommended for intra-milestone parallelism, deferred to v2.1) — v2.0

- ✓ `cmdInitPlanPhase` returns milestone-aware paths via `planningRoot()` (INTEGRATION-3 resolved) — v3.0
- ✓ `cmdRoadmapGetPhase` and `cmdRoadmapAnalyze` respect `--milestone` flag (INTEGRATION-4 resolved) — v3.0
- ✓ DEBT.md hub with structured entry format (TD-NNN IDs, 10-field schema) — v3.0
- ✓ `debt log/list/resolve` CLI commands for structured debt lifecycle management — v3.0
- ✓ Plan-level checkbox flip in `cmdRoadmapUpdatePlanProgress` — v3.0
- ✓ Milestone workspace finalization in `cmdMilestoneComplete` — v3.0
- ✓ `migrate.cjs` with dry-run inspection and additive-only apply for .planning/ upgrades — v3.0
- ✓ Executor auto-logs debt at Quality Sentinel hook points with quality-level gating — v3.0
- ✓ Verifier auto-logs unresolved quality dimension findings with provenance — v3.0
- ✓ `/gsd:fix-debt` on-demand skill routing debt through debugger diagnosis and executor fix execution — v3.0

- ✓ All v3.0 behavioral bugs fixed (cmdMilestoneComplete phasesDir, execute-plan --milestone, DEBT.md init, CLI help) — v3.1
- ✓ Agent files tracked in git repo, fix-debt.md single-copy verified — v3.1
- ✓ `migrate.cjs` deleted, `migrate` CLI command removed — milestone-scoped is the only layout — v3.1
- ✓ `detectLayoutStyle()` and `getArchivedPhaseDirs()` deleted from core.cjs — v3.1
- ✓ `findPhaseInternal` legacy `.planning/phases/` fallback removed — v3.1
- ✓ All `layout_style`/`LAYOUT` conditionals stripped from 8 workflow files — v3.1
- ✓ All test infrastructure rewritten for milestone-scoped layouts (716/717 passing) — v3.1
- ✓ README.md and FORK-GUIDE.md documenting fork purpose and features — v3.1

- ✓ Unified config — skill-creator.json merged into config.json under adaptive_learning key — v4.0
- ✓ Config migration auto-detects legacy skill-creator.json and merges — v4.0
- ✓ 16 skills ship as auto-loading SKILL.md files under skills/ directory — v4.0
- ✓ 4 team configs ship under teams/ directory — v4.0
- ✓ Single installer delivers skills, teams, 9 hooks, and CLAUDE.md to user projects — v4.0
- ✓ Manifest tracking prevents re-adding user-deleted skills — v4.0
- ✓ CLAUDE.md marker-based merge preserves user content — v4.0
- ✓ Agent skill-awareness and capability inheritance baked inline (no extension markers) — v4.0
- ✓ Dashboard (15K LOC) builds from gsdup repo with /gsd:dashboard command — v4.0
- ✓ Native observation capture in all 7 workflow commands (sessions.jsonl) — v4.0
- ✓ 13 standalone commands ported to /gsd:* namespace — v4.0
- ✓ /wrap:* and /sc:* commands removed — GSD commands natively skill-aware — v4.0
- ✓ gsd-skill-creator deprecated as standalone package — v4.0

### Active

(See v6.0 milestone requirements)

## Current Milestones

### v6.0 Adaptive Observation & Learning Loop

**Goal:** Transform the observation system from a passive event logger into an intelligent correction-capture and preference-learning pipeline that feeds back into skill refinement — so Claude learns from its mistakes and adapts to user expectations.

**Target features:**
- Hook-based real-time correction and mistake capture during sessions
- Auto self-diagnosis when Claude is corrected (root cause analysis)
- Preference tracking as durable, referenceable patterns
- Live recall of corrections within current session + at session start
- Observer agent implementation (session boundary analysis, pattern aggregation)
- Suggestion pipeline writer (generate candidates for `/gsd:suggest`)
- Enhanced `/gsd:digest` with correction analysis and collaborative skill refinement

### v4.0 Adaptive Learning Integration — SHIPPED 2026-03-09

**Delivered:** Merged gsd-skill-creator into GSD core — one package, one install, native skill awareness with observation baked into every workflow command. 7 phases, 15 plans, 39/39 requirements satisfied.

### v5.0 Device-Wide Dashboard

**Goal:** Transform the GSD dashboard from a single-project HTML generator into a device-wide multi-project command center with live terminal integration, session monitoring, and cross-project metrics.

**Target features:**
- Global dashboard server (`gsd dashboard serve`) running on localhost, accessible from any project
- Multi-project registry via CLI (`gsd dashboard add/remove/list`)
- Unified view of all registered GSD projects — milestones, phases, progress, requirements
- Cross-project metrics aggregation (velocity, commit feeds, quality scores)
- Tmux session monitoring — session count, active/idle status, last activity per project
- Embedded interactive terminals via xterm.js + websocket-to-tmux bridge
- Two-tier terminal UX: metadata cards in overview, click-to-expand into live terminal
- SSE-based live refresh across all project data
- Project detail drill-down with full per-project dashboard (existing 5-page dashboard)
- Persistent tmux session management per project

### Out of Scope

- Rewriting GSD from scratch — this is an upgrade, not a rewrite
- Changing the core workflow lifecycle (project → milestone → phase → plan → execute → verify)
- Changing the agent orchestration pattern (lean orchestrators, fresh subagent contexts)
- Changing the commit strategy or wave-based parallelism
- Supporting non-Claude Code runtimes (OpenCode, Gemini CLI)
- UI/visual changes to the framework
- Separate quality agent — inline sentinel burns 6-16K vs 50-100K for separate agent context handoff
- Exhaustive pre-scan (whole codebase) — violates 50% context budget before first line of code
- Blocking quality gates in fast mode — fast mode exists for quick experiments and prototypes
- File locking for concurrent writes — stale locks from killed sessions worse than no locks; workspace isolation eliminates the need
- Automatic conflict resolution — semantic correctness of concurrent code changes cannot be automated
- Nested concurrent milestones — exponential coordination complexity, Agent Teams docs confirm "no nested teams"
- Real-time inter-session sync — requires always-on daemon; file-based STATUS.md polling at checkpoints is sufficient

## Context

Shipped v4.0 with ~52K LOC across 12 CJS source modules + 23 test suites, plus workflow/agent Markdown specifications, 16 skills, 4 teams, and a TypeScript dashboard.
Tech stack: Node.js, CJS modules, TypeScript (dashboard), Markdown agent specifications, Context7 MCP.
Tests passing across 23+ test suites.

**Quality enforcement** (v1.0-v1.1): Full Plan→Execute→Verify loop with Quality Sentinel, Context7 library lookup, mandatory testing, quality dimensions, config-gated enforcement levels (fast/standard/strict), and observability.

**Concurrent milestones** (v2.0): Workspace isolation via `planningRoot()`, `--milestone` flag threading, lock-free dashboards, advisory conflict detection.

**Tech debt system** (v3.0): DEBT.md with 10-field schema, `debt log/list/resolve` CLI commands, executor/verifier auto-logging gated by quality level, `/gsd:fix-debt` skill for on-demand resolution.

**Legacy strip** (v3.1): Milestone-scoped is now the only supported layout. `detectLayoutStyle()`, `migrate.cjs`, and all layout branching removed. All test infrastructure rewritten. Net reduction of ~14K lines.

**Adaptive learning** (v4.0): gsd-skill-creator merged into core. Single installer delivers skills, teams, hooks, and CLAUDE.md. Native observation in all 7 workflow commands. 13 standalone commands ported to /gsd:* namespace. Agent extensions merged inline.

**Known tech debt:** `cmdStateUpdateProgress` uses flat `.planning/phases/` path (MISS-01, medium). Analysis commands (gsd:suggest, gsd:digest) read data files with no writers yet. See `.planning/DEBT.md` and MILESTONES.md.

## Constraints

- **Compatibility**: All changes must be additive — existing GSD behavior preserved, new quality gates layered on top
- **Config-driven**: Quality enforcement level must be configurable (strict/standard/fast) so users can choose their trade-off
- **Context budget**: Quality gates must not consume excessive context — pre-task scans should be targeted, not exhaustive
- **Agent boundaries**: Each agent's responsibilities must remain clear — quality sentinel in executor, quality dimensions in verifier, quality directives in planner

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fork the repo (not extension layer) | Need to modify agent files directly; extension would add indirection | ✓ Good — direct modification enabled clean quality gate integration |
| Quality Sentinel in executor (not separate agent) | Keeps quality checks inline with execution; separate agent would burn context on handoff | ✓ Good — 6-16K overhead vs estimated 50-100K for separate agent |
| Context7 tools added to executor | Executor is where code is written; library awareness needed at coding time | ✓ Good — library docs consulted at coding time, not planning time |
| Configurable quality levels (fast/standard/strict) | Not all projects need strict mode; quick experiments need speed | ✓ Good — fast preserves vanilla GSD exactly (zero behavioral change) |
| Fix bugs alongside upgrades | Known bugs affect fork usability; fixing them demonstrates quality-first approach | ✓ Good — bug fixes in Phase 1 unblocked multi-phase execution for Phases 2-4 |
| quality.level defaults to 'fast' | Ensures zero behavioral change from vanilla GSD when quality gates introduced | ✓ Good — CFG-02 satisfied, no surprise behavior for existing users |
| Duplication scope same-phase only | Full codebase scan too expensive; same-phase catches most real issues | ✓ Good — keeps verifier fast while catching relevant duplications |
| N/A override guard for tests_to_write | Planner may mark N/A but if task produced exports, tests still required | ✓ Good — prevents planner error from bypassing mandatory test requirement |
| One Context7 query per plan maximum | Prevents context budget blowout; if multiple lookups needed, plan is too broad | — Pending (unverified in production) |
| spawnSync for test helpers | execSync only exposes stderr on non-zero exit; spawnSync captures unconditionally | ✓ Good — enabled reliable stderr assertions in TDD tests |
| GSD_HOME env var for global state | Tests need to override ~/.gsd without touching real state | ✓ Good — clean test isolation for global defaults |
| Direct config.json reads for quality.level | loadConfig doesn't expose quality section in return object | ✓ Good — cmdProgressRender reads accurate value |
| GATE_OUTCOMES per-plan initialization | Prevent reset between tasks; guard variable ensures single init | ✓ Good — outcomes accumulate across all tasks in a plan |
| Quality Gates section absent in fast mode | No gates ran, nothing to report; empty section would be misleading | ✓ Good — clean SUMMARY.md in fast mode |
| planningRoot() as single path resolver | All modules call one function, no string literals for .planning/ paths | ✓ Good — clean dependency chain, easy to test |
| detectLayoutStyle() uses config.json sentinel | Directory presence detection is fragile; explicit `concurrent: true` flag is unambiguous | ✓ Good — archive directories don't trigger false positives |
| Workspace isolation (not file locking) | Stale locks from killed sessions worse than no locks; directory isolation is sufficient | ✓ Good — no lock cleanup needed, each session works in its own directory |
| Lock-free dashboard via STATUS.md | Per-milestone STATUS.md files aggregated at read time; no write coordination | ✓ Good — no split-brain, no lock contention |
| Advisory-only conflict detection | Semantic correctness of concurrent changes can't be automated; surface overlaps, let humans decide | ✓ Good — warnings visible without blocking execution |
| Agent Teams deferred to v2.1 | Wrong for inter-milestone concurrency; right for intra-milestone phase parallelism | ✓ Good — research documented, clean v2.1 path |
| Permanent legacy compatibility | Old-style projects never forced to migrate; detection is additive | ✓ Good — zero migration burden, existing projects unaffected |
| Shared inspectLayout() for dry-run and apply | Prevents output divergence between reporting and execution | ✓ Good — single source of truth for migration actions |
| Debt logging additive-only in agents | Don't modify existing sentinel/verifier gate logic | ✓ Good — zero regression risk in quality gate behavior |
| Trigger B (blocked gate) strict-mode only | Standard mode warned outcomes are informational, not debt | ✓ Good — prevents noise in standard mode |
| Orphaned exports logged in strict mode only | Medium severity below standard threshold (critical/high) | ✓ Good — respects quality level semantics |
| Inline mini-plan for fix-debt | Executor spawned directly, bypasses ROADMAP lookup | ✓ Good — fast path for debt fixes without full phase overhead |
| Rich-description skip path in yolo | Auto-logged debt entries already actionable, skip diagnosis | ✓ Good — reduces friction for well-described debt |
| No --milestone on migrate | Operates on project-level .planning/, not milestone workspaces | ✓ Good — migration is project-scoped, not milestone-scoped |

---
*Last updated: 2026-03-10 after v6.0 milestone start*
