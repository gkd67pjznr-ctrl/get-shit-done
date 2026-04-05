# Architecture Research

**Domain:** Planning intelligence integration — CJS module system, JSONL persistence, workflow agent injection
**Researched:** 2026-04-04
**Confidence:** HIGH — based on direct codebase inspection of 25 lib modules, all workflow files, and 15 completed milestone artifacts

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        WORKFLOW LAYER (Markdown agents)                       │
│  plan-phase.md          new-milestone.md          complete-milestone.md       │
│  (Step 8: spawn planner) (Step: spawn roadmapper)  (cmdMilestoneComplete)     │
└──────────┬──────────────────────┬──────────────────────────┬──────────────────┘
           │                      │                          │
           │ plan_suggestions      │ decomposition_proposal   │ refreshIndex()
           │ injected via init     │ injected via init        │ trigger
           ▼                      ▼                          ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                  PLANNING INTELLIGENCE LAYER (new for v14.0)                  │
│                                                                                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────────┐  │
│  │  plan-indexer    │  │  task-classifier │  │  milestone-decomposer      │  │
│  │  (new module)    │  │  (new module)    │  │  (new module)              │  │
│  │                  │  │                  │  │                            │  │
│  │ buildIndex()     │  │ classifyTask()   │  │ proposeDecomposition()     │  │
│  │ searchIndex()    │  │ rankByType()     │  │ matchHistoricalPattern()   │  │
│  │ refreshIndex()   │  │ composeTasks()   │  │                            │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────────┬─────────────┘  │
│           │                     │                            │                │
│           └──────── plan-index.json (shared data store) ─────┘                │
│                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │  prompt-scorer (new module)                                             │  │
│  │  scoreRecentPlans() → reads phase-benchmarks.jsonl + PLAN.md task text │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        EXISTING PERSISTENCE LAYER                             │
│  .planning/patterns/phase-benchmarks.jsonl    (correction_count, gate_fires)  │
│  .planning/patterns/corrections.jsonl         (per-correction raw events)     │
│  .planning/observations/workflow.jsonl        (v13.0 event journal)           │
│  .planning/milestones/vX.Y/phases/*/          (PLAN.md, SUMMARY.md files)    │
│  .planning/plan-index.json                    (NEW — built by plan-indexer)   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Module |
|-----------|---------------|--------|
| `plan-indexer.cjs` | Scan all milestone phase dirs, extract structural features from PLAN.md frontmatter + task tags, write `plan-index.json`. Expose `buildIndex()`, `refreshIndex()`, `searchIndex()`. | NEW |
| `task-classifier.cjs` | Parse `<task>` XML from PLAN.md files, classify by action keywords and file patterns into 8 canonical task types, join correction data from phase-benchmarks.jsonl, compose ranked task sequences. | NEW |
| `milestone-decomposer.cjs` | Parse historical ROADMAP.md files across all milestones, extract phase count + phase goals + dependency chains. Given a goal string, match via keyword overlap and propose a draft phase breakdown. | NEW |
| `prompt-scorer.cjs` | Count corrections per task via corrections.jsonl + phase-benchmarks.jsonl, compute quality score, identify outlier plans. Feed per-task attribution into digest. | NEW |
| `gsd-tools.cjs` (router) | Wire new CLI subcommands: `plan-index build`, `plan-index search`, `task-compose`, `milestone-decompose`, `prompt-score`. | MODIFIED |
| `init.cjs` (`cmdInitPlanPhase`) | Inject `plan_suggestions` JSON field into init output consumed by plan-phase.md Step 1. plan-indexer queried here with graceful degradation. | MODIFIED |
| `init.cjs` (`cmdInitNewMilestone`) | Inject `decomposition_proposal` JSON field into new-milestone init output. milestone-decomposer queried here. | MODIFIED |
| `milestone.cjs` (`cmdMilestoneComplete`) | Call `plan-indexer.refreshIndex(cwd)` at end of completion flow to keep index current. Silent on failure. | MODIFIED |

---

## Plan Index: File Location and Schema

**File:** `.planning/plan-index.json`

Rationale: project-level (not milestone-scoped) because the index spans all historical milestones. Lives in `.planning/` alongside `config.json` and `MILESTONES.md` — the same access pattern used by other cross-milestone stores. NOT in `.planning/patterns/` (that directory holds session-level JSONL streams, not derived static indexes).

```json
{
  "built_at": "2026-04-04T12:00:00Z",
  "plan_count": 82,
  "plans": [
    {
      "plan_id": "35-01",
      "milestone": "v8.0",
      "phase_goal": "Decide gate enforcement approach and implement the mechanism",
      "phase_slug": "gate-enforcement",
      "task_pattern": ["tdd", "lib-module", "hook-integration", "config-update"],
      "file_patterns": [".cjs", ".json"],
      "file_paths": [".claude/hooks/lib/gate-runner.cjs", ".claude/hooks/gsd-run-gates.cjs"],
      "requirement_count": 2,
      "correction_count": 0,
      "correction_rate": 0.0,
      "tags": ["hook", "quality-gates", "deterministic"],
      "completed": "2026-04-02"
    }
  ]
}
```

**Build time:** `plan-indexer.cjs` scans `.planning/milestones/*/phases/**/*-PLAN.md` and matching `*-SUMMARY.md` files. Joins `correction_count` from `phase-benchmarks.jsonl` by `plan_id` key.

**Refresh trigger:** `cmdMilestoneComplete` calls `refreshIndex()` after archiving. Also exposed as `plan-index build` CLI subcommand for manual rebuild.

**Query time:** Sub-second — JSON parse + linear scan of ~100 entries is negligible.

**Staleness policy:** Index may lag by up to one milestone. The milestone-completion trigger is sufficient because completed plans are stable history. In-progress plans are never indexed.

---

## New Module Locations

All new modules follow the established pattern: `get-shit-done/bin/lib/<name>.cjs`.

```
get-shit-done/bin/lib/
├── plan-indexer.cjs          NEW — index builder, searcher, refresher (~250 lines)
├── task-classifier.cjs       NEW — task type classifier + composition engine (~180 lines)
├── milestone-decomposer.cjs  NEW — milestone structure analyzer + proposal generator (~220 lines)
├── prompt-scorer.cjs         NEW — per-plan prompt quality scoring (~160 lines)
├── benchmark.cjs             EXISTING — unchanged; plan-indexer reads its JSONL output
├── core.cjs                  EXISTING — planningRoot(), parseJsonlFile() reused by new modules
└── ... (21 other existing modules untouched)
```

---

## Data Flow

### Flow 1: Historical Plans → Index (build-time)

```
cmdMilestoneComplete() in milestone.cjs
    └── (after all archiving is complete)
    ↓
