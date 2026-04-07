# Milestones

## v16.0 Multi-Milestone Batch Planner (Shipped: 2026-04-07)

**Phases completed:** 3 phases, 6 plans, 2 tasks

**Key accomplishments:**
- (none recorded)

---

## v13.0 Unified Observability & Context Routing (Shipped: 2026-04-04)

**Delivered:** Unified event journaling, context budget optimization, and advisory MCP server selection — three independent observability systems that share a root cause (fragmented data silos) now unified through workflow.jsonl, cost tracking, and task classification.

**Phases:** 3 phases (84-86), 6 plans
**Code:** 63 files changed (+7,762 / -771)
**Timeline:** 1 day (2026-04-04)
**Git range:** 59bd764 → 242b043
**Requirements:** 13/13 satisfied
**Tests:** 38 new (1243 total passing)

**Key accomplishments:**
1. Event journaling — `emitEvent` writes structured events to `workflow.jsonl`, integrated into gate-runner, correction hooks, and session hooks, with reader/query API and digest timeline
2. Context budget optimizer — per-skill token cost (chars/4), session recording, aggregation (avg cost, load freq, cost-per-fire), digest section with deferral recommendations
3. MCP server selection — task-type classifier with 5 types, recommendation mapping, advisory step in execute-plan workflow, optional dashboard validation
4. 38 new tests across 3 test suites (event-journal unit/integration, context-budget, mcp-classifier)

---

## v15.0 Autonomous Learning (Shipped: 2026-04-04)

**Phases completed:** 1 phases, 1 plans, 0 tasks

**Key accomplishments:**
- (none recorded)

---

## v11.0 Wild Brainstorming Engine (Shipped: 2026-04-04)

**Delivered:** Mechanically-enforced brainstorming engine that breaks Claude's self-censoring bias through code constraints. Three-stage pipeline (Seed → Expand → Converge) with evaluation detection, append-only idea store, forced SCAMPER cycling, quantity floors, saturation detection, context blinding, data-driven seeding, and session history tracking.

**Phases:** 5 phases (45-49), 11 plans
**Code:** 2,301 LOC across brainstorm.cjs (893), workflow (496), tests (866), command (46)
**Timeline:** 1 day (2026-04-04)
**Git range:** 6a09753 → 96dc099
**Requirements:** 30/30 satisfied
**Tests:** 87 brainstorm-specific tests, 0 failures

**Key accomplishments:**
1. Enforcement core — eval detection (23 patterns + 7 wild), append-only JSONL store, SCAMPER forced cycling (all 7 lenses), quantity floors with wild-mode doubling, velocity-based saturation detection
2. Converge pipeline — keyword-frequency clustering (3-7 themes, 100% placement), 4-dimension scoring with composite formula, finalist selection, 3-file output formatting
3. `/gsd:brainstorm` command — 473-line 3-stage workflow with interactive SCAMPER, perspective shifts, saturation switching, `--wild` mode
4. Data-driven seeding — `--from-corrections`, `--from-debt`, `--for-milestone` flags with context blinding (excludes ROADMAP/STATE), prior brainstorm dedup
5. Session history — auto-logging, idea-to-phase tagging, implemented queries, `/gsd:new-milestone` seed context integration
6. 20 CLI sub-commands in `brainstorm` namespace wired into gsd-tools.cjs

**Tech Debt (from verification):**
- `"might"` in WILD_EXTRA_PATTERNS overlaps with `"might not"` in EVAL_PATTERNS (cosmetic duplicate violations in wild mode)
- Empty topic produces trailing hyphen in output dir name
- REQUIREMENTS.md traceability checkboxes not auto-updated (doc drift)
- $SEED_IDEAS variable scoping fragility across workflow steps (shared pattern, not regression)

---

## v12.0 Quality Enforcement Evolution (Shipped: 2026-04-04)

