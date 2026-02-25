# Milestones

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


## v3.0 Tech Debt System (In Progress)

**Goal:** Build infrastructure for systematic tech debt tracking and resolution, plus a project migration tool for existing `.planning/` folders.

**Phases:** 5 planned (15-19) + 1 inserted (16.1)
**Status:** In progress — Phases 15-16 complete, Phase 16.1 in progress

---

