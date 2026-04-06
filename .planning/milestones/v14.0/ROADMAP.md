# Roadmap: v14.0 Planning Intelligence

## Overview

Turn 15 milestones of execution history into planning inputs. Phase 90 builds the plan index that everything reads from. Phase 91 builds the similarity scorer and task classifier, then immediately wires them into live planning workflows so the planner sees relevant historical context before writing a single task. Phase 92 closes the feedback loop by scoring prompt quality in digest, surfacing which plans produced corrections and why.

## Phases

- [x] **Phase 90: Plan Indexer Foundation** - Build the shared plan-index.json that all planning intelligence reads from (completed 2026-04-06)
- [ ] **Phase 91: Similarity, Task Intelligence & Workflow Integration** - Score similarity, classify tasks, and inject intelligence into plan-phase and new-milestone workflows
- [ ] **Phase 92: Prompt Quality Scoring** - Score prompt quality per plan and surface outliers in /gsd:digest

## Phase Details

### Phase 90: Plan Indexer Foundation
**Goal**: A pre-built plan index exists on disk that captures structural features, correction counts, and age-decay weights for every completed plan across all milestones
**Depends on**: Nothing (first phase)
**Requirements**: IDX-01, IDX-02, IDX-03, IDX-04, IDX-05, IDX-06
**Success Criteria** (what must be TRUE):
  1. Running `gsd plan-index --rebuild` produces `.planning/plan-index.json` with entries for every completed PLAN.md across all milestone workspaces
  2. Each index entry includes plan_id, phase_goal, task_types, files_modified, requirement_count, tags, correction_count, gate_fire_count, age-decay weight, and superseded_by field
  3. Completing a milestone via `cmdMilestoneComplete` automatically triggers an index rebuild as its final step without user intervention
  4. Index entries older than 14 days surface a staleness warning when queried
**Plans**: TBD

Plans:
- [x] 90-01: plan-indexer.cjs — scanner, extractor, TF-IDF index builder, and plan-index.json schema
- [x] 90-02: milestone-complete hook, CLI subcommand wiring, and index staleness detection

### Phase 91: Similarity, Task Intelligence & Workflow Integration
**Goal**: The plan-phase workflow surfaces a reference table of similar historical plans and best-performing task examples before the planner agent drafts anything; the new-milestone workflow gains the same signal after requirements are complete
**Depends on**: Phase 90
**Requirements**: SIM-01, SIM-02, SIM-03, SIM-04, SIM-05, TASK-01, TASK-02, TASK-03
**Success Criteria** (what must be TRUE):
  1. When starting a new plan phase, the planner receives a planning_intelligence block showing up to 3 similar historical plans with similarity score, correction rate, and component score breakdown (keyword / task-type / file-pattern shown separately — never a single composite)
  2. Suggestions appear as reference tables with source plan, score, and "adapt as needed" framing — a pre-filled draft is never generated
  3. Plans from superseded or decayed milestones are excluded from similarity results; plans below the 0.65 threshold produce no signal rather than a low-confidence suggestion
  4. The planner also receives a per-task-type performance table showing which task types historically produce fewest corrections, with the best historical example per type
  5. Skeleton adapter fields (substituted file paths, requirement IDs, phase numbers) appear in matched index entries when similarity results are surfaced
**Plans**: TBD

Plans:
- [ ] 91-01: plan-similarity.cjs — TF-IDF cosine + Jaccard hybrid scorer, threshold gating, component score breakdown
- [ ] 91-02: task-classifier.cjs — 8 canonical types, per-type correction ranking, composition assistant
- [ ] 91-03: Workflow injection — cmdInitPlanPhase plan_suggestions field, plan-phase.md planning_intelligence block, skeleton adapter

### Phase 92: Prompt Quality Scoring
**Goal**: /gsd:digest surfaces a Prompt Quality section showing per-plan correction scores stratified by task type, with outliers flagged for review — never as a blocking gate
**Depends on**: Phase 90
**Requirements**: PROM-01, PROM-02, PROM-03
**Success Criteria** (what must be TRUE):
  1. Running /gsd:digest shows a "Prompt Quality" section with a per-plan score expressed as "Nx median for task-type" (not a raw number), covering the current milestone's completed plans
  2. Plans scoring above 2x their task-type-stratified median are flagged as outliers with the specific correction categories driving the score
  3. Per-task correction attribution uses task-index or timestamp matching from workflow.jsonl; plans without task-level data fall back to per-plan correction totals without error
  4. The prompt quality score never appears as a blocking gate — it is diagnostic only and has no effect on workflow execution
**Plans**: TBD

Plans:
- [ ] 92-01: prompt-scorer.cjs — task-type-stratified baseline, per-task attribution with per-plan fallback, CLI subcommand
- [ ] 92-02: /gsd:digest Prompt Quality section integration

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 90. Plan Indexer Foundation | 2/2 | Complete   | 2026-04-06 |
| 91. Similarity, Task Intelligence & Workflow Integration | 0/3 | Not started | - |
| 92. Prompt Quality Scoring | 0/2 | Not started | - |