**Delivered:** Closed remaining quality enforcement gaps — ESLint gate fires on every code file write via PostToolUse hook with quality-level gating and graceful degradation, transition guards mechanically verify DONE criteria before phase completion (no more trust-based transitions), test coverage trending tracks test count per plan and surfaces delta in progress/digest.

**Phases:** 3 phases (50-52), 7 plans
**Code:** 70 files changed (+8,018 / -171)
**Timeline:** 1 day (2026-04-04)
**Git range:** adb3228 → b6dc3c5
**Requirements:** 14/14 satisfied
**Commits:** 63

**Key accomplishments:**
1. ESLint gate enforcement — PostToolUse hook fires `eslint_gate` on .ts/.js/.cjs writes via subprocess with fast=skip, standard=warn, strict=block quality gating and graceful degradation
2. DONE criteria parser — Extracts `<done>` tag bullets from PLAN.md files and classifies into file-exists, grep-for-export, test-passes, or human-check assertion types
3. Transition guards — `cmdVerifyPhaseCompleteness` now calls `runTransitionGuards` to mechanically verify DONE criteria before the verifier agent runs
4. Test coverage trending — Test count captured at plan completion via `npm test` output parsing, persisted to phase-benchmarks.jsonl with delta computation
5. Progress/digest integration — `/gsd:progress` shows test count delta, `/gsd:digest` renders test count trend table across milestones
6. Dashboard aggregation fix — Fixed hardcoded VALID_GATES in server.cjs so new gate types (like eslint_gate) surface automatically in Gate Health

**Tech Debt (7 non-critical items from audit):**
- LINT-01 requirement text says "ESLint MCP gate" but implementation uses subprocess (naming gap)
- server.cjs has two separate VALID_GATES arrays that must be kept in sync
- loadConfig() strips quality key — direct JSON.parse on config.json needed
- test-passes assertion defaults to needs-human (runTests=true not wired in workflows)
- Most SUMMARY.md files missing requirements-completed frontmatter (cosmetic)
- progress.md fallback text wording deviation (cosmetic)
- 52-02 frontmatter wave:1 should be wave:2 (metadata inconsistency)

---

## v10.0 Shared MCP Dashboard (Shipped: 2026-04-04)

**Delivered:** MCP server endpoints mounted on existing dashboard server via StreamableHTTP transport — 8 read-only query tools for cross-session/cross-project data access, installer auto-configuration, Origin validation, and full test coverage.

**Phases:** 2 phases (43-44), 5 plans
**Code:** 38 files changed (+6,406 / -24)
**Timeline:** 1 day (2026-04-04)
**Git range:** 5010d9f → b930d6b
**Requirements:** 16/16 satisfied
**Commits:** 18

**Key accomplishments:**
1. MCP server scaffolding — StreamableHTTP transport at `/mcp` on existing dashboard server with stateless per-request handling and DNS rebinding protection
2. 8 read-only query tools — list-projects, get-project-state, get-gate-health, get-observations, get-sessions, get-skill-metrics, get-cost-metrics, get-git-status
3. Installer auto-configuration — `writeMcpConfig` in `install.js` writes `mcpServers.gsd-dashboard` to `~/.claude.json` with `--no-mcp` opt-out
4. Bug fixes — gate-health null spread and suggestions file extension mismatch resolved
5. Full test suite — 9 tests (8 unit + 1 integration) covering all tool handlers with no HTTP server dependency

**Tech Debt (2 minor items from verification):**
- `ALLOWED_ORIGINS` hardcodes port 7778 but dashboard defaults to 3141 (low impact — Claude Code sends no Origin)
- Integration test uses random port without collision guard (use port 0 for OS-assigned)

---

## v9.0 Signal Intelligence (Shipped: 2026-04-04)

**Phases completed:** 6 phases, 8 plans, 0 tasks

**Key accomplishments:**
- (none recorded)

---

## v8.0 Close the Loop (Shipped: 2026-04-03)