plan-indexer.refreshIndex(cwd)
    ↓ scans
.planning/milestones/vX.Y/phases/**/*-PLAN.md    (frontmatter: phase, files_modified, tags)
.planning/milestones/vX.Y/phases/**/*-SUMMARY.md (frontmatter: status, completed)
.planning/patterns/phase-benchmarks.jsonl         (correction_count per plan_id)
    ↓ joins and atomically writes
.planning/plan-index.json
```

### Flow 2: Index → Suggestion → Planner (plan-phase workflow)

```
/gsd:plan-phase <phase>
    ↓
plan-phase.md Step 1 calls:
  node gsd-tools.cjs init plan-phase <phase>
    ↓ in cmdInitPlanPhase() (init.cjs):
    plan-indexer.searchIndex(cwd, { goal: phase_name, limit: 3 })
    ↓ returns top matches with similarity scores
    adds to init JSON:
      "plan_suggestions": [
        { "plan_id": "35-01", "similarity": 0.82, "task_pattern": [...], "correction_rate": 0.0 },
        { "plan_id": "41-01", "similarity": 0.71, "task_pattern": [...], "correction_rate": 0.0 }
      ]
    ↓
plan-phase.md Step 8 parses plan_suggestions from init JSON
  and injects into the gsd-planner prompt:

  <planning_intelligence>
  Similar historical plans:
  - 35-01 (gate-enforcement, 82% match, 0 corrections)
    task pattern: tdd → lib-module → hook-integration → config-update
  - 41-01 (skill-metrics, 71% match, 0 corrections)
    task pattern: tdd → lib-module → cli-wiring → integration-update
  Suggested task sequence (adapt as needed): ...
  </planning_intelligence>
