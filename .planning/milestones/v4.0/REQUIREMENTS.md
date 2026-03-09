# Requirements: GSD Enhanced Fork -- v4.0 Adaptive Learning Integration

**Defined:** 2026-03-07
**Core Value:** Claude writes code like a senior engineer who always checks the codebase first, always reads the docs, always writes tests, and never takes shortcuts -- enforced by the framework, not dependent on ad-hoc prompting.

## v4.0 Requirements

Requirements for adaptive learning integration. Each maps to roadmap phases.

### Installer

- [x] **INST-01**: Installer copies skills directory (`skills/*/SKILL.md`) to `~/.claude/skills/`
- [x] **INST-02**: Installer copies teams directory (`teams/*.json`) to `~/.claude/teams/`
- [x] **INST-03**: Installer copies all hook scripts to `~/.claude/hooks/` and registers in settings.json
- [x] **INST-04**: Installer creates CLAUDE.md using HTML comment markers (`<!-- GSD:BEGIN/END -->`) -- merges with existing user content, never overwrites
- [x] **INST-05**: Installer tracks user-deleted skills in manifest so updates don't re-add them
- [ ] **INST-06**: Installer creates `.planning/patterns/` directory with `.gitignore` entry *(gap closure: Phase 16.1)*

### Config

- [x] **CFG-01**: Skill-creator config merged into GSD `config.json` under `adaptive_learning` key
- [ ] **CFG-02**: Config migration detects standalone `skill-creator.json` and merges into `config.json` *(gap closure: Phase 16.1)*

### Skills

- [x] **SKILL-01**: All 16+ skills from skill-creator ship with GSD as auto-loading `SKILL.md` files
- [x] **SKILL-02**: Skills source files live in gsdup repo under a `skills/` directory

### Hooks

- [x] **HOOK-01**: Session hooks merged -- snapshot save/restore, work state save/restore, session-state injection
- [x] **HOOK-02**: Commit validation hook (`validate-commit.sh`) ships with GSD
- [x] **HOOK-03**: Phase boundary check hook ships with GSD
- [x] **HOOK-04**: Hook consolidation by event type -- no duplicate registrations in settings.json

### Agent Integration

- [x] **AGNT-01**: Skill-awareness content from executor extension merged inline into `gsd-executor.md`
- [x] **AGNT-02**: Capability inheritance content from planner extension merged inline into `gsd-planner.md`
- [x] **AGNT-03**: Extension marker system (`<!-- INJECT:BEGIN/END -->`) removed -- content is native

### Observation

- [x] **OBS-01**: Observation capture step baked into `plan-phase` workflow
- [x] **OBS-02**: Observation capture step baked into `execute-phase` workflow
- [x] **OBS-03**: Observation capture step baked into `verify-work` workflow
- [x] **OBS-04**: Observation capture step baked into `discuss-phase` workflow
- [x] **OBS-05**: Observation capture step baked into `quick` workflow
- [x] **OBS-06**: Observation capture step baked into `debug` workflow
- [x] **OBS-07**: Observation capture step baked into `fix-debt` workflow
- [x] **OBS-08**: Observations written to `.planning/patterns/sessions.jsonl` in structured format

### Commands

- [x] **CMD-01**: `/gsd:suggest` command -- analyzes accumulated observations and proposes skill improvements
- [x] **CMD-02**: `/gsd:digest` command -- generates learning summaries from session patterns
- [x] **CMD-03**: `/gsd:session-start` command -- session briefing with GSD position and recent activity
- [x] **CMD-04**: 13 standalone commands ported into GSD command set (beautiful-commits, code-review, dashboard, decision-framework, file-operation-patterns, context-handoff, gsd-preflight, gsd-onboard, gsd-trace, gsd-dashboard, typescript-patterns, api-design, env-setup)

### Dashboard

- [x] **DASH-01**: Dashboard TypeScript source (~80 files, ~15K LOC) copied into gsdup repo
- [x] **DASH-02**: Dashboard dependencies added to gsdup's package.json
- [x] **DASH-03**: Dashboard builds and runs successfully from gsdup
- [x] **DASH-04**: `/gsd:dashboard` command works (generate, watch, clean subcommands)

