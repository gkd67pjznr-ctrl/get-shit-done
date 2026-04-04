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

- ✓ Gate execution persistence — 5 sentinel steps recorded to gate-executions.jsonl with quality-level filtering — v7.0
- ✓ Correction quality context — quality_level field on all correction entries — v7.0
- ✓ Context7 call logging — library lookups persisted to context7-calls.jsonl with token budgets — v7.0
- ✓ Quality gating research — evaluated 5 MCP servers/tools, ESLint MCP recommended — v7.0
- ✓ Dashboard Gate Health page — outcome distribution, quality level usage, per-gate firing rates, Context7 metrics — v7.0
- ✓ Overview integration — quality badges on project cards, gate summaries on milestone lines and tmux cards — v7.0
- ✓ Gate-to-correction attribution — heuristic mapping from correction categories to gates with confidence scores — v7.0

- ✓ Hook-based correction capture with structured JSONL storage, 14-category taxonomy, and auto-rotation — v6.0
- ✓ Auto self-diagnosis on corrections with root cause categorization — v6.0
- ✓ Preference tracking promoting 3+ repeated corrections to durable preferences with confidence scoring — v6.0
- ✓ Scope-aware preferences (file/filetype/phase/project/global) — v6.0
- ✓ Live recall injection at session start and within-session cross-referencing — v6.0
- ✓ Recall exclusion for preferences baked into skill refinements — v6.0
- ✓ Observer agent with pattern aggregation and suggestion generation — v6.0
- ✓ 6 bounded learning guardrails enforced (3 corrections min, 7-day cooldown, user confirmation, 20% max change, guardrail logging) — v6.0
- ✓ Enhanced `/gsd:digest` with correction analysis and skill contradiction detection — v6.0
- ✓ Collaborative skill refinement workflow via `/gsd:suggest` — v6.0
- ✓ Cross-project preference inheritance to `~/.gsd/preferences.json` — v6.0
- ✓ All GSD workflow commands and subagents inherit learned skills in execution context — v6.0

- ✓ analyze-patterns.cjs runs automatically via SessionEnd hook, populates scan-state.json watermark — v8.0
- ✓ Pending skill suggestions surfaced at session start when suggest_on_session_start is true — v8.0
- ✓ Skill refinement flow: accepted suggestions modify SKILL.md files and commit; dismissed suggestions removed — v8.0
- ✓ Full skill feedback loop verified E2E (correction → pattern → suggestion → refinement → loaded) — v8.0
- ✓ Quality sentinel gates moved from agent instructions to deterministic PostToolUse hooks — v8.0
- ✓ Quality gates fire during real execution and persist to gate-executions.jsonl — v8.0
- ✓ Gate data flows to dashboard Gate Health page with live metrics — v8.0
- ✓ Both systems verifiable by running a quick task and confirming data appears — v8.0

- ✓ cmdStateUpdateProgress resolves via planningRoot() for milestone-scoped progress tracking — v9.0
- ✓ skills_loaded populated in sessions.jsonl and skills_active in gate-executions.jsonl across all workflows — v9.0
- ✓ SKILL-HISTORY.md audit trail with unified diffs, 50-entry rotation, merge=union gitattributes — v9.0
- ✓ Phase benchmarking with correction count, gate fire count, quality level per plan to phase-benchmarks.jsonl — v9.0
- ✓ Debt impact analysis linking DEBT.md entries to corrections.jsonl with link_confidence scoring — v9.0
- ✓ /gsd:session-report command surfacing per-session analytics (corrections, gates, skills, benchmark trends) — v9.0
- ✓ Per-skill correction rate metrics via CATEGORY_SKILL_MAP attribution with confidence tiers — v9.0
- ✓ Skill relevance scoring with Jaccard keyword overlap, cold-start floor, dormancy decay, content-hash cache — v9.0

- ✓ Auto-apply safety engine with 5 fail-fast gates (CONFIG, RATE, QUALITY, CONFIDENCE, SIZE) and JSONL audit log — v15.0
- ✓ Auto-apply opt-in via adaptive_learning.auto_apply config key with kill switch behavior — v15.0
- ✓ Revert command (/gsd:refine-skill revert <id>) with git revert via commit SHA — v15.0
- ✓ Failed auto-apply suggestions surface as pending with auto_apply_failed flag — v15.0
- ✓ Per-project review profiles generated from corrections.jsonl with 10-correction minimum guard — v15.0
- ✓ Code-review skill reads review-profile.json and adapts focus for high-weight categories — v15.0
- ✓ Review profile refreshes at session start via hook — v15.0
- ✓ Decision parser extracts Key Decisions table from PROJECT.md — v15.0
- ✓ Jaccard token overlap matches corrections to decisions deterministically — v15.0
- ✓ Decision tensions (3+ corrections matching) surfaced in /gsd:digest with evidence — v15.0

