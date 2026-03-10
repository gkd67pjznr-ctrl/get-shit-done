# Roadmap: v7.0 Quality Enforcement Observability

## Overview

Transform quality gate enforcement from invisible runtime behavior into fully observable, persisted, dashboard-visible metrics. Phase 28 lays the data foundation by persisting gate executions, correction quality context, and Context7 calls to disk. Phase 29 researches additional quality gating tools beyond Context7. Phases 30-31 surface that data in the dashboard -- first as a dedicated Gate Health page, then integrated into overview page headers, milestone lines, and tmux cards. Phase 32 closes the loop with gate-to-correction attribution analytics.

## Phases

**Phase Numbering:**
- Integer phases (28, 29, 30, 31, 32): Planned milestone work
- Decimal phases (e.g., 28.1): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 28: Gate Execution Persistence** - Persist all gate events, correction quality context, and Context7 calls to structured JSONL files (completed 2026-03-10)
- [ ] **Phase 29: Quality Gating Research** - Evaluate additional MCP servers, tools, and libraries for quality gating beyond Context7
- [ ] **Phase 30: Dashboard Gate Health Page** - Dedicated page with gate outcome distribution, quality level usage, per-gate firing rates, and Context7 metrics
- [ ] **Phase 31: Dashboard Overview Integration** - Surface quality level, gate firing rates, and gate metrics in overview page project headers, milestone lines, and tmux cards
- [ ] **Phase 32: Gate-to-Correction Attribution** - Heuristic analysis mapping corrections to originating gates with structured output

## Phase Details

### Phase 28: Gate Execution Persistence
**Goal**: Every quality gate execution produces a durable, queryable record on disk
**Depends on**: Nothing (first phase -- foundational data collection)
**Requirements**: GATE-01, GATE-02, GATE-03
**Success Criteria** (what must be TRUE):
  1. After any executor run in standard or strict mode, gate-executions.jsonl contains one entry per sentinel step with gate name, outcome, quality level, and timestamp
  2. Every new correction entry in corrections.jsonl includes a quality_level field reflecting the active enforcement level at capture time
  3. Every Context7 library lookup produces an entry in context7-calls.jsonl with library name, tokens requested, token cap, and whether the result was used
  4. Running in fast mode produces no gate-execution or context7-call entries (fast skips gates entirely)
**Plans**: TBD

### Phase 29: Quality Gating Research
**Goal**: Understand what additional MCP servers, tools, or libraries could strengthen quality gating
**Depends on**: Nothing (independent research, can parallel with Phase 28)
**Requirements**: GATE-04
**Success Criteria** (what must be TRUE):
  1. A research document exists evaluating at least 3 candidate MCP servers or tools for quality gating relevance
  2. Each candidate is assessed for integration feasibility, expected gate coverage improvement, and context budget impact
  3. Clear recommendation of which candidates (if any) warrant implementation in a future milestone
**Plans**: TBD

### Phase 30: Dashboard Gate Health Page
**Goal**: Users can view comprehensive gate health metrics on a dedicated dashboard page
**Depends on**: Phase 28 (needs gate-executions.jsonl data to display)
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05
**Success Criteria** (what must be TRUE):
  1. Dashboard has a dedicated Gate Health page accessible from navigation (like the existing patterns page)
  2. Gate outcome distribution (passed/warned/blocked/skipped) is visualized with rates and counts
  3. Quality level usage distribution across sessions is visible (how often fast vs standard vs strict)
  4. Per-gate firing rates and warn rates are displayed for each of the 5 sentinel steps
  5. Context7 utilization metrics show call count, token usage, and cap-hit frequency
**Plans**: TBD

### Phase 31: Dashboard Overview Integration
**Goal**: Quality gate health is visible at a glance from the overview page without navigating to the dedicated page
**Depends on**: Phase 30 (reuses data loading and visualization components from Gate Health page)
**Requirements**: DASH-06, DASH-07, DASH-08
**Success Criteria** (what must be TRUE):
  1. Each project header on the overview page shows the project's active quality level (fast/standard/strict)
  2. Milestone line items display gate firing rate summaries (e.g., total fires, warn percentage)
  3. Tmux terminal session cards include a gate metrics summary (recent gate activity for that session's project)
**Plans**: TBD

### Phase 32: Gate-to-Correction Attribution
**Goal**: Users can understand which gates are catching which categories of corrections
**Depends on**: Phase 28 (needs both gate-executions.jsonl and corrections.jsonl with quality_level)
**Requirements**: ANLZ-01, ANLZ-02
**Success Criteria** (what must be TRUE):
  1. An attribution analysis script reads gate-executions.jsonl and corrections.jsonl and produces heuristic mappings from correction categories to originating gates
  2. Attribution results are written to gate-attribution.jsonl with structured entries linking correction types to gate names with confidence scores
  3. Running the attribution script with no data produces an empty result (not an error)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 28 -> 29 -> 30 -> 31 -> 32

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 28. Gate Execution Persistence | 3/3 | Complete    | 2026-03-10 |
| 29. Quality Gating Research | 0/? | Not started | - |
| 30. Dashboard Gate Health Page | 0/? | Not started | - |
| 31. Dashboard Overview Integration | 0/? | Not started | - |
| 32. Gate-to-Correction Attribution | 0/? | Not started | - |
