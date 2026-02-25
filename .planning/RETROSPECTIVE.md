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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 MVP | ~3 | 4 | Established quality sentinel, TDD pattern |
| v1.1 Quality UX | ~2 | 3 | Added user-facing config/observability layer |
| v2.0 Concurrent Milestones | ~5 | 7 | Workspace isolation, milestone-scoped routing, audit-before-complete cycle |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 102 | N/A | 8 (agents, config, tests) |
| v1.1 | 129+ | N/A | 13 (commands, workflows, templates) |
| v2.0 | 232 | 90%+ branch on new functions | 87 new tests (core, compat, milestone, dashboard, routing, e2e) |

### Top Lessons (Verified Across Milestones)

1. TDD catches real integration bugs that reading code alone would miss — verified in v1.0 (test baseline), v1.1 (spawnSync, loadConfig), and v2.0 (cmdInitExecutePhase state_path bug)
2. Config-driven behavior gating (fast/standard/strict) keeps changes additive — verified across all milestones with zero behavioral change in fast mode
3. When updating one function in a family of similar functions, update ALL of them — verified in v2.0 (cmdInitPlanPhase missed while cmdInitExecutePhase was fixed)
4. Milestone audits before completion catch integration gaps that phase-level verification misses — verified in v2.0 (2 audit rounds, 4 integration fixes total)