- ✓ MCP server at /mcp on dashboard with StreamableHTTP transport, stateless per-request, Origin validation — v10.0
- ✓ 8 read-only MCP query tools (list-projects, get-project-state, get-gate-health, get-observations, get-sessions, get-skill-metrics, get-cost-metrics, get-git-status) — v10.0
- ✓ Installer auto-configures ~/.claude.json with mcpServers.gsd-dashboard and --no-mcp opt-out — v10.0
- ✓ Unit tests for all 8 MCP tool handlers plus integration test for /mcp endpoint — v10.0

- ✓ ESLint gate fires on PostToolUse Write events for .ts/.js/.cjs files with quality-level gating and graceful degradation — v12.0
- ✓ Gate results persist to gate-executions.jsonl with eslint_gate type, dashboard aggregates automatically — v12.0
- ✓ DONE criteria parser extracts verifiable assertions from `<done>` tags in plan tasks — v12.0
- ✓ Transition guards verify assertions mechanically at verify_phase_goal before verifier agent runs — v12.0
- ✓ Unverifiable DONE criteria surfaced for human check, quality-level gated (fast=skip, standard=warn, strict=block) — v12.0
- ✓ Test count extracted at plan completion, persisted to phase-benchmarks.jsonl with delta computation — v12.0
- ✓ /gsd:progress shows test count with delta, /gsd:digest surfaces test count trend table — v12.0

- ✓ Brainstorm eval detection blocks self-censoring language (23 patterns + 7 wild) before idea storage — v11.0
- ✓ Append-only JSONL idea store with no update/delete API — v11.0
- ✓ SCAMPER forced cycling requires all 7 lenses with per-lens quantity floors — v11.0
- ✓ Quantity floors with wild-mode doubling (freeform 15→30, per-lens 2→4) and saturation detection — v11.0
- ✓ Context blinding excludes ROADMAP.md and STATE.md from seed brief during expand stage — v11.0
- ✓ Data-driven seeding from corrections, debt, sessions with --from-corrections/--from-debt/--for-milestone flags — v11.0
- ✓ /gsd:brainstorm command with 3-stage pipeline (seed→expand→converge), --wild mode, composable flags — v11.0
- ✓ Converge pipeline with keyword clustering (3-7 themes), 4-dimension scoring, finalist selection — v11.0
- ✓ Output artifacts: FEATURE-IDEAS.md, BRAINSTORM-SESSION.md, ideas.jsonl in sequential quick/ dirs — v11.0
- ✓ Session history tracking with auto-logging, idea-to-phase tagging, and new-milestone seed integration — v11.0

### Active

## Current Milestone: v12.0 Quality Enforcement Evolution

**Goal:** Close remaining quality enforcement gaps — static analysis via ESLint MCP gate, mechanical DONE verification at phase transitions, and test coverage trending across milestones.

**Target features:**
- ESLint MCP gate integration (PostToolUse hook on .ts/.js/.cjs writes, quality-level gated)
- State machine guards for phase transitions (verify DONE criteria mechanically before completion)
- Test coverage trending (track test count per plan, surface delta in progress/digest)

## Current Milestone: v13.0 Unified Observability & Context Routing

**Goal:** Unify fragmented event streams into a single chronological journal, track per-skill context budget costs, and add advisory MCP server selection based on task type.

**Target features:**
- Workflow event journaling (unified workflow.jsonl with emitEvent, reader function, digest integration)
- Context budget optimizer (per-skill token cost, cost-per-relevance ratio, deferral recommendations)
- MCP server selection intelligence (task-type classifier, advisory recommendations before executor spawn)

## Current Milestone: v14.0 Planning Intelligence

**Goal:** Turn historical execution data into planning inputs — the planner learns from 15 milestones and 80+ plans instead of starting from scratch every time.

**Target features:**
- Phase Reuse / Template Library (index completed plans, detect structural similarity, suggest reusing plan skeletons)
- Phase Composition Assistant (classify tasks by type, rank by performance, compose optimal task sequences)
- Automated Milestone Decomposition (propose phase breakdowns for new milestones using structural patterns)
- Prompt Quality Scoring (score task prompts against correction frequency, surface patterns in digest)

## Current Milestone: v16.0 Multi-Milestone Batch Planner

**Goal:** A `/gsd:multi-milestone` command that takes a dump of feature ideas, clusters them into milestone themes, creates N workspaces, runs per-milestone research + full requirements scoping, spawns N parallel roadmappers producing unnumbered proposals, then a roadmap synthesizer assigns all version and phase numbers and writes every artifact — all in one session.

