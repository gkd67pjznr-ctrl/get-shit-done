# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.1 — Quality UX

**Shipped:** 2026-02-24
**Phases:** 3 | **Plans:** 5 | **Sessions:** ~2

### What Was Built
- Config auto-migration and global defaults system (~/.gsd/defaults.json)
- /gsd:set-quality command with per-project and --global scope
- Quality gate outcome tracking (GATE_OUTCOMES) in executor sentinel
- Quality Gates section in SUMMARY.md templates for standard/strict modes
- Config validation warnings on missing sections
- Context7 configurable token cap
- Progress and help UX improvements (quality level display, patches reminder)

### What Worked
- TDD pattern (RED/GREEN) caught real bugs during implementation (spawnSync vs execSync, cmdConfigGet vs loadConfig path)
- Phase dependency chain worked well — Phase 5 foundation → Phase 6 commands → Phase 7 observability built cleanly on each other
- 100% of auto-fixed deviations were genuine bugs in plans, not scope creep — deviation system working as intended
- All 9 requirements mapped cleanly to 3 phases with zero unmapped requirements

### What Was Inefficient
- ROADMAP.md progress table had inconsistent milestone column formatting for v1.1 phases (missing v1.1 label on phases 5-6)
- Plan generation sometimes suggested loadConfig for quality.level reads, but loadConfig doesn't expose the quality section — this bug surfaced twice across Phase 6

### Patterns Established
- GSD_HOME env var for test isolation of global state
- requiredQualityDefaults single source of truth for config defaults
- Runtime config reads (bash one-liner with fallback) for values that should reflect live changes
- Gate outcome vocabulary: passed/warned/skipped/blocked with clear per-level semantics
- New GSD command = pair of files: commands/gsd/X.md (entry) + workflows/X.md (logic)

### Key Lessons
1. When a library function (loadConfig) returns a subset of config, don't assume it returns everything — read directly when you need fields it doesn't expose
2. spawnSync > execSync when you need stderr on exit code 0 — this is a Node.js gotcha worth remembering
3. Guard variables (GATE_OUTCOMES_INITIALIZED) prevent state reset in loops — useful pattern for per-plan-not-per-task initialization

### Cost Observations
- Model mix: ~80% sonnet (executor), ~15% haiku (plan-checker), ~5% opus (orchestration)
- Sessions: ~2
- Notable: 5 plans in ~26 min total execution time; config/UX work slightly slower than pure agent-file modifications

---

## Milestone: v2.0 — Concurrent Milestones

**Shipped:** 2026-02-25
**Phases:** 7 | **Plans:** 13 | **Sessions:** ~5

### What Was Built
- `planningRoot()` and `detectLayoutStyle()` — central path resolution and three-state layout detection as foundation for all milestone-scoped operations
- Workspace isolation — `new-milestone` creates `.planning/milestones/<v>/` with complete scaffold (STATE.md, ROADMAP.md, REQUIREMENTS.md, conflict.json, phases/, research/)
- Advisory conflict detection — `manifest-check` reads all active milestone conflict.json files, reports overlapping file paths, always exits 0
- Live multi-milestone dashboard — per-milestone STATUS.md written at checkpoints, `cmdProgressRenderMulti` aggregates all active milestones
- Full routing update — `--milestone` flag threaded through all 7 workflows and all 7 init commands via `MILESTONE_FLAG` construction pattern
- Comprehensive test coverage — E2E lifecycle tests for both legacy and milestone-scoped modes, 90%+ branch coverage on all new functions (232/235 tests passing)
- Integration wiring fixes — MILESTONE_VERSION extraction and update-manifest wiring from first audit

### What Worked
- Milestone audit workflow caught 2 real integration gaps (INTEGRATION-1, INTEGRATION-2) that led to Phase 14 gap closure — the audit-before-complete pattern proved its value
- `planningRoot()` as single path resolver eliminated string literal paths across the codebase — clean dependency chain, easy to test and reason about
- TDD continued to catch real bugs: `cmdInitExecutePhase` had hardcoded `state_path`/`roadmap_path` that the E2E test in Phase 13 would have failed without the fix (commit c3170a9)
- Three-state detection (`uninitialized`/`legacy`/`milestone-scoped`) with explicit config sentinel avoided false positives from archive directories
- Phase dependency chain (8→9→10→11→12→14→13) executed cleanly with no circular dependencies

