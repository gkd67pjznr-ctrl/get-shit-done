# Roadmap: v6.0 Adaptive Observation & Learning Loop

## Overview

Transform the observation system from a passive event logger into an intelligent correction-capture and preference-learning pipeline that feeds back into skill refinement. The milestone builds in strict dependency order: data schemas and capture first, then preference extraction, then recall injection, then the observer agent and suggestion pipeline, then enhanced analysis with skill refinement, and finally cross-project inheritance and skill loading. Each phase delivers a coherent, verifiable capability that the next phase depends on.

## Phases

**Phase Numbering:**
- Integer phases (22-27): Planned milestone work
- Decimal phases (e.g., 23.1): Urgent insertions (marked with INSERTED)

- [x] **Phase 22: Data Layer and Correction Capture** - Hook-based correction detection with structured JSONL storage and rotation (Plans 22-01, 22-02, 22-03 complete)
- [x] **Phase 23: Self-Diagnosis and Preference Tracking** - Root cause categorization of corrections and promotion to durable preferences (completed 2026-03-10)
- [x] **Phase 24: Live Recall and Session Injection** - Surfacing corrections and preferences at session start and during active work (completed 2026-03-10)
- [x] **Phase 25: Observer Agent and Suggestion Pipeline** - Pattern aggregation and suggestion generation with guardrail enforcement (completed 2026-03-11)
- [x] **Phase 26: Enhanced Digest and Skill Refinement** - Correction analysis in digest with collaborative skill refinement workflow (completed 2026-03-11)
- [ ] **Phase 27: Cross-Project Inheritance and Skill Loading** - User-level preference promotion and learned skill injection into all GSD commands

## Phase Details

### Phase 22: Data Layer and Correction Capture
**Goal**: Users' corrections are automatically captured with structured metadata so the system has raw material for learning
**Depends on**: Nothing (first phase of v6.0)
**Requirements**: CAPT-01, CAPT-02, CAPT-03, CAPT-04
**Success Criteria** (what must be TRUE):
  1. When a user corrects Claude (e.g., reverts a file, rewrites output), a structured entry appears in corrections.jsonl within 500ms
  2. Each correction entry contains correction_from, correction_to, diagnosis_category, diagnosis_text, scope, and phase fields
  3. Claude automatically analyzes root cause using the 7-category taxonomy and includes a diagnosis under 100 tokens
  4. When corrections.jsonl exceeds 1000 lines, older entries are rotated to dated archive files respecting retention_days config
**Plans**:
  - [x] Plan 22-01: Correction Write Library and JSONL Rotation (complete, commit bbc2017)
  - [x] Plan 22-02: Edit-Based Detection Hook (complete, commit 924ad16)
  - [x] Plan 22-03: Self-Report Skill and Phase Verification (complete, commit 6dbaf61)

### Phase 23: Preference Tracking
**Goal**: Repeated corrections are promoted to durable preferences so Claude builds persistent memory of user expectations
**Depends on**: Phase 22
**Requirements**: PREF-01, PREF-02
**Success Criteria** (what must be TRUE):
  1. When the same correction pattern appears 3+ times, a preference is automatically created in preferences.jsonl with a confidence score
  2. Each preference is tagged with a scope (file/filetype/phase/project/global) defaulting to the narrowest applicable scope
  3. Preferences are queryable by scope so downstream recall can filter by current context
**Plans**:
  - [x] Plan 23-01: readPreferences() and Test Scaffold (complete)
  - [x] Plan 23-02: write-preference.cjs upsert and promotion (complete)
  - [x] Plan 23-03: Integration wiring and tests (complete, commits e9f9cf9, 4783da6)

### Phase 24: Live Recall and Session Injection
**Goal**: Claude remembers its past mistakes -- corrections and preferences are surfaced at session boundaries and during active work
**Depends on**: Phase 23
**Requirements**: RECL-01, RECL-02, RECL-03, PREF-04
**Success Criteria** (what must be TRUE):
  1. At session start, /gsd:session-start loads up to 10 relevant corrections filtered by current phase, staying under 3K tokens
  2. During active work, Claude cross-references historical corrections before repeating known mistakes
  3. Corrections and preferences that have been baked into skill refinements are excluded from recall
  4. Recall output is concise and actionable -- not a data dump, but targeted reminders
**Plans**:
  - [x] Plan 24-01: readCorrections() and Test Scaffold (complete, commit 739dc71)
  - [ ] Plan 24-02: inject-recall.cjs PreToolUse Hook
  - [ ] Plan 24-03: Integration and Verification

### Phase 25: Observer Agent and Suggestion Pipeline
**Goal**: An intelligent observer replaces the stub -- it aggregates patterns from corrections and generates skill refinement suggestions
**Depends on**: Phase 24
**Requirements**: OBSV-01, OBSV-02, OBSV-03
**Success Criteria** (what must be TRUE):
  1. The observer agent performs session boundary analysis, aggregating correction patterns and extracting preferences
  2. When correction patterns cross the min_occurrences threshold, suggestion candidates appear in suggestions.json for /gsd:suggest
  3. All 6 bounded learning guardrails are enforced (20% max change, 3 corrections min, 7-day cooldown, user confirmation, permission checks, 5+ co-activations)
  4. The observer runs as a lightweight bounded operation, not a full subagent spawn
**Plans**:
  - [x] Plan 25-01: analyze-patterns.cjs Observer Engine
  - [x] Plan 25-02: Observer Wrapper, /gsd:suggest Command, and Digest Integration

### Phase 26: Enhanced Digest and Skill Refinement
**Goal**: Users can see their correction trends and collaboratively refine skills when corrections consistently contradict them
**Depends on**: Phase 25
**Requirements**: ANLY-01, ANLY-02, ANLY-03
**Success Criteria** (what must be TRUE):
  1. /gsd:digest includes a correction analysis section grouping corrections by diagnosis category with trends
  2. When 3+ corrections point to the same skill, /gsd:digest initiates a collaborative skill refinement workflow asking the user how to update the skill
  3. After a skill is refined, the source corrections and preferences that drove the change are retired from active recall
**Plans**: TBD

### Phase 27: Cross-Project Inheritance and Skill Loading
**Goal**: Learned preferences travel across projects and all GSD commands benefit from learned skills
**Depends on**: Phase 26
**Requirements**: PREF-03, LOAD-01, LOAD-02
**Success Criteria** (what must be TRUE):
  1. When a preference appears in 3+ projects, it is promoted to ~/.gsd/preferences.json as a user-level preference
  2. All 7 GSD workflow commands load relevant learned skills into their execution context
  3. All GSD agents and subagents inherit learned skills in their spawned context
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 22 -> 23 -> 24 -> 25 -> 26 -> 27

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 22. Data Layer and Correction Capture | 3/3 | Complete    | 2026-03-10 |
| 23. Preference Tracking | 3/3 | Complete    | 2026-03-10 |
| 24. Live Recall and Session Injection | 3/3 | Complete    | 2026-03-10 |
| 25. Observer Agent and Suggestion Pipeline | 1/2 | Complete    | 2026-03-11 |
| 26. Enhanced Digest and Skill Refinement | 3/3 | Complete    | 2026-03-11 |
| 27. Cross-Project Inheritance and Skill Loading | 1/3 | In Progress|  |