```

### Flow 3: Historical Milestones → Decomposition → Roadmapper (new-milestone workflow)

```
/gsd:new-milestone
    ↓
new-milestone.md Step 7: Load Context and Resolve Models calls:
  node gsd-tools.cjs init new-milestone
    ↓ in cmdInitNewMilestone() (init.cjs):
    milestone-decomposer.proposeDecomposition(cwd, milestone_goal)
    ↓ reads
    .planning/milestones/vX.Y/ROADMAP.md  (for each completed milestone)
    ↓ returns
    {
      "proposal": "Phase 1: Infrastructure (2 plans)...",
      "similar_milestones": ["v7.0", "v9.0"],
      "pattern": "analytics-pipeline"
    }
    adds "decomposition_proposal" to init JSON
    ↓
new-milestone.md roadmapper spawn injects:

  <decomposition_proposal>
  Based on similar milestones (v7.0 Signal Intelligence, v9.0 Signal Intelligence):
  Phase 1: Infrastructure — index builder, data scanner (2 plans)
  Phase 2: Core algorithms — classifier, scorer, similarity engine (2-3 plans)
  Phase 3: Workflow integration — inject into plan-phase + new-milestone (2 plans)
  Phase 4: Analytics surface — digest integration, prompt scoring (1-2 plans)
  Adapt as needed. This is a starting point, not a prescription.
  </decomposition_proposal>
```

### Flow 4: Execution Data → Prompt Quality Score → Digest

```
/gsd:execute-phase completes a plan
    ↓ (plan-complete checkpoint in execute-phase.md)
benchmark.cmdBenchmarkPlan() appends entry to phase-benchmarks.jsonl
    ↓
/gsd:digest workflow runs
    ↓ calls
  node gsd-tools.cjs prompt-score --milestone <version>
    ↓ in prompt-scorer.cjs:
    reads .planning/patterns/phase-benchmarks.jsonl
    reads .planning/milestones/vX.Y/phases/**/*-PLAN.md (task action text)
    ↓ returns
    {
      "score": 0.87,
      "plan_count": 8,
      "clean_plans": 6,
      "outliers": [
        { "plan": "42-01", "task": "T3", "corrections": 4 }
      ]
    }
    ↓
digest adds new section:
  ## Prompt Quality
  Score: 87% (6/8 plans had 0-1 corrections)
  Outlier: Plan 42-01 Task 3 (4 corrections) — consider rephrasing action text