### What Was Inefficient
- First milestone audit found gaps that required Phase 14, then second audit found 2 MORE gaps (INTEGRATION-3, INTEGRATION-4) — integration checking should have been more thorough in the first pass
- `cmdInitPlanPhase` was missed when `cmdInitExecutePhase` was updated for milestone-scoped paths — copy-paste inconsistency between similar functions
- Roadmap commands (`cmdRoadmapGetPhase`, `cmdRoadmapAnalyze`) were never updated for milestone scope despite `--milestone` flag being threaded through workflows — the flag was silently dropped by the CLI router
- Some SUMMARY.md files lacked `one_liner` frontmatter field, making automated accomplishment extraction incomplete

### Patterns Established
- `MILESTONE_FLAG` construction block — standardized pattern in all workflows: extract layout_style + milestone_scope from INIT, build conditional `--milestone` flag
- `planningRoot(cwd, milestoneScope)` — truthiness check on milestoneScope, returns `.planning/` or `.planning/milestones/<v>/`
- Advisory-only conflict detection — warnings visible without blocking execution (exit 0 always)
- Lock-free dashboard — per-file STATUS.md writes, aggregated at read time, no coordination needed
- spawnSync child process pattern for testing functions that call `process.exit()`
- Milestone audit → gap closure → re-audit cycle as quality gate before milestone completion

### Key Lessons
1. When updating one init command for milestone-scoped paths, update ALL similar init commands — `cmdInitPlanPhase` was missed while `cmdInitExecutePhase` was fixed, creating INTEGRATION-3
2. CLI routers must pass new parameters to ALL functions that receive flags from workflows — `milestoneScope` was parsed in `main()` but never passed to roadmap commands, creating INTEGRATION-4
3. Integration checking should verify flag consumption, not just flag emission — workflows correctly passed `${MILESTONE_FLAG}` but the receiving functions silently ignored it
4. The milestone audit workflow is worth the investment — it caught real bugs that would have broken concurrent milestone execution in production

### Cost Observations
- Model mix: ~70% sonnet (executor, verifier, integration-checker), ~20% haiku (plan-checker, researchers), ~10% opus (orchestration)
- Sessions: ~5
- Notable: 7 phases with 13 plans completed in ~1 day; integration wiring fix phase was small (1 plan) but high-value

---

## Milestone: v3.0 — Tech Debt System

**Shipped:** 2026-02-26
**Phases:** 6 | **Plans:** 8 | **Sessions:** ~3

### What Was Built
- DEBT.md hub with 10-field structured entry format (TD-NNN IDs) and `debt log/list/resolve` CLI commands
- Plan-level checkbox flip in `cmdRoadmapUpdatePlanProgress` and milestone workspace finalization in `cmdMilestoneComplete`
- `migrate.cjs` with dry-run inspection, additive-only apply, undo manifest, and idempotency guarantees
- Executor auto-logging at two hook points (FIX ATTEMPT LIMIT, blocked gate) with quality-level gating
- Verifier auto-logging via Step 7c after quality dimension findings with provenance fields
- `/gsd:fix-debt` slash command: 8-step orchestrator routing debt entries through debugger diagnosis and executor fix execution
- Resolved v2.0 INTEGRATION-3 and INTEGRATION-4 gaps as foundation work (Phase 3.1)
- Normalized .planning/milestones/ directory structure (Phase 3.2.1)

### What Worked
- Opening with integration fixes (Phase 3.1) unblocked all subsequent phases that needed milestone-scoped paths
- Inserted Phase 3.2.1 to normalize the planning directory before building more features on it — prevented cascading issues
- TDD continued to catch real bugs: migrate.cjs existence guards were initially missing for REQUIREMENTS.md, caught by test suite
- Agent wiring (Phase 3.4) was purely additive — zero modifications to existing sentinel/verifier gate logic, only new subsections added
- Milestone audit (run before completion) correctly identified the phasesDir regression as a real bug
- Rich-description skip path for fix-debt in yolo mode — auto-logged debt entries from Phase 3.4 already contain enough context to skip diagnosis

