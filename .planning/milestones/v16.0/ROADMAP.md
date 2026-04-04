# Roadmap — Milestone v16.0 Multi-Milestone Batch Planner

*Created: 2026-04-04*

## Overview

v16.0 delivers `/gsd:multi-milestone` — a single-session command that accepts a feature dump, clusters ideas into milestone themes, creates N workspaces, scopes requirements interactively per milestone, roadmaps all milestones in parallel via proposal mode, then runs a new synthesizer agent to assign all version and phase numbers and write every artifact. The highest-risk component (the roadmap synthesizer and proposal mode) is built first so the full batch workflow has a proven foundation to build on.

## Phases

- [x] **Phase 87: Synthesizer Foundation** - Build `gsd-roadmap-synthesizer` agent and roadmapper proposal mode (completed 2026-04-04)
- [ ] **Phase 88: Batch Workflow Stages 0-3** - Feature intake, workspace creation, conflict check, session tracking, and per-milestone research + requirements scoping
- [ ] **Phase 89: Synthesis, Review, and Resume** - Synthesizer writes all artifacts, root file updates, user approval loop, and `--resume` capability

## Phase Details

### Phase 87: Synthesizer Foundation
**Goal**: The roadmap synthesizer agent exists and the roadmapper can produce unnumbered proposals — two new capabilities that the batch workflow depends on before anything else is built
**Depends on**: Nothing (first phase)
**Requirements**: RSYN-01, RSYN-02
**Success Criteria** (what must be TRUE):
  1. Running `/gsd:roadmap` with `mode=proposal` produces a PROPOSAL.md with named placeholder phases (PHASE-A, PHASE-B) and no assigned phase numbers
  2. The `gsd-roadmap-synthesizer` agent file exists and, given N PROPOSAL.md files and a `next_starting_phase`, assigns sequential phase numbers to all phases across all milestones without gaps or collisions
  3. Synthesizer correctly attributes each phase's requirements back to its source milestone workspace
**Plans**: TBD

Plans:
- [x] 87-01: Define `gsd-roadmap-synthesizer` agent and extend roadmapper proposal mode

### Phase 88: Batch Workflow Stages 0-3
**Goal**: The `/gsd:multi-milestone` command guides the user from a raw feature dump through cluster review, workspace creation, and full per-milestone requirements scoping — producing committed REQUIREMENTS.md files for every milestone before any roadmapping begins
**Depends on**: Phase 87
**Requirements**: INTK-01, INTK-02, INTK-03, INTK-04, INTK-05, WKSP-01, WKSP-02, WKSP-03, WKSP-04, SCOP-01, SCOP-02, SCOP-03, SCOP-04
**Success Criteria** (what must be TRUE):
  1. User can start the command with inline text, `--from-file <path>`, or `--from-brainstorm NN` and see the ideas counted and clustered into 3-6 milestone themes
  2. User can rename, merge, split, and move ideas between clusters before promoting them to milestones, and any idea can be marked out of scope
  3. All N milestone workspaces are created in parallel with auto-assigned version numbers; a single consolidated conflict check runs once after all workspaces exist
  4. For each milestone, user can choose skip or include research independently; when research is included, 4 parallel researcher agents plus a synthesizer run before scoping begins
  5. Full requirements scoping runs per-milestone (same category presentation and multiSelect UX as `new-milestone`), producing a committed REQUIREMENTS.md with REQ-IDs in each workspace
  6. BATCH-SESSION.md is written and updated at each stage boundary with completion status and timestamps
**Plans**: TBD

Plans:
- [ ] 88-01: Feature intake parsing, affinity clustering, and cluster review UI
- [ ] 88-02: Workspace creation, conflict check, and BATCH-SESSION.md tracking
- [ ] 88-03: Per-milestone research opt-in and requirements scoping loop

### Phase 89: Synthesis, Review, and Resume
**Goal**: After all milestones are scoped, the synthesizer produces every roadmap artifact in one pass, the user can review and adjust individual milestones before final commit, and any interrupted batch session can be resumed from the last completed stage
**Depends on**: Phase 88
**Requirements**: RSYN-03, RSYN-04, RSYN-05, WKSP-05
**Success Criteria** (what must be TRUE):
  1. After all N roadmappers complete their proposals, the synthesizer writes ROADMAP.md, STATE.md, and REQUIREMENTS.md traceability to every milestone workspace with correct sequential phase numbers
  2. Root ROADMAP.md and root STATE.md are updated to include all N new milestone entries with their assigned phase ranges
  3. User is presented with a summary of all N milestone roadmaps and can approve the full set, adjust one milestone's proposal, or trigger a re-roadmap for one milestone — before any final commit
  4. Running `/gsd:multi-milestone --resume NN` loads BATCH-SESSION.md from task NN and continues from the last completed stage without repeating any prior work
**Plans**: TBD

Plans:
- [ ] 89-01: Parallel roadmapper spawning and synthesizer artifact writing
- [ ] 89-02: User approval loop and `--resume` flag implementation

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 87. Synthesizer Foundation | 1/1 | Complete   | 2026-04-04 |
| 88. Batch Workflow Stages 0-3 | 0/3 | Not started | - |
| 89. Synthesis, Review, and Resume | 0/2 | Not started | - |