```

---

## Integration Points: New vs. Modified

### New Modules (no existing module is touched)

| Module | Exports | Key Dependencies |
|--------|---------|-----------------|
| `plan-indexer.cjs` | `buildIndex`, `refreshIndex`, `searchIndex`, `cmdPlanIndex` | `core.cjs` (planningRoot, parseJsonlFile), `frontmatter.cjs` (extractFrontmatter) |
| `task-classifier.cjs` | `classifyTask`, `composeTasks`, `rankByType`, `cmdTaskCompose` | `core.cjs`, `plan-indexer.cjs` (reads index JSON) |
| `milestone-decomposer.cjs` | `proposeDecomposition`, `matchPattern`, `cmdMilestoneDecompose` | `core.cjs`, reads ROADMAP.md files directly |
| `prompt-scorer.cjs` | `scoreRecentPlans`, `scoreAllPlans`, `cmdPromptScore` | `core.cjs`, reads phase-benchmarks.jsonl + PLAN.md files |

### Modified Modules (additive-only)

| Module | Change | Estimated lines added |
|--------|--------|-----------------------|
| `init.cjs` (`cmdInitPlanPhase`) | Add `plan_suggestions` field to init JSON. Try/catch wrap — returns `[]` on any failure. | ~12 |
| `init.cjs` (`cmdInitNewMilestone`) | Add `decomposition_proposal` field to init JSON. Try/catch wrap — returns `null` on failure. | ~12 |
| `milestone.cjs` (`cmdMilestoneComplete`) | Call `refreshIndex(cwd)` at end of completion, silent on failure. | ~6 |
| `gsd-tools.cjs` (router) | Add `require()` for 4 new modules + case branches for `plan-index`, `task-compose`, `milestone-decompose`, `prompt-score`. | ~60 |

### Modified Workflows (Markdown — the consumer side)

| Workflow | Change | Location in file |
|----------|--------|-----------------|
| `plan-phase.md` | Step 1: parse `plan_suggestions` from init JSON. Step 8: inject as `<planning_intelligence>` block in planner prompt. | Steps 1 + 8 |
| `new-milestone.md` | Parse `decomposition_proposal` from init JSON. Inject in roadmapper spawn prompt. | Step 7 + roadmapper spawn |
| Digest workflow | Add `prompt-score` CLI call + new "Prompt Quality" section. | New digest section |

---

## Recommended Project Structure Changes

```
get-shit-done/bin/lib/
├── plan-indexer.cjs         NEW
├── task-classifier.cjs      NEW
├── milestone-decomposer.cjs NEW
├── prompt-scorer.cjs        NEW
└── ... (25 existing modules untouched)

.planning/
├── plan-index.json          NEW — derived artifact, rebuilt at milestone completion
└── ... (all existing files untouched)

