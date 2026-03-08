# Roadmap: GSD v4.0 Adaptive Learning Integration

## Overview

Merge gsd-skill-creator into GSD core in 5 phases: establish source file structure and config, expand the installer to deliver all new content, integrate agents and dashboard, bake observation capture into every workflow command, then add new commands and deprecate the standalone package. Each phase delivers a coherent, verifiable capability that unblocks the next.

## Phases

**Phase Numbering:**
- Integer phases (12-16): Planned milestone work (continuing from v3.1 Phase 11)
- Decimal phases (e.g., 13.1): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 12: Foundation** - Config merge, skills source directory, teams source directory, patterns directory
- [x] **Phase 13: Installer and Content Delivery** - Installer copies skills/teams/hooks, CLAUDE.md merge, manifest tracking (completed 2026-03-08)
- [ ] **Phase 14: Agent Merge and Dashboard** - Agent inline integration, dashboard copy-and-verify
- [ ] **Phase 15: Native Observation** - Observation capture baked into all 7 GSD workflow commands
- [ ] **Phase 16: Commands and Deprecation** - New commands, wrapper removal, standalone package deprecation

## Phase Details

### Phase 12: Foundation
**Goal**: All source material exists in the gsdup repo and config is unified -- skills, teams, patterns directory, and adaptive_learning config are in place before any installer or integration work begins
**Depends on**: Nothing (first phase of v4.0)
**Requirements**: CFG-01, CFG-02, SKILL-01, SKILL-02, TEAM-01, TEAM-02, INST-06
**Success Criteria** (what must be TRUE):
  1. `config.json` contains an `adaptive_learning` key with observation, suggestion, and skill settings -- no separate `skill-creator.json` exists
  2. Running config migration on a project with standalone `skill-creator.json` produces a merged `config.json` and removes the standalone file
  3. All 16+ skill SKILL.md files exist under a `skills/` directory in the gsdup repo
  4. 4 team configs exist under a `teams/` directory in the gsdup repo with agent IDs matching canonical GSD agent filenames
  5. `.planning/patterns/` directory is created with a `.gitignore` entry preventing pattern data from being committed
**Plans**: TBD

### Phase 13: Installer and Content Delivery
**Goal**: A single `install.js` run delivers skills, teams, hooks, and CLAUDE.md to the user's project -- no separate skill-creator install step needed
**Depends on**: Phase 12
**Requirements**: INST-01, INST-02, INST-03, INST-04, INST-05, HOOK-01, HOOK-02, HOOK-03, HOOK-04
**Success Criteria** (what must be TRUE):
  1. Running the installer copies all skills to `~/.claude/skills/` and all teams to `~/.claude/teams/`
  2. Running the installer registers all hooks in `settings.json` with no duplicate entries -- consolidated by event type
  3. Running the installer creates or updates CLAUDE.md using marker-based merge (`<!-- GSD:BEGIN/END -->`) without destroying user content outside the markers
  4. If a user deletes a skill directory, subsequent installs do not re-add it (manifest tracking)
  5. All session hooks (snapshot, work state, session-state) and validation hooks (commit, phase boundary) are installed and functional
**Plans**:
  - [x] Plan 13-01: Test scaffold + skills/teams delivery (INST-01, INST-02, INST-05 foundation)
  - [x] Plan 13-02: Hooks registration in settings.json (INST-03, HOOK-01, HOOK-02, HOOK-03, HOOK-04)
  - [x] Plan 13-03: CLAUDE.md marker-based merge (INST-04)

### Phase 14: Agent Merge and Dashboard
**Goal**: Agent files contain skill-awareness natively (no extension markers) and the dashboard builds and runs from the gsdup repo
**Depends on**: Phase 12
**Requirements**: AGNT-01, AGNT-02, AGNT-03, DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. `gsd-executor.md` contains skill-awareness instructions inline -- no `<!-- INJECT:BEGIN/END -->` markers, no separate extension fragment
  2. `gsd-planner.md` contains capability inheritance instructions inline -- no extension markers
  3. Dashboard TypeScript source exists in the gsdup repo, builds successfully, and `/gsd:dashboard` command works (generate, watch, clean)
  4. No references to the marker/extension injection system remain in any agent or installer file
**Plans**: TBD

### Phase 15: Native Observation
**Goal**: Every GSD workflow command captures observations natively -- no wrapper commands needed, observations accumulate in structured format for analysis
**Depends on**: Phase 13, Phase 14
**Requirements**: OBS-01, OBS-02, OBS-03, OBS-04, OBS-05, OBS-06, OBS-07, OBS-08
**Success Criteria** (what must be TRUE):
  1. Running any of the 7 workflow commands (plan-phase, execute-phase, verify-work, discuss-phase, quick, debug, fix-debt) produces an observation entry in `.planning/patterns/sessions.jsonl`
  2. Observation entries contain structured fields (timestamp, command, phase, outcome type) -- not freeform text
  3. Observation capture degrades gracefully (missing patterns directory or write failure does not block the workflow command from completing)
  4. No `/wrap:*` wrapper commands are needed -- GSD commands are self-contained with observation built in
**Plans**: TBD

### Phase 16: Commands and Deprecation
**Goal**: New analysis commands are available, all standalone wrapper/sc commands are removed, and gsd-skill-creator is marked deprecated
**Depends on**: Phase 15
**Requirements**: CMD-01, CMD-02, CMD-03, CMD-04, DEPR-01, DEPR-02, DEPR-03, DEPR-04
**Success Criteria** (what must be TRUE):
  1. `/gsd:suggest` analyzes accumulated observations and proposes skill improvements
  2. `/gsd:digest` generates learning summaries from session pattern data
  3. `/gsd:session-start` provides a briefing with GSD position and recent activity
  4. All 13 standalone commands are available as `/gsd:*` commands
  5. No `/wrap:*` or `/sc:*` commands exist -- help text and docs reflect the integrated system
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 12 -> 13 -> 14 -> 15 -> 16

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 12. Foundation | 3/4 | Complete    | 2026-03-08 |
| 13. Installer and Content Delivery | 2/3 | Complete    | 2026-03-08 |
| 14. Agent Merge and Dashboard | 0/? | Not started | - |
| 15. Native Observation | 0/? | Not started | - |
| 16. Commands and Deprecation | 0/? | Not started | - |
