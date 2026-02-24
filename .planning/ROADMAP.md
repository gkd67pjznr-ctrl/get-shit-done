# Roadmap: GSD Enhanced Fork

## Overview

This milestone upgrades the GSD framework with engineer-level quality enforcement. Phase 1 fixes the known routing bug and lays config infrastructure so all subsequent quality gates can be conditionally enabled. Phase 2 transforms the executor into a quality sentinel — pre-task codebase scan, Context7 library lookup, mandatory tests, and post-task diff review. Phase 3 extends the verifier, planner, and plan-checker with quality dimensions, completing the full enforcement loop from plan creation through post-execution backstop.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Fix routing bugs and establish config infrastructure that all quality gates depend on (completed 2026-02-23)
- [x] **Phase 2: Executor Sentinel** - Add inline quality enforcement to the executor at the point where code is written (completed 2026-02-23)
- [x] **Phase 3: Quality Dimensions** - Extend verifier, planner, and plan-checker with quality checks that complete the enforcement loop (completed 2026-02-23)
- [ ] **Phase 4: Wire Quality Scan Handoff** - Connect planner's quality_scan directives to executor's quality_sentinel so the Plan→Execute→Verify loop completes end-to-end (gap closure)

## Phase Details

### Phase 1: Foundation
**Goal**: Users can run multi-phase milestones without premature routing, and every quality gate has a config key to read
**Depends on**: Nothing (first phase)
**Requirements**: BUG-01, BUG-02, BUG-03, CFG-01, CFG-02, CFG-03, CFG-04
**Success Criteria** (what must be TRUE):
  1. Running `/gsd:phase-complete` on a non-final phase routes to the next phase, not to milestone completion
  2. `config.json` includes `quality.level` (strict/standard/fast) and `quality.test_exemptions` keys with documented defaults
  3. Setting `quality.level: fast` produces zero behavioral change from vanilla GSD — no quality gates fire
  4. Both bug fixes are applied atomically with before/after test fixtures validating the correct JSON output
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Fix execute-plan.md offer_next routing bug and add filesystem-vs-ROADMAP test fixtures (completed 2026-02-23)
- [ ] 01-02-PLAN.md — Add quality config key to template and hardcoded defaults with tests

### Phase 2: Executor Sentinel
**Goal**: Users can run the executor and have it automatically scan the codebase, consult library docs, write tests, and review its own diff — enforced by protocol, gated by config level
**Depends on**: Phase 1
**Requirements**: EXEC-01, EXEC-02, EXEC-03, EXEC-04, EXEC-05, EXEC-06, EXEC-07, EXEC-08
**Success Criteria** (what must be TRUE):
  1. The executor reads existing codebase patterns (targeted grep) before starting each task and does not re-implement utilities that already exist
  2. The executor calls Context7 `resolve-library-id` and `query-docs` before implementing any external library, and `.mcp.json` is present in the project
  3. Any task that creates new `.cjs/.js/.ts` files with exported functions produces a corresponding test file before the commit
  4. The executor reads its own diff before each commit and self-reports any duplication or naming inconsistency found
  5. All executor quality gates are skipped entirely when `quality.level` is `fast`; reduced gates for `standard`; full gates for `strict`
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — Add Context7 MCP to tools frontmatter, write `<context7_protocol>` section, and create `.mcp.json` (completed 2026-02-23)
- [x] 02-02-PLAN.md — Add `<quality_sentinel>` section to `gsd-executor.md` covering pre-task scan, mandatory test step, and post-task diff review (completed 2026-02-23)
- [x] 02-03-PLAN.md — Wire quality level config reads into every sentinel gate so fast/standard/strict gating works end to end (completed 2026-02-23)

### Phase 3: Quality Dimensions
**Goal**: Users can rely on the verifier as a post-execution backstop for duplication and dead code, and planners produce task actions that pre-load executors with quality scan results
**Depends on**: Phase 2
**Requirements**: VRFY-01, VRFY-02, VRFY-03, VRFY-04, PLAN-01, PLAN-02, PCHK-01, PCHK-02
**Success Criteria** (what must be TRUE):
  1. After phase execution, VERIFICATION.md includes Step 7b findings covering duplication, orphaned exports, and missing test files — with severity gated by config level
  2. Planner-generated task `<action>` blocks include a `<quality_scan>` subsection naming existing code to reuse, library docs to consult, and tests to write
  3. The planner self-check rejects any task action that has an empty `<quality_scan>` before returning the plan
  4. Plan-checker Dimension 9 validates quality directive completeness — as a warning in `standard` mode and a blocker in `strict` mode
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md — Add Step 7b quality dimensions to `gsd-verifier.md` (duplication, dead code/orphaned exports, missing tests, severity gated by config level)
- [ ] 03-02-PLAN.md — Add `<quality_scan>` format to planner task actions and self-check validation; add Dimension 9 to plan-checker

### Phase 4: Wire Quality Scan Handoff
**Goal**: The executor consumes planner-generated `<quality_scan>` directives (code_to_reuse, docs_to_consult, tests_to_write) so the Plan→Execute→Verify loop works end-to-end
**Depends on**: Phase 3
**Requirements**: EXEC-01, PLAN-01, CFG-04
**Gap Closure:** Closes gaps from v1.0 milestone audit
**Success Criteria** (what must be TRUE):
  1. Executor `<quality_sentinel>` Step 1 reads `<code_to_reuse>` from the current task's `<action>` block and uses its patterns as grep input for the pre-task codebase scan
  2. Executor `<quality_sentinel>` Step 2 reads `<docs_to_consult>` from the current task's `<action>` block before deciding on Context7 calls
  3. Executor consumes `<tests_to_write>` from `<quality_scan>` to guide mandatory test step
  4. Plan-checker Dimension 9 reads `quality.level` using canonical bash pattern with `|| echo "fast"` fallback guard (CFG-04 consistency)
  5. The Plan→Execute→Verify E2E flow completes without broken handoffs

**Plans**: 1 plan

Plans:
- [ ] 04-01-PLAN.md — Wire executor sentinel Steps 1, 2, and 4 to consume quality_scan directives; fix plan-checker Dimension 9 canonical bash pattern

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete    | 2026-02-23 |
| 2. Executor Sentinel | 3/3 | Complete    | 2026-02-23 |
| 3. Quality Dimensions | 2/2 | Complete    | 2026-02-23 |
| 4. Wire Quality Scan Handoff | 0/1 | Not Started | — |