### What Was Inefficient
- cmdMilestoneComplete phasesDir fix in Phase 3.2.1 (FLOW-02) addressed one code path, but the CLI's `milestone complete` command has a different code path that still uses hardcoded `.planning/phases/` — the regression wasn't caught because Phase 3.2.1 tests verified the fixed function but not the CLI wrapper
- execute-plan.md doesn't pass --milestone flag to `roadmap update-plan-progress` — this was documented in Phase 3.2.1 research but the fix was scoped only to the CJS module, not the workflow Markdown
- Agent files (gsd-executor.md, gsd-verifier.md) modified in Phase 3.4 live outside the git repo — changes can't be tracked or rolled back
- Dual-file maintenance created for fix-debt.md — repo copy uses tilde paths, installed copy uses absolute paths

### Patterns Established
- Debt entry schema: 10 fields (id, type, severity, component, description, date_logged, logged_by, status, source_phase, source_plan)
- Quality-level gating pattern for agent behavior: fast=off, standard=critical/high, strict=all
- Inline mini-plan pattern for fix-debt: executor spawned directly on `.planning/debug/debt-ID-fix/01-PLAN.md`, bypasses ROADMAP lookup
- `inspectLayout()` shared function pattern: same analysis used by both dry-run reporting and apply execution
- Error recovery table pattern for skills: map failure modes to safe status transitions (never leave entries in-progress)

### Key Lessons
1. When fixing a function (cmdMilestoneComplete), verify ALL callers use the fixed code path — the CLI wrapper had its own hardcoded path that bypassed the fix
2. Workflow Markdown files and CJS modules are separate layers — fixing the CJS module doesn't automatically fix workflow files that construct CLI calls
3. Agent files outside the git repo create a maintenance gap — consider a deployment/sync mechanism for future milestones
4. Inserted phases (3.2.1) are valuable when you discover structural issues that would cascade — the cost of inserting is low compared to building on a broken foundation

### Cost Observations
- Model mix: ~65% sonnet (executor), ~25% haiku (plan-checker, researchers), ~10% opus (orchestration)
- Sessions: ~3
- Notable: 8 plans in ~21 hours; Phase 3.4 agent wiring was fastest (3 min for 2 plans) because agent files are Markdown, not code

---

## Milestone: v3.1 — Legacy Strip & README

**Shipped:** 2026-03-05
**Phases:** 7 | **Plans:** 12 | **Sessions:** ~8

### What Was Built
- Fixed all 5 behavioral bugs from v3.0 (cmdMilestoneComplete phasesDir, execute-plan --milestone flag, DEBT.md init paths, CLI help text)
- Agent files tracked in git repo, fix-debt.md single-copy verified
- Deleted `migrate.cjs`, `compat.test.cjs`, `migrate.test.cjs`, and `migrate` CLI command
- Deleted `detectLayoutStyle()`, `getArchivedPhaseDirs()`, and all layout-style branching from core/init/roadmap/phase/commands
- Stripped `layout_style`/`LAYOUT` variables from all 8 workflow .md files
- Rewrote `createTempProject()`, `createConcurrentProject()`, `createLegacyProject()` test helpers for milestone-scoped layouts
- Migrated all 16 test files to use milestone-scoped paths; removed `findPhaseInternal` legacy fallback
- Updated README.md fork header with accurate stats; created FORK-GUIDE.md

### What Worked
- Feasibility analysis (quick-13) before legacy strip phases justified Path A (surgical strip) over Path B (rebuild) — saved significant effort
- Phased strip approach (P7 delete files → P8 strip core → P9 strip workflows → P11 close gaps) prevented cascading breakage
- Milestone audit caught the `findPhaseInternal` legacy fallback that tests were silently depending on — Phase 11 was created to close the gap
- Quick tasks (7-12, 14-15) filled gaps between phases without formal planning overhead — fixed real bugs users hit in production
- Net reduction of ~14K lines improved codebase maintainability