**Target features:**
- Freeform, file-based, or brainstorm-sourced feature intake with affinity clustering
- `--from-brainstorm NN` flag to consume `/gsd:brainstorm` output directly
- Parallel workspace creation (N milestones, cap N<=20)
- Per-milestone research (skip/include choice per milestone)
- Full per-milestone requirements scoping (same UX as new-milestone)
- Parallel roadmapping in PROPOSAL mode (unnumbered phases)
- `gsd-roadmap-synthesizer` agent: assigns all milestone versions and phase numbers
- Session continuity via BATCH-SESSION.md and `--resume` flag

## Completed Milestones

### v15.0 Autonomous Learning — SHIPPED 2026-04-04

**Delivered:** Closed the gap between "captures data" and "acts on it" — auto-apply engine with 5 safety gates applies high-confidence skill refinements automatically, revert command restores pre-auto-apply state, failed checks surface transparently as pending suggestions, per-project review profiles shift code review focus based on correction history, decision audit trail detects correction-decision contradictions via Jaccard matching and surfaces tensions in /gsd:digest. 4 phases, 7 plans, 16/16 requirements satisfied.

### v11.0 Wild Brainstorming Engine — SHIPPED 2026-04-04

**Delivered:** Mechanically-enforced brainstorming engine that breaks Claude's self-censoring bias through code constraints — eval detection, append-only idea store, forced SCAMPER cycling, quantity floors with wild-mode doubling, saturation detection, context blinding, data-driven seeding from corrections/debt/sessions, `/gsd:brainstorm` command with 3-stage pipeline, converge with clustering and scoring, session history with auto-logging and new-milestone seed integration. 5 phases, 11 plans, 30/30 requirements satisfied.

### v12.0 Quality Enforcement Evolution — SHIPPED 2026-04-04

**Delivered:** Closed remaining quality enforcement gaps — ESLint gate fires on every code file write via PostToolUse hook with quality-level gating and graceful degradation, transition guards mechanically verify DONE criteria before phase completion (no more trust-based transitions), test coverage trending tracks test count per plan and surfaces delta in progress/digest. 3 phases, 7 plans, 14/14 requirements satisfied.

### v10.0 Shared MCP Dashboard — SHIPPED 2026-04-04

**Delivered:** MCP server endpoints mounted on existing dashboard server via StreamableHTTP transport — 8 read-only query tools (list-projects, get-project-state, get-gate-health, get-observations, get-sessions, get-skill-metrics, get-cost-metrics, get-git-status), installer auto-configuration with --no-mcp opt-out, Origin validation, full test coverage. 2 phases, 5 plans, 16/16 requirements satisfied.

### v9.0 Signal Intelligence — SHIPPED 2026-04-04

**Delivered:** Actionable signals extracted from existing observability data — fixed milestone-scoped progress tracking, populated skill call data in sessions and gate executions, added skill history audit trails, phase benchmarking, debt impact analysis, session analytics reporting, per-skill quality metrics with attribution, and keyword-based skill relevance scoring for context budget optimization. 6 phases, 8 plans, 25/25 requirements satisfied.

### v8.0 Close the Loop — SHIPPED 2026-04-03

**Delivered:** Closed the gap between "built" and "working" — skill feedback loop runs end-to-end (corrections → analysis → suggestions → refinement → loaded), quality gates fire deterministically via PostToolUse hooks with real data flowing to the dashboard. 4 phases, 8 plans, 12/12 requirements satisfied.

### v7.0 Quality Enforcement Observability — SHIPPED 2026-03-11

**Delivered:** Quality gate enforcement made fully observable — every gate execution, correction, and Context7 call persisted to disk, surfaced in the dashboard, and linked through gate-to-correction attribution analytics. 5 phases, 7 plans, 14/14 requirements satisfied.

### v6.0 Adaptive Observation & Learning Loop — SHIPPED 2026-03-11

**Delivered:** Intelligent correction-capture and preference-learning pipeline — hook-based correction detection, auto self-diagnosis, preference promotion, live recall injection, observer agent with suggestion pipeline, enhanced digest with collaborative skill refinement, and cross-project inheritance with learned skill loading in all GSD commands.

### v4.0 Adaptive Learning Integration — SHIPPED 2026-03-09

**Delivered:** Merged gsd-skill-creator into GSD core — one package, one install, native skill awareness with observation baked into every workflow command. 7 phases, 15 plans, 39/39 requirements satisfied.

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

Shipped v15.0 with ~100K LOC across 20+ CJS source modules + 30 test suites, plus workflow/agent Markdown specifications, 16 skills, 4 teams, a TypeScript dashboard with Gate Health page and MCP server, adaptive learning pipeline with autonomous auto-apply engine, skill feedback loop, gate enforcement hooks (including ESLint gate), transition guards, signal intelligence analytics, cross-session MCP query tools, brainstorming engine, per-project adaptive review profiles, and decision audit trail with Jaccard tension detection.
Tech stack: Node.js, CJS modules, TypeScript (dashboard), Markdown agent specifications, Context7 MCP, @modelcontextprotocol/sdk v1.29.0.
Tests: 1220+ passing across 30 test suites.

