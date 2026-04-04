# Roadmap: v15.0 Autonomous Learning

*Created: 2026-04-04*

## Overview

Close the gap between "captures data" and "acts on it." This milestone delivers three capabilities that make the learning pipeline autonomous: auto-apply high-confidence skill refinements with safety guardrails, shift code review focus per-project based on correction history, and surface when correction patterns contradict recorded decisions. All three build on v6.0 correction capture, v8.0 skill loop, and v9.0 signal intelligence — the data is already flowing, this milestone makes the system act on it.

## Phases

**Phase Numbering:**
- Integer phases (80-83): Planned milestone work

- [x] **Phase 80: Auto-Apply Safety Engine** - Core auto-apply logic with all safety guardrails (confidence gate, rate limiting, high-performer skip, audit log)
- [ ] **Phase 81: Auto-Apply User Control** - Revert command and manual fallback surface for failed auto-apply checks
- [ ] **Phase 82: Adaptive Review Profiles** - Per-project review profile generation, storage, and code-review skill integration
- [ ] **Phase 83: Decision Audit Trail** - Decision tension detection via Jaccard matching and digest surfacing

## Phase Details

### Phase 80: Auto-Apply Safety Engine
**Goal**: High-confidence skill refinements apply automatically without human intervention, subject to all safety guardrails
**Depends on**: Nothing (first phase — v8.0 skill loop and v9.0 metrics are prerequisites already shipped)
**Requirements**: AUTO-01, AUTO-02, AUTO-03, AUTO-04, AUTO-05
**Success Criteria** (what must be TRUE):
  1. A skill refinement with confidence > 0.95 and <20% content change auto-applies when `adaptive_learning.auto_apply: true` is set in config
  2. With `auto_apply: false` (the default), no auto-apply occurs regardless of confidence — the feature is off unless explicitly enabled
  3. Every auto-applied change produces an entry in `auto-applied.jsonl` containing before/after diff, confidence score, source correction IDs, and reversal instructions
  4. A second auto-apply attempt on the same skill within 7 days is skipped (rate limit enforced)
  5. Skills with a "high" quality score in skill-metrics.json are bypassed — auto-apply only touches skills with room to improve
**Plans**: TBD

Plans:
- [x] 80-01: Implement auto-apply engine in apply-skill-refinement hook path with confidence/change/flag/rate/quality guards
- [x] 80-02: Wire auto_apply config key, audit log (auto-applied.jsonl), and integration tests

### Phase 81: Auto-Apply User Control
**Goal**: Users can revert any auto-applied change and failed auto-apply checks surface as normal manual suggestions
**Depends on**: Phase 80
**Requirements**: AUTO-06, AUTO-07
**Success Criteria** (what must be TRUE):
  1. `/gsd:refine-skill revert <id>` restores the skill to its pre-auto-apply state using the reversal instructions in auto-applied.jsonl
  2. A skill refinement that fails the auto-apply safety checks (confidence too low, change too large, controversial flag, rate limit) appears as a normal pending suggestion in the standard manual review flow — nothing is silently discarded
**Plans**: TBD

Plans:
- [ ] 81-01: Add revert subcommand to refine-skill and implement manual-suggestion fallback for failed auto-apply checks

### Phase 82: Adaptive Review Profiles
**Goal**: Code review focus adapts per-project based on what Claude has historically gotten wrong, so reviews emphasize the areas that matter most
**Depends on**: Phase 81
**Requirements**: REVP-01, REVP-02, REVP-03, REVP-04, REVP-05
**Success Criteria** (what must be TRUE):
  1. After 10+ corrections have been captured for a project, `.planning/patterns/review-profile.json` exists with category weights derived from corrections.jsonl distribution
  2. Projects with fewer than 10 corrections do not generate a review profile — the code-review skill falls back to default focus
  3. The code-review skill's review focus reflects the top-weighted categories from review-profile.json (high-weight categories receive more attention)
  4. At session start, the review profile refreshes automatically — the next session always sees the latest correction distribution
**Plans**: TBD

Plans:
- [ ] 82-01: Implement review profile generator (corrections.jsonl → review-profile.json) with 10-correction minimum guard
- [ ] 82-02: Update code-review skill to read review-profile.json and wire session-start hook refresh

### Phase 83: Decision Audit Trail
**Goal**: When correction patterns contradict a recorded decision in PROJECT.md, /gsd:digest surfaces the tension so the user can re-evaluate the decision or address the recurring mistake
**Depends on**: Phase 82
**Requirements**: DAUD-01, DAUD-02, DAUD-03, DAUD-04
**Success Criteria** (what must be TRUE):
  1. The system parses the Key Decisions table from PROJECT.md and extracts decision text and rationale for each row
  2. Corrections are matched against decision keywords using Jaccard token overlap — the matching is deterministic and reproducible
  3. When 3+ corrections match a decision's keywords, the tension is flagged with a confidence score
  4. `/gsd:digest` includes a "Decision Tensions" section listing flagged tensions with evidence: which corrections matched, which decision, and the confidence score
**Plans**: TBD

Plans:
- [ ] 83-01: Implement decision parser (PROJECT.md Key Decisions table) and Jaccard correction matcher with 3-correction threshold
- [ ] 83-02: Surface decision tensions in /gsd:digest with evidence formatting

## Progress

**Execution Order:**
Phases execute in numeric order: 80 → 81 → 82 → 83

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 80. Auto-Apply Safety Engine | 2/2 | Complete    | 2026-04-04 |
| 81. Auto-Apply User Control | 0/1 | Not started | - |
| 82. Adaptive Review Profiles | 0/2 | Not started | - |
| 83. Decision Audit Trail | 0/2 | Not started | - |
