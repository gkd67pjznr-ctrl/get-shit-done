# Roadmap — Milestone v11.0 Wild Brainstorming Engine

*Created: 2026-04-04*

## Overview

v11.0 builds a mechanical brainstorming engine that enforces divergent thinking through code constraints rather than prompts. Three stages — Seed, Expand, Converge — execute in sequence via a `/gsd:brainstorm` slash command. Enforcement prevents evaluative language, enforces minimum idea counts, requires all SCAMPER lenses, and detects saturation. Output lands in structured FEATURE-IDEAS.md files with full session transcripts. Data-driven seeding pulls from corrections, debt, and sessions. Session history links ideas to the phases that eventually implement them.

## Phases

- [x] **Phase 45: Enforcement Core** - brainstorm.cjs with eval detection, append-only store, SCAMPER cycling, quantity floors, saturation detection, and seed brief builder (completed 2026-04-04)
- [ ] **Phase 46: Converge and Output** - converge.cjs with clustering, scoring, ranking, user finalist selection, and all 4 output artifacts
- [ ] **Phase 47: Workflow and Command** - brainstorm.md 3-stage pipeline, interactive expand techniques, perspective shifts, saturation handling, --wild flag, and /gsd:brainstorm command
- [ ] **Phase 48: Data-Driven Seeding** - --from-corrections, --from-debt, --for-milestone flags, prior FEATURE-IDEAS.md anti-retreading
- [ ] **Phase 49: History and Traceability** - session metadata tracking, idea-to-phase links, /gsd:new-milestone seed context integration

## Phase Details

### Phase 45: Enforcement Core
**Goal**: The brainstorm enforcement module exists as a tested CJS module with mechanical constraints that make it structurally impossible to advance without satisfying idea quantity, SCAMPER completeness, and evaluation cleanliness
**Depends on**: Nothing (first phase)
**Requirements**: ENFC-01, ENFC-02, ENFC-03, ENFC-04, ENFC-05, ENFC-06
**Success Criteria** (what must be TRUE):
  1. Calling the eval detector on a string containing "that won't work" or "too complex" returns a re-prompt signal before the idea is stored
  2. The append-only store rejects any call that attempts to update or delete an existing idea entry
  3. A SCAMPER session with only 5 of 7 lenses completed cannot advance — the module returns a "missing lenses" error
  4. With `--wild` active, quantity floors double compared to normal mode (e.g., freeform floor becomes 30 instead of 15)
  5. Saturation detector returns a "switch technique" signal when idea velocity drops below threshold across consecutive idea batches
**Plans**: TBD

### Phase 46: Converge and Output
**Goal**: Users can take a completed idea store through a converge pipeline that clusters ideas into themes, scores each on 4 dimensions, presents a ranked list for finalist selection, and writes all 4 output artifacts
**Depends on**: Phase 45
**Requirements**: CONV-01, CONV-02, CONV-03, CONV-04, OUTP-01, OUTP-02, OUTP-03, OUTP-04
**Success Criteria** (what must be TRUE):
  1. Converge reads only from the frozen append-only store — no modification to ideas.jsonl occurs during or after the converge run
  2. Every idea appears in exactly one cluster, and the cluster count falls between 3 and 7
  3. Each idea has a composite score derived from feasibility, impact, alignment, and risk dimensions visible in the output
  4. FEATURE-IDEAS.md, BRAINSTORM-SESSION.md, raw ideas.jsonl, and the session directory all exist after a complete run
  5. Output lands in `.planning/quick/NN-brainstorm-[topic]/` with correct sequential numbering
**Plans**: TBD

### Phase 47: Workflow and Command
**Goal**: The full 3-stage brainstorming pipeline runs end-to-end via `/gsd:brainstorm [topic]`, with interactive expand techniques (freeform, SCAMPER, starbursting, perspective shifts), saturation-triggered technique switching, and `--wild` mode activating maximum unhinged enforcement across all stages
**Depends on**: Phase 46
**Requirements**: EXPD-01, EXPD-02, EXPD-03, EXPD-04, EXPD-05, CMND-01, CMND-02, CMND-03
**Success Criteria** (what must be TRUE):
  1. Running `/gsd:brainstorm authentication` initiates seed, then expand (freeform → SCAMPER → starbursting → perspectives), then converge in a single session without manual stage transitions
  2. In standard mode, freeform generates at least 15 ideas; in `--wild` mode, at least 30 — with evaluation detection firing on any evaluative language before storage
  3. SCAMPER presents all 7 lens prompts interactively and requires a minimum of 2 ideas per lens (4 in wild) before advancing to the next lens
  4. Saturation check after each expand technique offers the user a "switch technique" or "move to converge" decision
  5. `/gsd:brainstorm --wild --for-milestone` composes both flags without conflict, activating both wild mode enforcement and milestone-aware seeding
**Plans**: TBD

### Phase 48: Data-Driven Seeding
**Goal**: The brainstorm engine can be seeded with structured data from corrections, debt, and sessions so that brainstorming is grounded in real project signals while deliberately excluding roadmap context (context blinding)
**Depends on**: Phase 47
**Requirements**: SEED-01, SEED-02, SEED-03, SEED-04, SEED-05
**Success Criteria** (what must be TRUE):
  1. The seed brief builder reads corrections.jsonl, sessions.jsonl, and DEBT.md but explicitly does not read ROADMAP.md or STATE.md — confirmed by code inspection
  2. Running `/gsd:brainstorm --from-corrections` produces a seed brief containing correction pattern analysis that appears in the session's opening context
  3. Running `/gsd:brainstorm --from-debt` produces a seed brief containing open debt item summaries
  4. Running `/gsd:brainstorm --for-milestone` combines all data sources (corrections + debt + sessions) into a comprehensive seed brief
  5. Any existing FEATURE-IDEAS.md files in `.planning/quick/` are read during seeding and surfaced as "already explored" context to prevent retreading prior ideas
**Plans**: TBD

### Phase 49: History and Traceability
**Goal**: Brainstorm sessions accumulate traceable history so users can see what was explored over time, which ideas became implemented phases, and so new milestone starts automatically offer to load relevant prior ideas as seed context
**Depends on**: Phase 48
**Requirements**: HIST-01, HIST-02, HIST-03
**Success Criteria** (what must be TRUE):
  1. Each completed brainstorm session writes metadata (topic, date, flag combination, idea count, output path) to a persistent session index
  2. A user can tag an idea from FEATURE-IDEAS.md as "implemented in Phase N" and query the history to see all ideas that became phases
  3. Running `/gsd:new-milestone` after a recent brainstorm session surfaces a prompt offering to load FEATURE-IDEAS.md ideas as seed context for the new milestone
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 45. Enforcement Core | 3/3 | Complete    | 2026-04-04 |
| 46. Converge and Output | 1/TBD | In Progress | - |
| 47. Workflow and Command | 0/TBD | Not started | - |
| 48. Data-Driven Seeding | 0/TBD | Not started | - |
| 49. History and Traceability | 0/TBD | Not started | - |
