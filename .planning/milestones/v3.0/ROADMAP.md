# Roadmap: v3.0 Tech Debt System

**Milestone Goal:** Build infrastructure for systematic tech debt tracking and resolution, plus a project migration tool for existing `.planning/` folders.

## Phases

- [x] **Phase 3.1: Integration Fixes** - Fix milestone-scoped path resolution bugs in `cmdInitPlanPhase` and roadmap commands (completed 2026-02-25)
- [x] **Phase 3.2: Core Debt Module** - DEBT.md schema, `debt.cjs` CLI commands, concurrent-safe writes (completed 2026-02-25)
- [x] **Phase 3.2.1: Planning Directory Cleanup and GSD Flow Fixes** - Normalize orphaned/misplaced planning files, fix plan-level checkbox updates and milestone workspace finalization (completed 2026-02-25)
- [x] **Phase 3.3: Migration Tool** - `migrate.cjs` with dry-run default, additive-only apply, and undo manifest (completed 2026-02-26)
- [ ] **Phase 3.4: Agent Wiring** - Executor, verifier, and debugger auto-log discovered debt with quality-level gating
- [ ] **Phase 3.5: /gsd:fix-debt Skill** - On-demand orchestrator skill routing debt entries through diagnosis and fix execution

### Phase 3.1: Integration Fixes

**Goal:** Fix milestone-scoped path resolution bugs so that `cmdInitPlanPhase` and roadmap commands work correctly with milestone-scoped layouts.

**Requirements:** INTG-01, INTG-02

**Scope:**
- `cmdInitPlanPhase` returns milestone-aware paths via `planningRoot()` instead of hardcoded `.planning/`
- `cmdRoadmapGetPhase` and `cmdRoadmapAnalyze` respect `--milestone` flag for milestone-scoped ROADMAP.md

**Plans:** 1/1 plans complete

Plans:
- [x] 3.1-01-PLAN.md — Fix milestone-scoped path resolution in init and roadmap commands with regression tests

### Phase 3.2: Core Debt Module

**Goal:** Create the DEBT.md schema and `debt.cjs` CLI commands for structured tech debt tracking with concurrent-safe writes.

**Requirements:** DEBT-01, DEBT-02, DEBT-03, DEBT-04

**Scope:**
- DEBT.md hub with structured entry format (TD-NNN IDs, 10 fields)
- `gsd-tools debt log` command for atomic append
- `gsd-tools debt list` command with filtering (JSON output)
- `gsd-tools debt resolve` command for status transitions

**Plans:** 1/1 plans complete

Plans:
- [x] 3.2-01-PLAN.md — Create debt.cjs module (all three commands) + test suite + router wiring (TDD)

### Phase 3.2.1: Planning Directory Cleanup and GSD Flow Fixes (INSERTED)

**Goal:** Normalize orphaned/misplaced planning files in `.planning/milestones/`, update stale tracking artifacts, and fix two systemic GSD flow flaws: plan-level checkbox updates in `cmdRoadmapUpdatePlanProgress` and milestone workspace finalization in `cmdMilestoneComplete`.
**Requirements:** CLEAN-01, CLEAN-02, FLOW-01, FLOW-02
**Depends on:** Phase 3.2
**Plans:** 2/2 plans complete

Plans:
- [x] 3.2.1-01-PLAN.md — Normalize milestones directory structure and update stale tracking files
- [x] 3.2.1-02-PLAN.md — TDD: Plan-level checkbox flip and milestone workspace finalization code fixes

### Phase 3.3: Migration Tool

**Goal:** Build `migrate.cjs` that inspects and upgrades existing `.planning/` folders with dry-run default, additive-only apply, and undo manifest.

**Requirements:** MIGR-01, MIGR-02, MIGR-03

**Scope:**
- `gsd-tools migrate --dry-run` inspects layout and reports changes
- `gsd-tools migrate --apply` performs additive-only structural changes with undo manifest
- Idempotent — running `--apply` multiple times produces same result

**Plans:** 1/1 plans complete

Plans:
- [x] 3.3-01-PLAN.md — TDD: migrate.cjs module (inspectLayout + dry-run + apply) with test suite and router wiring

### Phase 3.4: Agent Wiring

**Goal:** Wire executor, verifier, and debugger agents to auto-log discovered debt with quality-level gating.

**Requirements:** WIRE-01, WIRE-02, WIRE-03, WIRE-04

**Scope:**
- Executor auto-logs debt when Quality Sentinel finds unfixable issues
- Verifier auto-logs unresolved quality dimension findings
- Debt logging gated on quality level (fast=off, standard=critical/high, strict=all)
- Entries include source phase and plan provenance

### Phase 3.5: /gsd:fix-debt Skill

**Goal:** Create on-demand orchestrator skill that routes debt entries through diagnosis and fix execution.

**Requirements:** FIXD-01, FIXD-02

**Scope:**
- Skill reads DEBT.md, selects entry by ID or priority, routes through debugger
- Applies fix via plan execution, verifies result, marks entry resolved

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 3.1. Integration Fixes | 1/1 | Complete | 2026-02-25 |
| 3.2. Core Debt Module | 1/1 | Complete | 2026-02-25 |
| 3.2.1. Planning Directory Cleanup | 2/2 | Complete | 2026-02-25 |
| 3.3. Migration Tool | 1/1 | Complete    | 2026-02-26 |
| 3.4. Agent Wiring | 0/? | Not started | - |
| 3.5. /gsd:fix-debt Skill | 0/? | Not started | - |

---