tests/
├── plan-indexer.test.cjs    NEW
├── task-classifier.test.cjs NEW
├── milestone-decomposer.test.cjs NEW
└── prompt-scorer.test.cjs   NEW
```

---

## Architectural Patterns

### Pattern 1: Init Injection

**What:** New intelligence features inject outputs into the compound `init` commands in `init.cjs`. The workflow parses the init JSON and injects results into subagent prompts.

**When to use:** Suggestions the planner needs as pre-planning context. The init command is the single integration point where all context is assembled before an agent spawns.

**Why this pattern:** plan-phase.md already reads 7+ context fields from init JSON. Adding `plan_suggestions` as one more JSON key costs zero workflow restructuring — only Step 1 (parse) and Step 8 (use) need updating. No new workflow steps. No new CLI calls.

**Concrete wiring in init.cjs:**
```javascript
// In cmdInitPlanPhase(), after existing context assembly:
try {
  const { searchIndex } = require('./plan-indexer.cjs');
  result.plan_suggestions = searchIndex(cwd, { goal: phaseGoal, limit: 3 });
} catch {
  result.plan_suggestions = [];  // graceful degradation — index not yet built
}
```

### Pattern 2: Pre-Built Index with Milestone-Completion Refresh

**What:** `cmdMilestoneComplete` in `milestone.cjs` calls `plan-indexer.refreshIndex()` as its final step, after all archiving is done.

**When to use:** Any time historical data needs to be refreshed at a natural checkpoint. Milestone completion marks when new completed plans become stable history.

**Why this pattern:** Query-time scan of 80+ PLAN.md files on every `init plan-phase` call would add ~200ms latency to every planning session. Pre-built index is a JSON parse — negligible. The v14.0 Milestone Context (Key Decision 1) explicitly recommends this approach.

**Graceful degradation:** If `plan-index.json` doesn't exist (first run), `searchIndex()` returns `[]`. The planner proceeds normally without suggestions.

### Pattern 3: Jaccard Token Overlap for Similarity

**What:** Reuse the `jaccardScore()` / `tokenize()` pattern from `skill-scorer.cjs` for plan similarity scoring.

**When to use:** Keyword-based similarity is sufficient for matching phase goals to historical plans. The skill-scorer proved this works in production (v9.0).

**Implementation note:** plan-indexer does NOT import skill-scorer.cjs — it duplicates the ~20-line tokenize + Jaccard implementation locally to keep modules independent. This is the established codebase pattern: benchmark.cjs, event-journal.cjs, and skill-scorer.cjs each have their own `parseJsonlFile()` copy.

### Pattern 4: Task Type Taxonomy (8 canonical types)

**What:** Classify historical tasks into 8 types by action verb + file pattern. These 8 types cover the full range observed across 80+ completed plans.

| Type | Keywords | File indicators |
|------|----------|-----------------|
| `test-setup` | "write tests", "add tests", "tdd", "test suite" | `*.test.cjs` |
| `lib-module` | "create module", "implement", "add function", "build" | `lib/*.cjs` |
| `cli-wiring` | "add command", "wire", "route", "gsd-tools" | `gsd-tools.cjs` |
| `hook-integration` | "hook", "PostToolUse", "SessionEnd", "PreToolUse" | `.claude/hooks/` |
| `workflow-update` | "update workflow", "modify agent", "workflow step" | `workflows/*.md` |
| `dashboard-page` | "dashboard", "page", "chart", "panel" | `desktop/src/` |
| `config-extension` | "config", "setting", "schema", "json key" | `config.json` |
| `documentation` | "document", "write docs", "update docs" | `*.md` |

---

## Build Order (Dependency-Driven)

Phase ordering rationale: pure library modules first (no external dependencies), then consumer modules that import them, then CLI wiring, then workflow injection, then analytics surface.

```
Phase 1: Foundation — plan-indexer.cjs + tests
  No new dependencies. Reads PLAN.md files + phase-benchmarks.jsonl.
  Delivers: plan-index.json building, searching, refreshing.
             Milestone completion hook.
  Validates: the core data model before anything consumes it.
  Standalone test: node gsd-tools.cjs plan-index build → creates .planning/plan-index.json

Phase 2: Classification + Decomposition — task-classifier.cjs + milestone-decomposer.cjs + tests
  Depends on: plan-indexer.cjs (Phase 1).
  Delivers: task type taxonomy, composition engine, milestone pattern matching.
  Classifier and decomposer can be built in parallel (independent algorithms,
  different input files).

Phase 3: Workflow Integration — init.cjs changes + plan-phase.md + new-milestone.md changes
  Depends on: all modules from Phases 1-2.
  Delivers: suggestions surface in plan-phase, proposals surface in new-milestone.
  First phase users see the feature.

Phase 4: Analytics Surface — prompt-scorer.cjs + digest workflow integration + CLI commands
  Depends on: benchmark.cjs pattern (existing), phase-benchmarks.jsonl (existing).
  Independent of Phases 1-3 (entirely different data path — no index dependency).
  Can be built in parallel with Phase 3 if capacity allows.
```

---

## Scaling Considerations

Local file system tool. Scale means "how does this hold up as the project grows."

| Concern | At 100 plans | At 500 plans | At 2000 plans |
|---------|-------------|-------------|---------------|
| plan-index.json size | ~50KB — negligible | ~250KB — fine | ~1MB — still fast JSON parse |
| Index build time | <1 second | <3 seconds | <10 seconds (acceptable at milestone completion) |
| searchIndex() time | <10ms | <50ms | <200ms — add caching if needed |
| PLAN.md files scanned at build | 100 × ~5KB = 500KB read | 2.5MB total | Fine — Node.js handles this |

No scaling concern for the foreseeable lifetime of this project. The pre-built index ensures query time is always fast regardless of plan count growth.

---

## Anti-Patterns

### Anti-Pattern 1: Scanning PLAN.md Files at Query Time

**What people do:** Call `buildIndex()` inside `searchIndex()` on every query to ensure freshness.

**Why it's wrong:** plan-phase.md calls `init plan-phase` synchronously. A 500ms scan of 80 PLAN.md files adds perceptible latency to every planning session. Users will notice.

**Do this instead:** Pre-build at milestone completion. Expose `plan-index build` for manual rebuilds. Fall back gracefully to empty suggestions if index is missing.

### Anti-Pattern 2: Blocking on Missing Index

**What people do:** Error out in `cmdInitPlanPhase` when `plan-index.json` doesn't exist.

**Why it's wrong:** The first time a user runs `/gsd:plan-phase` after installing v14.0, no index exists yet. Erroring out breaks the core planning workflow.

**Do this instead:** Return `plan_suggestions: []` when index is absent. The planner proceeds normally without suggestions. Optionally surface a one-line note: "Run `gsd-tools plan-index build` to enable suggestions."

### Anti-Pattern 3: Separate CLI Call Instead of Init Injection

**What people do:** Add a new `plan-suggest` CLI command and have the workflow call it as a separate step before spawning the planner.

**Why it's wrong:** The workflow already calls `init plan-phase` and receives all context as one JSON blob. Adding a second CLI call adds latency and a new failure surface. The init injection pattern is the established GSD convention (see cmdInitPlanPhase — already assembles 15+ fields from multiple sources).

**Do this instead:** Inject suggestions into the existing init JSON output. One call, one JSON blob, one integration point.

### Anti-Pattern 4: Storing Index in Milestone Scope

**What people do:** Put `plan-index.json` at `.planning/milestones/vX.Y/plan-index.json`.

**Why it's wrong:** The index spans all milestones. Milestone-scoped storage would require searching multiple scopes on every query and re-building per-milestone. The index is a cross-milestone artifact by definition.

**Do this instead:** Store at `.planning/plan-index.json` — same level as `config.json` and `MILESTONES.md`.

### Anti-Pattern 5: Importing New Modules Cross-Circularly

**What people do:** Have task-classifier.cjs import plan-indexer.cjs which imports task-classifier.cjs for classification during build.

**Why it's wrong:** Circular require() in CJS modules causes subtle initialization-order bugs and empty module exports.

**Do this instead:** task-classifier.cjs reads the pre-built `plan-index.json` file directly (JSON.parse) rather than calling plan-indexer.cjs functions. plan-indexer.cjs has no knowledge of task-classifier.cjs.

---

## Sources

- Direct inspection: `get-shit-done/bin/lib/skill-scorer.cjs` — Jaccard + tokenize pattern, v9.0 production code
- Direct inspection: `get-shit-done/bin/lib/benchmark.cjs` — phase-benchmarks.jsonl schema (correction_count, gate_fire_count fields)
- Direct inspection: `get-shit-done/bin/lib/mcp-classifier.cjs` — task classification keyword pattern, established in v13.0
- Direct inspection: `get-shit-done/bin/lib/init.cjs` — existing init injection pattern, how `cmdInitPlanPhase` assembles context
- Direct inspection: `get-shit-done/bin/lib/milestone.cjs` — `cmdMilestoneComplete` structure, where to hook refresh
- Direct inspection: `~/.claude/get-shit-done/workflows/plan-phase.md` — Step 1 init parse + Step 8 planner prompt structure
- Direct inspection: `~/.claude/get-shit-done/workflows/new-milestone.md` — Step 7 init + roadmapper spawn
- Direct inspection: `.planning/milestones/v8.0/v8.0-phases/35-gate-enforcement/35-01-PLAN.md` — PLAN.md frontmatter schema (confirmed fields: phase, plan, files_modified, must_haves, requirements, wave, depends_on)
- Direct inspection: `.planning/patterns/phase-benchmarks.jsonl` — confirmed correction_count + timestamp fields
- Milestone context: `.planning/v14.0-MILESTONE-CONTEXT.md` — Key Decision Points 1-4 from project author (build-time vs query-time, suggest vs auto-populate, specificity of proposals)
- Project context: `.planning/PROJECT.md` — Key Decisions table, established GSD patterns and constraints

---
*Architecture research for: v14.0 Planning Intelligence — CJS integration with existing GSD framework*
*Researched: 2026-04-04*