**Delivered:** Closed the gap between "built" and "working" for two core systems — the skill observation feedback loop now runs end-to-end (correction capture → pattern analysis → suggestion surfacing → skill refinement → loaded in next session), and quality sentinel gates now fire deterministically via PostToolUse hooks with real data flowing to the dashboard.

**Phases:** 4 phases (33-36), 8 plans
**Code:** 32 files changed (+3,050 / -17)
**Timeline:** 1 day (2026-04-02)
**Git range:** 0be7fa2 → 9e67170
**Requirements:** 12/12 satisfied
**Commits:** 27

**Key accomplishments:**
1. Skill loop auto-trigger — analyze-patterns.cjs wired to SessionEnd hook, populates scan-state.json watermark after every session
2. Suggestion surfacing — pending skill suggestions presented at session start via recall hook with configurable suggest_on_session_start gate
3. Skill refinement flow — /gsd:refine-skill command accepts/dismisses suggestions, modifies SKILL.md files and commits changes
4. Full skill feedback loop verified E2E — correction → pattern detected → suggestion generated → surfaced → skill refined → loaded in next session
5. Hook-based gate enforcement — quality gates fire deterministically via PostToolUse hooks on Bash test runs and Write code files (not dependent on agent instructions)
6. Gate observability pipeline — real gate entries flow to gate-executions.jsonl, dashboard Gate Health page displays live data, smoke test confirmed 34→37 entry increase

**Tech Debt (from audit):**
- `/FAIL\b/` regex doesn't match "FAILED" (low impact — Vitest uses "FAIL")
- `test_baseline` gate deferred (documented in GATE-ENFORCEMENT-DECISION.md)
- 10/12 REQUIREMENTS.md checkboxes unchecked (cosmetic — all verified PASS)
- 8/12 SUMMARY.md files missing requirements-completed frontmatter (cosmetic)
- 3 pre-existing test failures unrelated to v8.0

---

## v6.0 Adaptive Observation & Learning Loop (Shipped: 2026-03-11)

**Delivered:** Transformed the observation system from a passive event logger into an intelligent correction-capture and preference-learning pipeline that feeds back into skill refinement — Claude learns from its mistakes and adapts to user expectations.

**Phases:** 6 phases (22-27), 17 plans
**Code:** 131 files changed (+17,820 / -422)
**Timeline:** 2 days (2026-03-10 → 2026-03-11)
**Git range:** 36e34f5 → 41e38dc
**Requirements:** 19/19 satisfied
**Commits:** 133

**Key accomplishments:**
1. Hook-based correction capture — PostToolUse hook detects edits, reverts, and self-reports; writes structured JSONL with 14-category taxonomy and auto-rotation
2. Preference tracking — repeated corrections (3+) auto-promote to durable preferences with confidence scoring and scope tagging
3. Live recall injection — session-start hook surfaces relevant corrections/preferences (≤10 entries, ≤3K tokens), within-session cross-referencing catches repeat mistakes
4. Observer agent and suggestion pipeline — pattern aggregation engine with 6 bounded learning guardrails and `/gsd:suggest` interactive refinement command
5. Enhanced digest with skill refinement — `/gsd:digest` groups corrections by category with trends; collaborative skill refinement workflow retires source data after baking
6. Cross-project inheritance and skill loading — user-level preference promotion across 3+ projects, all 7 GSD commands and all subagents inherit learned context

**Tech Debt (8 minor items from audit):**
- Phase 22: Test fixture uses `phase: '22'` (string) instead of integer
- Phase 25: suggest.md atomic write uses Write tool, not true shell rename
- Phase 25: Watermark comparison uses string comparison (assumes UTC-only timestamps)
- Phase 26: retireByCategory early-returns on missing patternsDir
- Phase 26: CATEGORY_SKILL_MAP duplicated in digest.md vs analyze-patterns.cjs
- Phase 26: Dual-write pattern in suggest.md relies on prose re-read instruction
- Deployment: Workflow/command changes in source only (expected for dev project)

---

## v7.0 Quality Enforcement Observability (Shipped: 2026-03-11)