**Quality enforcement** (v1.0-v1.1): Full Plan→Execute→Verify loop with Quality Sentinel, Context7 library lookup, mandatory testing, quality dimensions, config-gated enforcement levels (fast/standard/strict), and observability.

**Concurrent milestones** (v2.0): Workspace isolation via `planningRoot()`, `--milestone` flag threading, lock-free dashboards, advisory conflict detection.

**Tech debt system** (v3.0): DEBT.md with 10-field schema, `debt log/list/resolve` CLI commands, executor/verifier auto-logging gated by quality level, `/gsd:fix-debt` skill for on-demand resolution.

**Legacy strip** (v3.1): Milestone-scoped is now the only supported layout. All layout branching removed. Net reduction of ~14K lines.

**Adaptive learning** (v4.0): gsd-skill-creator merged into core. Single installer delivers skills, teams, hooks, and CLAUDE.md. Native observation in all 7 workflow commands.

**Device-wide dashboard** (v5.0): Multi-project command center with live terminal integration, session monitoring, cross-project metrics.

**Quality observability** (v7.0): Gate execution persistence to JSONL, correction quality context, Context7 call logging, dedicated Gate Health dashboard page, overview integration (quality badges, gate summaries), gate-to-correction attribution analytics.

**Adaptive observation** (v6.0): Hook-based correction capture with 14-category taxonomy, preference tracking with confidence scoring, live recall injection (session-start + within-session), observer agent with suggestion pipeline and 6 bounded learning guardrails, enhanced digest with collaborative skill refinement, cross-project preference inheritance, learned skill loading in all GSD commands and subagents.

**Skill feedback loop** (v8.0): analyze-patterns.cjs auto-triggers via SessionEnd hook, suggestions surfaced at session start, /gsd:refine-skill accepts/dismisses suggestions into SKILL.md files. Full loop verified E2E.

**Gate enforcement** (v8.0): Quality sentinel gates moved from agent prose instructions to deterministic PostToolUse hooks. test_gate fires on test commands, diff_review fires on code file writes. Real entries persist to gate-executions.jsonl and flow to dashboard Gate Health page.

**Shared MCP dashboard** (v10.0): StreamableHTTP MCP server at `/mcp` on existing dashboard — 8 read-only query tools for cross-session/cross-project data access, stateless per-request transport, Origin validation, installer auto-configuration to `~/.claude.json`.

**Quality enforcement evolution** (v12.0): ESLint gate fires on code file writes via PostToolUse hook (extending gate-runner.cjs), transition guards mechanically verify `<done>` criteria before phase completion (parseDoneCriteria + verifyAssertions wired into cmdVerifyPhaseCompleteness), test coverage trending tracks test count per plan with delta computation in phase-benchmarks.jsonl and surfaces in progress/digest.

**Autonomous learning** (v15.0): Auto-apply engine with 5 safety gates (CONFIG, RATE, QUALITY, CONFIDENCE, SIZE) applies high-confidence skill refinements at SessionEnd, revert command restores pre-auto-apply state, failed checks surface as pending suggestions with `auto_apply_failed` flag, per-project review profiles generated from correction category distribution, code-review skill adapts focus automatically, decision audit trail detects correction-decision tensions via Jaccard overlap and surfaces in /gsd:digest.

**Known tech debt:** See `.planning/DEBT.md` and MILESTONES.md for remaining items.

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
| 14-category two-tier correction taxonomy | Broad enough to cover all correction types, narrow enough to be actionable | ✓ Good — consistent categorization across capture, analysis, and digest |
| Silent failure in all hook utilities | Hooks must never break user workflow; always exit 0 | ✓ Good — zero user-facing failures from correction pipeline |
| JSONL over SQLite for corrections | File-based aligns with GSD philosophy; no binary dependencies | ✓ Good — human-readable, git-friendly, rotation-based lifecycle |
| 3-correction threshold for preference promotion | Low enough to learn quickly, high enough to filter noise | ✓ Good — balances responsiveness with false-positive prevention |
| 6 bounded learning guardrails | Prevents runaway auto-modification of skills | ✓ Good — user always in control of skill changes |
| Recall exclusion for baked preferences | Skills are the durable layer; recall is staging | ✓ Good — prevents double-surfacing of already-incorporated learnings |
| Cross-project promotion at 3+ projects | Ensures preferences are truly universal before elevating | ✓ Good — project-specific quirks don't pollute global store |

---
*Last updated: 2026-04-04 after v14.0 Planning Intelligence milestone started*
