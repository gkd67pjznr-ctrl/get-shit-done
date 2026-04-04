# Roadmap — Milestone v9.0 Signal Intelligence

*Created: 2026-04-03*

## Overview

v9.0 extracts actionable signals from existing observability data. Six phases follow a mandatory dependency chain: fix broken progress tracking first, then populate skill data, capture new metrics, surface analytics, compute quality scores, and finally route context budgets intelligently. Every phase depends on the one before it either directly (data must exist before analytics can read it) or structurally (accurate tracking must work before any phase progress is meaningful).

## Phases

- [x] **Phase 37: MISS-01 Fix** - Repair milestone-scoped progress tracking (cmdStateUpdateProgress uses planningRoot) (completed 2026-04-04)
- [x] **Phase 38: Skill Call Tracking** - Populate skills_loaded in sessions.jsonl and skills_active in gate-executions.jsonl (completed 2026-04-04)
- [x] **Phase 39: Data Capture Triad** - Skill iteration history, phase benchmarking, and debt impact analysis (3 independent plans) (completed 2026-04-04)
- [x] **Phase 40: Session Report** - /gsd:session-report command surfacing per-session analytics across all observability data (completed 2026-04-04)
- [x] **Phase 41: Skill Quality Metrics** - Per-skill correction rate scoring using CATEGORY_SKILL_MAP attribution (completed 2026-04-04)
- [x] **Phase 42: Skill Relevance Scoring** - Context budget optimization via keyword-based skill relevance scoring (completed 2026-04-04)

## Phase Details

### Phase 37: MISS-01 Fix
**Goal**: Milestone-scoped progress tracking works correctly
**Depends on**: Nothing (first phase — prerequisite for all others)
**Requirements**: DEBT-01, DEBT-02, DEBT-03
**Success Criteria** (what must be TRUE):
  1. Running cmdStateUpdateProgress with a milestone flag reads phase directories from the milestone workspace, not from the hardcoded .planning/phases/ path
  2. STATE.md shows accurate plan progress counts (not always 0/0) when working in a milestone-scoped project
  3. A test exercises cmdStateUpdateProgress with a milestone workspace invocation and passes
**Plans**: TBD

Plans:
- [x] 37-01: Fix cmdStateUpdateProgress to use planningRoot() and add milestone-scoped test

### Phase 38: Skill Call Tracking
**Goal**: sessions.jsonl and gate-executions.jsonl contain real skill data instead of empty arrays
**Depends on**: Phase 37
**Requirements**: STRK-01, STRK-02, STRK-03
**Success Criteria** (what must be TRUE):
  1. After executing a plan, sessions.jsonl entries show actual skill directory names in the skills_loaded field (not [])
  2. Gate execution entries in gate-executions.jsonl include a skills_active field listing the skills that were loaded at the time the gate fired
  3. Skill call data accumulates across sessions so downstream analytics modules have real data to work with
**Plans**: TBD

Plans:
- [ ] 38-01: Populate skills_loaded in workflow observe steps and extend gate-executions.jsonl with skills_active field

### Phase 39: Data Capture Triad
**Goal**: Skill refinement history is auditable, plan performance is benchmarked, and debt impact is linkable to corrections
**Depends on**: Phase 37
**Requirements**: SHST-01, SHST-02, SHST-03, BNCH-01, BNCH-02, BNCH-03, DIMP-01, DIMP-02, DIMP-03
**Success Criteria** (what must be TRUE):
  1. After accepting a skill suggestion via /gsd:refine-skill, SKILL-HISTORY.md in the skill directory contains a unified diff entry and rationale for the change
  2. After completing a plan, phase-benchmarks.jsonl contains an entry with correction count, gate fire count, and quality level segmented by phase type
  3. Running "debt impact" CLI subcommand outputs debt entries ranked by associated correction count with a link_confidence field
  4. /gsd:fix-debt surfaces correction-linked impact data when presenting debt items for resolution
**Plans**: TBD

Plans:
- [ ] 39-01: Skill iteration history (SKILL-HISTORY.md append, 50-entry rotation, .gitattributes merge=union)
- [ ] 39-02: Phase benchmarking (phase-benchmarks.jsonl writer, benchmark.cjs reader, /gsd:digest integration)
- [ ] 39-03: Debt impact analysis (cmdDebtImpact in debt.cjs, debt impact CLI subcommand, /gsd:fix-debt integration)

### Phase 40: Session Report
**Goal**: Users can surface a complete per-session analytics picture in one command
**Depends on**: Phase 38, Phase 39
**Requirements**: SRPT-01, SRPT-02, SRPT-03
**Success Criteria** (what must be TRUE):
  1. Running /gsd:session-report outputs per-session correction density, gate fire count, and skills loaded for recent sessions
  2. The session report uses a --last N flag to control how many sessions are shown and pre-processes sessions.jsonl via Node.js (not raw inline reads)
  3. When phase-benchmarks.jsonl contains data, the session report includes plan performance trends alongside session metrics
**Plans**: TBD

Plans:
- [ ] 40-01: session-report.cjs analytics module, session-report CLI subcommand, /gsd:session-report slash command

### Phase 41: Skill Quality Metrics
**Goal**: Per-skill correction rates are computed and surfaced using attribution (not raw co-presence)
**Depends on**: Phase 38 (needs real skills_loaded data accumulated over multiple sessions)
**Requirements**: SQLQ-01, SQLQ-02, SQLQ-03
**Success Criteria** (what must be TRUE):
  1. /gsd:digest shows per-skill correction rates with absolute counts alongside rates — not just percentages
  2. Skill metrics in skill-metrics.json use CATEGORY_SKILL_MAP attribution from analyze-patterns.cjs rather than raw skill co-presence in session data
  3. Each skill metric entry includes an attribution_confidence field (high/medium/low) to indicate how reliable the rate estimate is
**Plans**: TBD

Plans:
- [ ] 41-01: skill-metrics.cjs module with CATEGORY_SKILL_MAP attribution, skill-metrics.json computed store, /gsd:digest integration

### Phase 42: Skill Relevance Scoring
**Goal**: Skills are ranked by relevance to the current task at session start to preserve context budget
**Depends on**: Phase 38, Phase 41
**Requirements**: SREL-01, SREL-02, SREL-03, SREL-04
**Success Criteria** (what must be TRUE):
  1. At session start, skills are ranked by keyword overlap against the task description using Jaccard token overlap — relevant skills surface first
  2. Skills under 14 days old receive a score floor of 0.3 so new skills are not excluded before they accumulate history
  3. Skills not loaded in recent sessions have their score reduced by 10% per week of dormancy — stale skills recede naturally
  4. When SKILL.md content changes, the relevance score cache entry for that skill is invalidated via content hash comparison and recomputed fresh
**Plans**: TBD

Plans:
- [ ] 42-01: score-skill-relevance.cjs module with Jaccard scoring, score floor, decay factor, cache invalidation, and score-skills CLI subcommand

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 37. MISS-01 Fix | 1/1 | Complete    | 2026-04-04 |
| 38. Skill Call Tracking | 1/1 | Complete    | 2026-04-04 |
| 39. Data Capture Triad | 3/3 | Complete    | 2026-04-04 |
| 40. Session Report | 0/1 | Complete    | 2026-04-04 |
| 41. Skill Quality Metrics | 0/1 | Complete    | 2026-04-04 |
| 42. Skill Relevance Scoring | 0/1 | Complete    | 2026-04-04 |