**Delivered:** Quality gate enforcement made fully observable — every gate execution, correction, and Context7 call persisted to disk, surfaced in the dashboard, and linked through gate-to-correction attribution analytics.

**Phases:** 5 phases (28-32), 7 plans
**Code:** 84 files changed (+10,527 / -170)
**Timeline:** 2 days (2026-03-10 → 2026-03-11)
**Git range:** 07f7f0d → 3681f1b
**Requirements:** 14/14 satisfied
**Commits:** 77

**Key accomplishments:**
1. Gate execution persistence — all 5 sentinel steps recorded to gate-executions.jsonl with quality-level-aware filtering
2. Correction quality context — quality_level field added to all correction entries for enforcement-level tracking
3. Context7 call logging — every library lookup persisted to context7-calls.jsonl with token budgets and usage flags
4. Quality gating research — evaluated 5 MCP servers/tools, recommended ESLint MCP for future integration
5. Dashboard Gate Health page — dedicated page with outcome distribution, quality level usage, per-gate firing rates, and Context7 metrics
6. Overview integration — quality level badges on project cards, gate summaries on milestone lines and tmux cards
7. Gate-to-correction attribution — heuristic analysis mapping correction categories to originating gates with confidence scores

**Tech Debt (3 minor items from audit):**
- Commit subject 79 chars in phase 29 (non-actionable, merged)
- SUMMARY.md files 30-01, 31-01 missing requirements-completed frontmatter (cosmetic)

---

## v4.0 Adaptive Learning Integration (Shipped: 2026-03-09)

**Delivered:** Merged gsd-skill-creator into GSD core — one package, one install, native skill awareness with observation baked into every workflow command.

**Phases:** 7 phases (12-16.2), 15 plans
**Code:** 288 files changed (+41,954 / -54)
**Timeline:** 3 days (2026-03-07 → 2026-03-09)
**Git range:** feat(12-01) → docs(phase-16.2)
**Requirements:** 39/39 satisfied
**Commits:** 98

**Key accomplishments:**
1. Unified config — skill-creator.json merged into config.json under adaptive_learning key with auto-migration
2. Single installer — one install.js run delivers 16 skills, 4 teams, 9 hooks, and CLAUDE.md to user projects
3. Native agent integration — skill-awareness and capability inheritance baked inline into executor/planner (no extension markers)
4. Dashboard copy-and-verify — 15K LOC dashboard builds from gsdup repo with standalone CLI command
5. Native observation — all 7 workflow commands capture structured observations to sessions.jsonl
6. Command consolidation — 13 standalone commands ported to /gsd:* namespace, /wrap:* and /sc:* removed

**Tech Debt (3 non-critical items from audit):**
- CFG-02: migrateSkillCreatorConfig() wired but untested on real legacy projects
- Analysis commands (gsd:suggest, gsd:digest) read data files that no component currently writes
- Dashboard auto-trigger on phase transitions documented but not wired into workflows

---

## v3.1 Tech Debt Cleanup, Legacy Strip & README (Shipped: 2026-03-05)

**Delivered:** Eliminated all legacy flat-layout code, making milestone-scoped the only supported layout. Fixed all v3.0 behavioral bugs, rewrote entire test infrastructure for milestone-scoped paths, and shipped fork documentation.

**Phases:** 7 phases, 12 plans
**Code:** 254 files changed (+16,090 / -29,912) — net reduction of ~14K lines
**Timeline:** 7 days (2026-02-27 → 2026-03-05)
**Git range:** docs: start milestone v3.1 → docs(phase-11): complete phase execution
**Requirements:** 14/14 satisfied
**Tests:** 716/717 passing

