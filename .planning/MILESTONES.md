# Milestones

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

## v5.0

**Phase:** 21 | **Plan:** 6 | **Status:** Complete
**Progress:** 6/6 plans (100%)
**Updated:** 2026-03-09

## v6.0

**Phase:** 27 | **Plan:** 27-03 | **Status:** In Progress
**Progress:** 3/3 plans (100%)
**Updated:** 2026-03-11