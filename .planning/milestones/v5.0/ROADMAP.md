# Roadmap -- Milestone v5.0: Device-Wide Dashboard

*Created: 2026-03-07*

## Overview

Transform GSD from a single-project CLI tool into a device-wide multi-project command center. A localhost dashboard server aggregates planning data from all registered GSD projects, displays live status with SSE refresh, monitors tmux sessions, and provides embedded interactive terminals and cross-project pattern analysis.

## Phases

**Phase Numbering:**
- Integer phases (17, 18, 19, ...): Planned milestone work
- Decimal phases (17.1, 17.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 17: Project Registry** - CLI commands and persistent storage for managing registered GSD projects
- [x] **Phase 18: Data Aggregation and Server** - File watchers, data collectors, HTTP server, and SSE live refresh
- [x] **Phase 19: Dashboard UI** - Multi-project overview page and per-project drill-down (completed 2026-03-09)
- [x] **Phase 20: Tmux Monitoring and Cross-Project Metrics** - Session detection, metadata cards, health scoring, and aggregated metrics (completed 2026-03-09)
- [ ] **Phase 21: Embedded Terminals and Pattern System** - Interactive xterm.js terminals and cross-project pattern analysis

## Phase Details

### Phase 17: Project Registry
**Goal**: Users can register, remove, and list GSD projects from any terminal
**Depends on**: Nothing (first phase)
**Requirements**: REG-01, REG-02, REG-03, REG-04, REG-05
**Success Criteria** (what must be TRUE):
  1. User can run `gsd dashboard add <path>` and the project appears in subsequent `gsd dashboard list` output
  2. User can run `gsd dashboard remove <name>` and the project no longer appears in list output
  3. Project name is auto-detected from `.planning/PROJECT.md` without the user specifying it
  4. Registry survives process restarts (persisted to `~/.gsd/dashboard.json`)
**Plans**: TBD

### Phase 18: Data Aggregation and Server
**Goal**: A running localhost server streams live project data to connected clients
**Depends on**: Phase 17
**Requirements**: SRV-01, SRV-02, SRV-03, SRV-04
**Success Criteria** (what must be TRUE):
  1. User can run `gsd dashboard serve` and a server starts on localhost (configurable port via `--port`)
  2. Modifying a `.planning/` file in any registered project triggers an SSE event within 1 second
  3. Multiple browser tabs receive updates through a single multiplexed SSE connection per client
  4. Server watches `.planning/` directories of all registered projects and detects file changes
**Plans**: TBD

### Phase 19: Dashboard UI
**Goal**: Users can view all their GSD projects at a glance and drill into any project for full detail
**Depends on**: Phase 18
**Requirements**: UI-01, UI-02
**Success Criteria** (what must be TRUE):
  1. Opening the dashboard URL shows a card grid with every registered project's name, current milestone, active phase, and progress percentage
  2. Clicking a project card opens a detail view showing that project's requirements, roadmap, milestones, and state
  3. Dashboard updates in real-time without manual page refresh when project data changes
**Plans**: TBD

### Phase 20: Tmux Monitoring and Cross-Project Metrics
**Goal**: Users can see tmux session activity and comparative health metrics across all projects
**Depends on**: Phase 19
**Requirements**: TERM-01, TERM-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. Each project card shows tmux session count and active/idle status indicators
  2. Hovering or expanding a project shows session metadata (session name, window count, pane count, idle duration)
  3. Dashboard displays cross-project aggregated metrics (velocity, commit feed, quality scores)
  4. Each project shows a computed health score reflecting stale phases, blocked milestones, and debt count
**Plans**: TBD

### Phase 21: Embedded Terminals and Pattern System
**Goal**: Users can interact with live tmux sessions from the browser and analyze patterns across all projects
**Depends on**: Phase 20
**Requirements**: TERM-03, PAT-01, PAT-02, PAT-03, PAT-04
**Success Criteria** (what must be TRUE):
  1. User can click a tmux session card to open an interactive terminal in the browser (xterm.js with WebSocket)
  2. Terminal sessions support full interactive use (typing, escape sequences, resize)
  3. Running `/gsd:digest` or `/gsd:suggest` pulls and analyzes patterns from ALL registered projects, not just the current one
  4. A pattern dashboard page shows cross-project pattern data (frequency, recency, project spread)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 17 -> 17.x -> 18 -> 18.x -> 19 -> 20 -> 21

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 17. Project Registry | 2/2 | Complete | 2026-03-09 |
| 18. Data Aggregation and Server | 2/2 | Complete    | 2026-03-09 |
| 19. Dashboard UI | 4/4 | Complete    | 2026-03-09 |
| 20. Tmux Monitoring and Metrics | 6/6 | Complete   | 2026-03-09 |
| 21. Embedded Terminals and Patterns | 0/? | Not started | - |