**Key accomplishments:**
1. Fixed all 5 behavioral bugs from v3.0 — cmdMilestoneComplete phasesDir, execute-plan --milestone flag, DEBT.md init, CLI help text
2. Deleted `migrate.cjs` and all legacy layout support — milestone-scoped is now the only layout
3. Stripped `detectLayoutStyle()`, `getArchivedPhaseDirs()`, and all layout branching from core/init/roadmap/phase/commands
4. Removed all `layout_style`/`LAYOUT` conditionals from 8 workflow files — simplified milestone routing
5. Rewrote all test infrastructure to create milestone-scoped layouts; removed `findPhaseInternal` legacy fallback
6. Created README.md and FORK-GUIDE.md documenting the fork's purpose, features, and setup

**Tech Debt (4 non-critical items):**
- MISS-01: `cmdStateUpdateProgress` uses flat `.planning/phases/` path (medium)
- MISS-02: Two stale `/gsd:cleanup` references in help.md and complete-milestone.md (low)
- README.md stats drift: "710 across 21 suites" vs actual 717/23 (low)
- Dead test code: e2e.test.cjs and routing.test.cjs create redundant flat dirs (info)

---
## v1.0 MVP (Shipped: 2026-02-24)

**Delivered:** Quality enforcement framework that makes Claude's executor behave like a senior engineer — checks the codebase, reads the docs, writes tests, reviews its own diffs — enforced by protocol, gated by config.

**Phases:** 4 phases, 8 plans
**Files modified:** 31 (+4,423 / -77)
**Timeline:** 1 day (2026-02-23 → 2026-02-24)
**Git range:** feat(01-01) → feat(04-01)
**Requirements:** 23/23 satisfied

**Key accomplishments:**
1. Fixed `is_last_phase` routing bug — multi-phase milestones route correctly via filesystem scan
2. Established quality config infrastructure — `quality.level` (fast/standard/strict) with fast as zero-change default
3. Added Quality Sentinel to executor — pre-task codebase scan, Context7 library lookup, mandatory tests, post-task diff review
4. Added Step 7b quality dimensions to verifier — duplication detection, orphaned exports, missing test files
5. Added `quality_scan` directives to planner — task actions specify code to reuse, docs to consult, tests to write
6. Wired Plan→Execute→Verify loop end-to-end — executor consumes planner quality_scan directives

**Tech Debt (4 low/info items):**
- SUMMARY.md frontmatter lacks `requirements-completed` field in all 8 plan summaries
- CFG-04 traceability row shows Phase 1 only; Phase 4 closure not back-filled
- execute_tasks sentinel references omit parenthetical step numbers (cosmetic)
- context7_protocol fast mode encoded as skip condition rather than named heading (cosmetic)

---


## v1.1 Quality UX (Shipped: 2026-02-24)

**Delivered:** Quality enforcement made discoverable, configurable, and observable — users can switch quality levels, see what mode they're in, and inspect what quality gates did during execution.

**Phases:** 3 phases, 5 plans, 10 tasks
**Files modified:** 34 (+3,781 / -34)
**Timeline:** ~4 hours (2026-02-23 21:57 → 2026-02-24 02:19)
**Git range:** feat(05-01) → feat(07-01)
**Requirements:** 9/9 satisfied

**Key accomplishments:**
1. Config auto-migration adds quality block to existing projects + global defaults bootstrap via ~/.gsd/defaults.json
2. Context7 per-query token cap made configurable via quality.context7_token_cap with runtime reads
3. /gsd:set-quality command with per-project and global scope (TDD-tested backend + UX workflow)
4. Quality gate outcome tracking (GATE_OUTCOMES array) in executor sentinel
5. Quality Gates section in SUMMARY.md for standard/strict modes — full observability of gate activity

---


## v2.0 Concurrent Milestones (Shipped: 2026-02-25)

**Delivered:** Concurrent milestone execution — isolated workspaces per milestone, lock-free dashboard, advisory conflict detection, full routing update across all workflows, and backward-compatible legacy support with zero migration required.

**Phases:** 7 phases, 13 plans
**Code:** 108 files changed (+26,299 / -5,442)
**Timeline:** 1 day (2026-02-24 → 2026-02-25)
**Git range:** feat(08-01) → docs(phase-13)
**Requirements:** 34/34 satisfied
**Tests:** 232/235 passing (87 new v2.0 tests)

