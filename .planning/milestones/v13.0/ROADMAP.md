# Roadmap — Milestone v13.0: Unified Observability & Context Routing

*Created: 2026-04-04*

## Overview

Three focused features that unify fragmented event streams, surface hidden context costs, and add advisory MCP routing intelligence. Phase 84 builds the event journaling backbone — a central emitter integrated across all emission points with a reader and digest surface. Phase 85 adds context budget tracking per skill so the most expensive low-relevance skills become visible candidates for deferral. Phase 86 closes with MCP server selection intelligence that classifies tasks before executor spawn and recommends appropriate servers.

## Phases

**Phase Numbering:**
- Integer phases (84, 85, 86): Planned milestone work
- Decimal phases: Urgent insertions only (via /gsd:insert-phase)

- [x] **Phase 84: Event Journaling** - Central workflow.jsonl emitter, full integration, reader, digest timeline, and rotation
- [x] **Phase 85: Context Budget Optimizer** - Per-skill token cost measurement, session recording, aggregation, and digest surfacing
- [x] **Phase 86: MCP Server Selection** - Task-type classifier, recommendation mapping, execute-plan integration, and dashboard validation

## Phase Details

### Phase 84: Event Journaling
**Goal**: Users can query a single chronological event stream that reconstructs what happened during any plan
**Depends on**: Nothing (first phase of milestone)
**Requirements**: JRNL-01, JRNL-02, JRNL-03, JRNL-04, JRNL-05
**Success Criteria** (what must be TRUE):
  1. Running any GSD workflow command writes structured events to workflow.jsonl with type, timestamp, phase, plan, task, session_id, and data fields
  2. Calling the reader function with a phase/plan filter returns the matching subset of events in chronological order
  3. Running /gsd:digest for a completed plan shows an event timeline ("Plan 84-01 timeline: N events across X minutes")
  4. After the entry count reaches the configured threshold, workflow.jsonl rotates to a backup and starts fresh
**Plans**: TBD

Plans:
- [x] 84-01: Implement emitEvent() core function and workflow.jsonl writer with rotation
- [x] 84-02: Integrate emitter into gate-runner, correction hooks, workflow observe steps, and session hooks; implement reader function with filter support; surface event timeline in /gsd:digest
- [x] 84-03: Add Event Timeline section to /gsd:digest (Step 3j); write 6 integration tests

### Phase 85: Context Budget Optimizer
**Goal**: Users can see which skills cost the most context and which are poor cost-per-relevance investments
**Depends on**: Phase 84
**Requirements**: BUDG-01, BUDG-02, BUDG-03, BUDG-04
**Success Criteria** (what must be TRUE):
  1. At session start, sessions.jsonl records a skill_token_cost map alongside skills_loaded showing each skill's estimated token cost
  2. Running the aggregation function returns per-skill average cost, load frequency, and cost-per-fire ratio across all sessions
  3. Running /gsd:digest shows a context budget section naming top consumers and flagging high-cost low-relevance skills as deferral candidates
**Plans**: TBD

Plans:
- [x] 85-01: Implement token cost measurement function, record skill_token_cost in sessions.jsonl, build aggregation function, and surface context budget analysis in /gsd:digest

### Phase 86: MCP Server Selection
**Goal**: Users receive advisory MCP server recommendations before each executor spawn, matched to the task type
**Depends on**: Phase 85
**Requirements**: MCPS-01, MCPS-02, MCPS-03, MCPS-04
**Success Criteria** (what must be TRUE):
  1. Given a plan with task descriptions and file types, the classifier function returns a task type (e.g., library-integration, database, ui-component)
  2. The recommendation mapping translates each task type to a list of suggested MCP servers
  3. Execute-plan emits a visible recommendation ("This plan touches API endpoints — consider loading HTTP MCP") before spawning the executor
  4. When the v10.0 MCP dashboard is running, the recommendation step queries available MCP servers via tool call and validates recommendations against what is actually configured
**Plans**: TBD

Plans:
- [x] 86-01: Implement task-type classifier and MCP recommendation mapping
- [x] 86-02: Integrate recommendation emission into execute-plan workflow and add dashboard validation query

## Progress

**Execution Order:**
Phases execute in order: 84 → 85 → 86

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 84. Event Journaling | 3/3 | Complete    | 2026-04-04 |
| 85. Context Budget Optimizer | 1/1 | Complete    | 2026-04-04 |
| 86. MCP Server Selection | 2/2 | Complete   | 2026-04-04 |