### What Was Inefficient
- Phase 8 had to restore `findPhaseInternal` legacy fallback because `createTempProject()` still created flat layouts — should have migrated test helpers first
- Phase numbering gap (no Phase 6) from scope changes during milestone planning — cosmetic but confusing
- README stats drifted during the milestone (said "710 across 21 suites" when actual was 717/23) — documentation should be updated last
- Quick tasks 7-12 were bugs discovered during v3.1 execution but not tracked as formal requirements — they worked but fell outside the traceability system

### Patterns Established
- Surgical strip pattern: delete files first (P7), then strip references from source (P8), then workflows (P9), then test infrastructure (P11)
- Test helper creates milestone-scoped layout by default — no test creates flat `.planning/phases/` anymore
- Quick tasks for production bugs discovered during milestone execution — lightweight alternative to formal phase insertion

### Key Lessons
1. When stripping a feature, migrate test infrastructure BEFORE removing runtime fallbacks — P8 had to restore the fallback because tests depended on it
2. Feasibility analysis is worth the session cost for any multi-phase refactor — quick-13 prevented a rebuild that would have taken days
3. Milestone audits are consistently high-value — this is the third milestone where audit-before-complete caught real gaps

### Cost Observations
- Model mix: ~60% sonnet (executor), ~20% haiku (plan-checker), ~20% opus (orchestration, auditing)
- Sessions: ~8 (spread across 7 days due to interleaved quick tasks)
- Notable: 12 plans + 14 quick tasks; quick tasks accounted for ~50% of total effort but were necessary production fixes

---

## Milestone: v4.0 — Adaptive Learning Integration

**Shipped:** 2026-03-09
**Phases:** 7 | **Plans:** 15 | **Sessions:** ~6

### What Was Built
- Unified config — skill-creator.json merged into config.json under adaptive_learning key with auto-migration
- Single installer — one install.js run delivers 16 skills, 4 teams, 9 hooks, and CLAUDE.md with marker-based merge
- Native agent integration — skill-awareness and capability inheritance baked inline into executor/planner (no extension markers)
- Dashboard copy-and-verify — 15K LOC TypeScript dashboard builds from gsdup repo with esbuild bundling
- Native observation — all 7 workflow commands capture structured JSON observations to sessions.jsonl
- Command consolidation — 13 standalone commands ported to /gsd:* namespace, /wrap:* and /sc:* removed
- Gap closure phases (16.1, 16.2) — fixed 3 integration gaps, 12 tech debt items identified by milestone audit

### What Worked
- Coarse granularity (5 core phases compressing 10 requirement categories) kept planning efficient while covering 39 requirements
- Milestone audit caught real integration gaps (installer ↛ observation, config migration ↛ installer, analysis commands ↛ data production) — gap closure phases 16.1 and 16.2 addressed them
- Copy-and-verify for dashboard (not rewrite) saved significant effort — 15K LOC worked on first build
- GSD_HOOK_REGISTRY constant replacing individual hook checks simplified hook management
- Manifest-diff pattern for skill/team deletion tracking was clean and testable

### What Was Inefficient
- Analysis commands (gsd:suggest, gsd:digest) read data files that no component writes — these commands are permanently non-functional until producers are created (accepted as tech debt)
- Dashboard auto-trigger on phase transitions documented but not wired — feature described in command but unreachable
- REQUIREMENTS.md checkboxes not updated during execution — had to create Phase 16.2 just for documentation cleanup
- VALIDATION.md statuses not kept current during phases — batch cleanup needed at end

### Patterns Established
- GSD_HOOK_REGISTRY constant: single array of all hook definitions, replacing scattered individual checks
- Marker-based CLAUDE.md merge: `<!-- GSD:BEGIN/END -->` markers preserve user content while updating GSD sections
- Inline agent integration: bake external content directly into agent files, no extension/injection markers
- Observation step pattern: structured JSON append to sessions.jsonl at end of every workflow command
- Gap closure phases: decimal-numbered phases (16.1, 16.2) for post-audit fixes without renumbering