**Key accomplishments:**
1. `planningRoot()` and `detectLayoutStyle()` — single path resolver and three-state layout detection as foundation for all milestone-scoped operations
2. Workspace isolation — `new-milestone` creates `.planning/milestones/<v>/` with STATE.md, ROADMAP.md, REQUIREMENTS.md, conflict.json, phases/, research/
3. Advisory conflict detection — `manifest-check` reads all active milestone conflict.json files and reports overlapping file paths (exit 0 always)
4. Live multi-milestone dashboard — `cmdMilestoneWriteStatus` updates per-milestone STATUS.md at natural checkpoints, `cmdProgressRenderMulti` aggregates all active milestones
5. Full routing update — `--milestone` flag threaded through all 7 workflow files and all 7 init commands, `MILESTONE_FLAG` construction pattern standardized
6. Comprehensive test coverage — E2E lifecycle tests for both legacy and milestone-scoped modes, 90%+ branch coverage on all new functions

**Known Gaps (accepted as tech debt):**
- INTEGRATION-3: `cmdInitPlanPhase` hardcodes `state_path`/`roadmap_path` instead of using `planningRoot`
- INTEGRATION-4: `cmdRoadmapGetPhase` and `cmdRoadmapAnalyze` ignore `--milestone` flag
- Tracked in `.planning/TO-DOS.md`

---


## v3.0 Tech Debt System (Shipped: 2026-02-26)

**Delivered:** Systematic tech debt tracking and resolution infrastructure — structured DEBT.md schema, CLI commands for debt lifecycle management, executor/verifier auto-logging with quality-level gating, migration tool for existing projects, and `/gsd:fix-debt` on-demand resolution skill.

**Phases:** 6 phases, 8 plans, 14 tasks
**Code:** 118 files changed (+13,227 / -1,211)
**Timeline:** ~21 hours (2026-02-25 → 2026-02-26)
**Git range:** docs: start milestone v3.0 → docs(phase-3.5)
**Requirements:** 19/19 satisfied
**Tests:** 266 passing (34 new v3.0 tests)

**Key accomplishments:**
1. Fixed milestone-scoped path resolution in cmdInitPlanPhase and roadmap commands via planningRoot() threading (v2.0 INTEGRATION-3/4 debt resolved)
2. TDD-built tech debt tracking module — DEBT.md schema with TD-NNN IDs, `debt log/list/resolve` CLI commands, 19-test suite
3. Normalized .planning/milestones/ structure and fixed plan-level checkbox flip + milestone workspace finalization
4. `migrate.cjs` with dry-run inspection and additive-only apply for upgrading existing .planning/ layouts
5. Executor and verifier agents auto-log discovered debt with quality-level gating (fast=off, standard=critical/high, strict=all) and provenance fields
6. `/gsd:fix-debt` slash command: 8-step orchestrator routing debt entries through debugger diagnosis and executor fix execution

**Known Gaps (accepted as tech debt):**
- FLOW-02: cmdMilestoneComplete phasesDir hardcoded to .planning/phases/ — broken for milestone-scoped layouts
- FLOW-01: execute-plan.md doesn't pass --milestone flag to roadmap update-plan-progress
- CLI help text incomplete (missing migrate, debt, milestone commands)
- Agent files (gsd-executor.md, gsd-verifier.md) live outside git repo
- Dual-file maintenance for fix-debt.md (repo vs installed copies)

---

## v9.0 Signal Intelligence (Shipped: 2026-04-04)

**Delivered:** Actionable signals extracted from existing observability data — fixed milestone-scoped progress tracking (MISS-01), populated skill call data across all workflows, added skill history audit trails, phase benchmarking, debt impact analysis, session analytics reporting, per-skill quality metrics with CATEGORY_SKILL_MAP attribution, and keyword-based skill relevance scoring for context budget optimization.