### Teams

- [x] **TEAM-01**: 4 team configs (code-review, doc-generation, gsd-debug, gsd-research) ship with GSD
- [x] **TEAM-02**: Team config agent IDs verified against canonical GSD agent filenames

### Deprecation

- [x] **DEPR-01**: Wrapper commands (`/wrap:*`) removed -- GSD commands are natively skill-aware
- [x] **DEPR-02**: `/sc:*` commands removed -- functionality absorbed into `/gsd:*` commands
- [ ] **DEPR-03**: Help text and docs updated to reflect integrated system *(gap closure: Phase 16.1)*
- [x] **DEPR-04**: gsd-skill-creator marked as deprecated with migration notice

## v5.0+ Requirements

Deferred to future release. Tracked but not in current roadmap.

### Dashboard Evolution

- **DASH-05**: Dashboard callable as global CLI tool (`gsd dashboard` from any project directory)
- **DASH-06**: Dashboard enhancements beyond current skill-creator functionality
- **DASH-07**: Dashboard serves as project-agnostic `.planning/` visualizer

### Observation Evolution

- **OBS-09**: Auto-apply approved skill suggestions without manual intervention
- **OBS-10**: Cross-project pattern detection from global observation data

## Out of Scope

| Feature | Reason |
|---------|--------|
| Plugin/extension system | Over-engineering -- direct integration is simpler and eliminates indirection bugs |
| Real-time observation (hook-level capture) | Hooks are too low-level; workflow commands have richer context |
| Core/optional skill tiering | User chose ship-all; tiering adds complexity for marginal benefit |
| Rewriting dashboard from scratch | 15K LOC already works -- copy and verify, enhance later |
| Multi-runtime skills/teams | Skills and teams are Claude Code-only features; other runtimes lack the directory conventions |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CFG-01 | Phase 12 | Complete |
| CFG-02 | Phase 12 → Phase 16.1 (gap closure) | Pending |
| SKILL-01 | Phase 12 | Complete |
| SKILL-02 | Phase 12 | Complete |
| TEAM-01 | Phase 12 | Complete |
| TEAM-02 | Phase 12 | Complete |
| INST-06 | Phase 12 → Phase 16.1 (gap closure) | Pending |
| INST-01 | Phase 13 | Complete |
| INST-02 | Phase 13 | Complete |
| INST-03 | Phase 13 | Complete |
| INST-04 | Phase 13 | Complete |
| INST-05 | Phase 13 | Complete |
| HOOK-01 | Phase 13 | Complete |
| HOOK-02 | Phase 13 | Complete |
| HOOK-03 | Phase 13 | Complete |
| HOOK-04 | Phase 13 | Complete |
| AGNT-01 | Phase 14 | Complete |
| AGNT-02 | Phase 14 | Complete |
| AGNT-03 | Phase 14 | Complete |
| DASH-01 | Phase 14 | Complete |
| DASH-02 | Phase 14 | Complete |
| DASH-03 | Phase 14 | Complete |
| DASH-04 | Phase 14 | Complete |
| OBS-01 | Phase 15 | Complete |
| OBS-02 | Phase 15 | Complete |
| OBS-03 | Phase 15 | Complete |
| OBS-04 | Phase 15 | Complete |
| OBS-05 | Phase 15 | Complete |
| OBS-06 | Phase 15 | Complete |
| OBS-07 | Phase 15 | Complete |
| OBS-08 | Phase 15 | Complete |
| CMD-01 | Phase 16 | Complete |
| CMD-02 | Phase 16 | Complete |
| CMD-03 | Phase 16 | Complete |
| CMD-04 | Phase 16 | Complete |
| DEPR-01 | Phase 16 | Complete |
| DEPR-02 | Phase 16 | Complete |
| DEPR-03 | Phase 16 → Phase 16.1 (gap closure) | Pending |
| DEPR-04 | Phase 16 | Complete |

**Coverage:**
- v4.0 requirements: 39 total
- Mapped to phases: 39
- Unmapped: 0
- Complete: 36
- Pending (gap closure): 3 (CFG-02, INST-06, DEPR-03 → Phase 16.1)

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-09 after milestone audit gap closure planning*
