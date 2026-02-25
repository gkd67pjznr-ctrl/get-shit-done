# GSD Enhanced Fork

## What This Is

A forked, upgraded version of the GSD (Get Shit Done) framework for Claude Code that adds quality enforcement and concurrent milestone execution. Quality layers eliminate "slop" via a Quality Sentinel, Context7 library lookup, mandatory testing, and quality dimensions — completing a full Plan→Execute→Verify quality enforcement loop. Concurrent milestone support enables multiple milestones to execute in parallel across separate Claude Code sessions with isolated workspaces, lock-free dashboards, advisory conflict detection, and full backward compatibility with legacy projects.

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

### Active

(No active milestone — next milestone not yet started)

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

Shipped v2.0 with 11,371 LOC across CJS source + test files, plus workflow/agent Markdown specifications.
Tech stack: Node.js, CJS modules, Markdown agent specifications, Context7 MCP.
232 tests passing (235 total, 3 pre-existing config defaults failures) across 8 test suites.

**Quality enforcement** (v1.0-v1.1): Full Plan→Execute→Verify loop with Quality Sentinel, Context7 library lookup, mandatory testing, quality dimensions, config-gated enforcement levels (fast/standard/strict), and observability.

**Concurrent milestones** (v2.0): Workspace isolation via `planningRoot()`, three-state layout detection, `--milestone` flag threading, lock-free dashboards, advisory conflict detection, and permanent legacy compatibility.

**Known tech debt:** 2 integration gaps in milestone-scoped plan-phase and roadmap commands (tracked in `.planning/TO-DOS.md`).

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

---
*Last updated: 2026-02-25 after v2.0 milestone shipped*