**Phases:** 6 phases (37-42), 8 plans
**Code:** 64 files changed (+4,669 / -38)
**Timeline:** 1 day (2026-04-03 → 2026-04-04)
**Commits:** 32
**Requirements:** 25/25 satisfied

**Key accomplishments:**
1. Progress tracking fix — cmdStateUpdateProgress resolves via planningRoot() for milestone-scoped projects (MISS-01 debt resolved)
2. Skill call tracking — skills_loaded populated in sessions.jsonl and skills_active in gate-executions.jsonl across all 6 workflow files
3. Data capture triad — SKILL-HISTORY.md with unified diffs and 50-entry rotation, phase-benchmarks.jsonl with per-plan metrics, debt-to-correction impact analysis with link_confidence
4. Session analytics — /gsd:session-report surfaces per-session correction density, gate fires, skills loaded, and benchmark trends
5. Skill quality metrics — per-skill correction rates via CATEGORY_SKILL_MAP attribution with confidence tiers, surfaced in /gsd:digest
6. Skill relevance scoring — Jaccard keyword overlap with cold-start floor (0.3 for <14 days), dormancy decay (10%/week), and MD5 content-hash caching

**Tech Debt (1 cosmetic item from audit):**
- Phase 42: Co-Authored-By trailer uses Sonnet instead of Opus in 3 commits (committed history)

## v11.0

**Phase:** 49 | **Plan:** 2 | **Status:** Complete
**Progress:** 2/2 plans (100%)
**Updated:** 2026-04-04
## v10.0

**Phase:** 44 | **Plan:** 2 | **Status:** Complete
**Progress:** 2/2 plans (100%)
**Updated:** 2026-04-04
## v12.0

**Phase:** 52 | **Plan:** 2 | **Status:** Complete
**Progress:** 2/2 plans (100%)
**Updated:** 2026-04-04
## v15.0

**Phase:** 83 | **Plan:** 2 | **Status:** Complete
**Progress:** 2/2 plans (100%)
**Updated:** 2026-04-04
## v13.0

**Phase:** 86 | **Plan:** 2 | **Status:** Complete
**Progress:** 2/2 plans (100%)
**Updated:** 2026-04-04
## v16.0 Multi-Milestone Batch Planner (Shipped: 2026-04-05)

**Delivered:** `/gsd:multi-milestone` command with 941-line 5-stage pipeline — takes a feature dump (inline, file, or brainstorm), clusters into milestone themes, creates N workspaces in parallel, runs per-milestone research + full requirements scoping, spawns N parallel roadmappers in proposal mode, then a roadmap synthesizer assigns all version and phase numbers sequentially and writes every artifact.

**Phases:** 3 phases (87-89), 6 plans
**Code:** 30 files changed (+4,367 / -1,190)
**Timeline:** 2 days (2026-04-04 → 2026-04-05)
**Git range:** feac1fd → f82318a
**Requirements:** 19/19 satisfied

**Key accomplishments:**
1. Roadmap synthesizer agent — `gsd-roadmap-synthesizer` with sequential cursor algorithm for gap-free phase numbering across N milestones
2. Proposal mode — roadmapper produces unnumbered PROPOSAL.md with PHASE-A/PHASE-B placeholders; synthesizer assigns all numbers in one pass
3. 5-stage workflow — feature intake (freeform/file/brainstorm) → workspace creation → per-milestone scoping → parallel roadmapping → synthesis + review
4. Per-milestone research opt-in — 4 parallel researcher agents + synthesizer before scoping, independently skippable
5. Session continuity — BATCH-SESSION.md tracks stage completion; `--resume NN` re-enters from last completed stage
6. Parallel workspace creation — N milestones (cap N<=20) with consolidated conflict check after all workspaces exist
## v14.0

**Phase:** 91 | **Plan:** 3 | **Status:** Complete
**Progress:** 3/3 plans (100%)
**Updated:** 2026-04-06