### Key Lessons
1. Audit before completion continues to prove its value — 6th consecutive milestone where audit caught real gaps
2. Documentation debt (checkboxes, validation statuses) should be updated during execution, not batched at end — Phase 16.2 was entirely avoidable
3. Copy-and-verify is the right approach for large working codebases — dashboard 15K LOC worked with minimal adaptation
4. Commands that read data files should validate their data sources exist — gsd:suggest and gsd:digest silently fail

### Cost Observations
- Model mix: ~65% sonnet (executor), ~25% haiku (plan-checker, researchers), ~10% opus (orchestration)
- Sessions: ~6
- Notable: 15 plans in 3 days; gap closure phases (16.1, 16.2) were fast (1 plan each) but high-value

---

## Milestone: v7.0 — Quality Enforcement Observability

**Shipped:** 2026-03-11
**Phases:** 5 | **Plans:** 7 | **Sessions:** ~4

### What Was Built
- Gate execution persistence — 5 sentinel steps recorded to gate-executions.jsonl with rotation at 5000 entries
- Correction quality context — quality_level field added to all correction entries in corrections.jsonl
- Context7 call logging — library lookups persisted to context7-calls.jsonl with token budgets and usage flags
- Quality gating research — evaluated 5 MCP servers/tools (ESLint MCP recommended, Semgrep deferred)
- Dashboard Gate Health page — dedicated page with outcome distribution, quality level usage, per-gate firing rates, Context7 metrics
- Overview integration — quality badges on project cards, gate summaries on milestone lines and tmux cards
- Gate-to-correction attribution — heuristic CATEGORY_GATE_MAP and CONFIDENCE_MAP mapping corrections to gates

### What Worked
- JSONL writer pattern (write-gate-execution.cjs, write-correction.cjs, write-context7-call.cjs) established in Phase 28 and reused cleanly across all observation files
- Research phase (29) ran in parallel with Phase 28 — no blocking dependency, added value without slowing execution
- Dashboard component pattern from v5.0 (aggregation function → API endpoint → page component) reused cleanly for Gate Health page
- Milestone audit caught SUMMARY.md frontmatter gaps and VALIDATION.md draft statuses — all resolved before completion
- Fast execution: 7 plans completed across 5 phases in 2 days with ~83 min total execution time

### What Was Inefficient
- SUMMARY.md files missing `requirements-completed` frontmatter (30-01, 31-01) — should have been included during plan execution, not caught at audit
- Phase 31 progress table shows "0/?" for plans — incomplete plan count despite being marked complete
- Nyquist compliance partial (Phase 28 missing VALIDATION.md entirely) — validation should be generated during execution, not retroactively

### Patterns Established
- Observation JSONL trio: gate-executions.jsonl, corrections.jsonl (extended), context7-calls.jsonl — all in .planning/observations/
- CATEGORY_GATE_MAP/CONFIDENCE_MAP constants for heuristic attribution — plain objects, not config-driven
- aggregateGateHealth() pattern: read JSONL, compute distribution stats, return structured object for API
- Quality-level-aware filtering: fast mode produces no observation entries (gate skipping is the correct behavior)

### Key Lessons
1. JSONL writer pattern is highly reusable — three files sharing same structure (validate, rotate, write) with only schema differences
2. Research phases that run in parallel with implementation phases add value without blocking — Phase 29 informed future work while Phase 28 executed
3. Dashboard patterns from previous milestones (v5.0) compound — Gate Health page took 15 min because the pattern was established
4. SUMMARY.md frontmatter should include requirements-completed during execution, not discovered missing at audit

### Cost Observations
- Model mix: ~70% sonnet (executor), ~20% haiku (plan-checker, researchers), ~10% opus (orchestration)
- Sessions: ~4
- Notable: 7 plans in 2 days (~83 min total execution); fastest milestone by per-plan average (12 min/plan)

---

## Milestone: v6.0 — Adaptive Observation & Learning Loop

**Shipped:** 2026-03-11
**Phases:** 6 | **Plans:** 17 | **Sessions:** ~6

