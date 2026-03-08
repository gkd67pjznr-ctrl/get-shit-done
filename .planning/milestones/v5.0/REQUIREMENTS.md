# Requirements: GSD Enhanced Fork -- v5.0 Device-Wide Dashboard

**Defined:** 2026-03-07
**Core Value:** Claude writes code like a senior engineer who always checks the codebase first, always reads the docs, always writes tests, and never takes shortcuts -- enforced by the framework, not dependent on ad-hoc prompting.

## v5.0 Requirements

Requirements for the device-wide multi-project dashboard. Each maps to roadmap phases.

### Registry

- [ ] **REG-01**: User can register a project via `gsd dashboard add <path>`
- [ ] **REG-02**: User can remove a project via `gsd dashboard remove <name>`
- [ ] **REG-03**: User can list registered projects via `gsd dashboard list`
- [ ] **REG-04**: Project name auto-detected from `.planning/PROJECT.md` on add
- [ ] **REG-05**: Registry persisted in `~/.gsd/dashboard.json`

### Server

- [ ] **SRV-01**: Global dashboard server via `gsd dashboard serve` on localhost
- [ ] **SRV-02**: SSE live refresh with multiplexed single stream for all projects
- [ ] **SRV-03**: File watchers on `.planning/` directories of all registered projects
- [ ] **SRV-04**: Configurable port via `--port` flag with default stored in config

### Dashboard UI

- [ ] **UI-01**: Multi-project overview page with status cards per project (milestone, phase, progress)
- [ ] **UI-02**: Project drill-down with full per-project dashboard (requirements, roadmap, milestones, state)
- [ ] **UI-03**: Cross-project metrics aggregation (velocity, commit feeds, quality scores)
- [ ] **UI-04**: Computed health score per project (stale phases, blocked milestones, debt count)

### Terminal

- [ ] **TERM-01**: Tmux session detection per registered project (session count, active/idle, last activity)
- [ ] **TERM-02**: Session metadata cards in overview (session name, window count, pane count, idle duration)
- [ ] **TERM-03**: Embedded interactive xterm.js terminal via WebSocket-to-tmux bridge (click-to-expand)

### Cross-Project Patterns

- [ ] **PAT-01**: Global pattern aggregation -- collect `sessions.jsonl` from all registered projects
- [ ] **PAT-02**: `/gsd:digest` pulls patterns from ALL registered projects
- [ ] **PAT-03**: `/gsd:suggest` analyzes patterns across ALL registered projects
- [ ] **PAT-04**: Pattern dashboard page visualizing cross-project patterns (frequency, recency, project spread)

## v6.0+ Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Terminal

- **TERM-04**: Pane content snapshots for read-only preview without full terminal embed
- **TERM-05**: Terminal session recording and playback
- **TERM-06**: Launch new tmux sessions from the dashboard UI

### Discovery

- **DISC-01**: Auto-discover GSD projects by scanning configured directories
- **DISC-02**: Project archiving (hide completed/inactive projects from overview)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cloud sync / remote access | Local-first CLI tool -- complexity explosion, security implications |
| Cross-project dependency tracking | Not a project management tool -- GSD tracks individual project lifecycle |
| Custom dashboard layouts / widgets | Over-engineering -- fixed layout with good defaults is simpler |
| Push notifications (desktop/email) | Browser dashboard is pull-based; notifications add daemon complexity |
| Multi-user / auth | Single-user dev tool running on localhost |
| Plugin/extension system | Direct implementation is simpler -- no extension API surface to maintain |
| AI-powered insights | Pattern system already covers this; no separate AI layer needed |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| REG-01 | Phase 17 | Pending |
| REG-02 | Phase 17 | Pending |
| REG-03 | Phase 17 | Pending |
| REG-04 | Phase 17 | Pending |
| REG-05 | Phase 17 | Pending |
| SRV-01 | Phase 18 | Pending |
| SRV-02 | Phase 18 | Pending |
| SRV-03 | Phase 18 | Pending |
| SRV-04 | Phase 18 | Pending |
| UI-01 | Phase 19 | Pending |
| UI-02 | Phase 19 | Pending |
| UI-03 | Phase 20 | Pending |
| UI-04 | Phase 20 | Pending |
| TERM-01 | Phase 20 | Pending |
| TERM-02 | Phase 20 | Pending |
| TERM-03 | Phase 21 | Pending |
| PAT-01 | Phase 21 | Pending |
| PAT-02 | Phase 21 | Pending |
| PAT-03 | Phase 21 | Pending |
| PAT-04 | Phase 21 | Pending |

**Coverage:**
- v5.0 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after roadmap creation*