### What Was Built
- Hook-based correction capture — PostToolUse hook detects edits, reverts, self-reports; writes structured JSONL with 14-category two-tier taxonomy and auto-rotation at 1000 entries
- Preference tracking — repeated corrections (3+) auto-promote to durable preferences.jsonl with confidence scoring and scope tagging (file/filetype/phase/project/global)
- Live recall injection — session-start hook surfaces ≤10 relevant corrections/preferences (≤3K tokens); within-session cross-referencing via session-awareness skill
- Observer agent — pattern aggregation engine replacing stub; generates suggestion candidates when correction patterns cross threshold
- Suggestion pipeline — `/gsd:suggest` interactive command with accept/dismiss/defer workflow and 7-day cooldown
- Enhanced digest — `/gsd:digest` groups corrections by category with trends; collaborative skill refinement when 3+ corrections contradict a skill
- Skill refinement retirement — source corrections/preferences retired from active recall after baking into skills
- Cross-project inheritance — preferences appearing in 3+ projects promoted to `~/.gsd/preferences.json`
- Learned skill loading — all 7 GSD workflow commands and all subagents inherit learned preferences in execution context

### What Worked
- TDD scaffolding (Phase 22-01, 23-01, 24-01) — writing test stubs first with `it.todo` caught real integration issues early; tests passed green before implementation existed
- Silent failure pattern — wrapping all hook code in try/catch with exit 0 prevented correction pipeline from ever breaking user workflow
- Layered dependency chain (22→23→24→25→26→27) — each phase produced a coherent, testable capability that the next built on cleanly
- JSONL-based storage aligned with GSD file-based philosophy — human-readable, git-friendly, simple rotation
- Milestone audit caught real issues (recall-injection dedup separator, suggest.md shell injection risk, missing REQUIREMENTS.md content) and triggered remediation before completion
- 6 bounded learning guardrails enforced safety constraints without excessive complexity

### What Was Inefficient
- Phase 25 Plan count in ROADMAP.md shows "1/2" despite both plans being complete — progress table wasn't updated after second plan
- Phase 26 and 27 ROADMAP.md details section still says "Plans: TBD" despite plans being fully executed — late phases got less documentation attention
- CATEGORY_SKILL_MAP duplicated in digest.md prose and analyze-patterns.cjs code — drift risk between the two sources
- retireByCategory early-returns on missing patternsDir, silently skipping preferences.jsonl and suggestions.json retirement
- Some SUMMARY.md files used inconsistent frontmatter schemas (Phase 22-01 used `key-files` YAML, 22-02 used simple prose) — no enforced schema

### Patterns Established
- Correction entry schema: 8 fields (correction_from, correction_to, diagnosis_category, diagnosis_text, scope, phase, source, timestamp)
- Preference entry schema: confidence scoring (0.0-1.0), scope tagging, retired_at for baked preferences
- Recall token budget pattern: ≤10 entries, ≤3K tokens, with dedup by category+scope key
- Observer bounded learning: 6 guardrails (3 corrections min, 7-day cooldown, user confirmation, 20% max change, guardrail logging, 5+ co-activations)
- Learned context injection: `inject_learned_context` block pattern for workflow commands and subagent prompts
- Cross-project promotion: project-count threshold (3+) before elevating to user-level store

### Key Lessons
1. Silent failure in hooks is non-negotiable — any hook that can crash the user's workflow is worse than no hook at all
2. JSONL rotation with dated archives is the right persistence pattern for append-heavy event streams — simple, debuggable, and naturally bounded
3. Bounded learning guardrails should be designed upfront, not retrofitted — the 6-guardrail framework kept the entire pipeline safe from runaway auto-modification
4. Cross-project inheritance needs a high threshold (3+ projects) — project-specific quirks shouldn't pollute the global store
5. Recall exclusion for baked preferences prevents double-surfacing — skills are the durable layer, recall is the staging area
6. Test scaffolding phases (stubs with it.todo) are worth the investment — they catch import/require issues and provide green baselines before implementation

### Cost Observations
- Model mix: ~65% sonnet (executor), ~25% haiku (plan-checker, researchers), ~10% opus (orchestration)
- Sessions: ~6
- Notable: 17 plans in 2 days; correction capture pipeline (Phases 22-24) was fastest at ~15 min/plan average

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 MVP | ~3 | 4 | Established quality sentinel, TDD pattern |
| v1.1 Quality UX | ~2 | 3 | Added user-facing config/observability layer |
| v2.0 Concurrent Milestones | ~5 | 7 | Workspace isolation, milestone-scoped routing, audit-before-complete cycle |
| v3.0 Tech Debt System | ~3 | 6 | Structured debt tracking, agent auto-logging, migration tool, fix-debt skill |
| v3.1 Legacy Strip & README | ~8 | 7 | Eliminated dual-layout support, milestone-scoped only, test infra rewrite |
| v4.0 Adaptive Learning | ~6 | 7 | Merged skill-creator into core, native observation, command consolidation |
| v6.0 Adaptive Observation | ~6 | 6 | Correction capture, preference learning, recall injection, observer agent, skill refinement |
| v7.0 Quality Observability | ~4 | 5 | Gate persistence, dashboard Gate Health page, attribution analytics |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 102 | N/A | 8 (agents, config, tests) |
| v1.1 | 129+ | N/A | 13 (commands, workflows, templates) |
| v2.0 | 232 | 90%+ branch on new functions | 87 new tests (core, compat, milestone, dashboard, routing, e2e) |
| v3.0 | 266 | 90%+ on debt/migrate modules | 34 new tests (debt, migrate, milestone-scoped) |
| v3.1 | 716 | N/A (strip milestone) | Rewrote 16 test files for milestone-scoped; net -14K lines |
| v4.0 | 716+ | N/A | 15 plans; +42K lines (skills, teams, dashboard, observation, commands) |
| v6.0 | 960+ | N/A | 17 plans; +17.8K lines (correction capture, preferences, recall, observer, digest, skill loading) |
| v7.0 | 960+ | N/A | 7 plans; +10.5K lines (JSONL writers, Gate Health page, attribution) |

### Top Lessons (Verified Across Milestones)

1. TDD catches real integration bugs that reading code alone would miss — verified in v1.0 (test baseline), v1.1 (spawnSync, loadConfig), v2.0 (cmdInitExecutePhase state_path bug), and v3.0 (migrate existence guards)
2. Config-driven behavior gating (fast/standard/strict) keeps changes additive — verified across all milestones with zero behavioral change in fast mode; extended in v3.0 to debt logging gating
3. When updating one function in a family of similar functions, update ALL of them — verified in v2.0 (cmdInitPlanPhase missed) and v3.0 (cmdMilestoneComplete CLI wrapper bypassed CJS fix)
4. Milestone audits before completion catch integration gaps that phase-level verification misses — verified in v2.0 (4 fixes) and v3.0 (phasesDir regression, execute-plan scope threading)
5. Inserted phases are worth the coordination cost when they fix structural issues — verified in v3.0 (Phase 3.2.1 normalized planning directory before building migration tool)
6. When stripping a feature, migrate test infrastructure BEFORE removing runtime fallbacks — verified in v3.1 (P8 had to restore findPhaseInternal fallback, P11 created to close the gap)
7. Feasibility analysis before multi-phase refactors saves significant effort — verified in v3.1 (quick-13 justified surgical strip over full rebuild)
8. Documentation debt should be addressed during execution, not batched — verified in v4.0 (Phase 16.2 created solely for checkbox/validation cleanup that should have been done inline)
9. Copy-and-verify beats rewrite for large working codebases — verified in v4.0 (15K LOC dashboard worked with minimal adaptation)
10. Established patterns compound across milestones — verified in v7.0 (Gate Health page took 15 min by reusing v5.0 dashboard component pattern)
11. Parallel research phases add value without blocking execution — verified in v7.0 (Phase 29 research ran alongside Phase 28 implementation)
12. Silent failure in hooks is non-negotiable for user-facing pipelines — verified in v6.0 (correction capture wraps all code in try/catch, never crashes user workflow)
13. Test scaffolding phases (stubs with it.todo) catch import issues early and provide green baselines — verified in v6.0 (Phases 22-01, 23-01, 24-01)
14. Bounded learning guardrails should be designed upfront, not retrofitted — verified in v6.0 (6-guardrail framework kept entire pipeline safe)
