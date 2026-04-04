# Requirements: v9.0 Signal Intelligence

**Defined:** 2026-04-03
**Core Value:** Claude writes code like a senior engineer who always checks the codebase first, always reads the docs, always writes tests, and never takes shortcuts — enforced by the framework, not dependent on ad-hoc prompting.

## v9.0 Requirements

Requirements for Signal Intelligence milestone. Each maps to roadmap phases.

### Debt Fix

- [x] **DEBT-01**: cmdStateUpdateProgress resolves phase directory via planningRoot() instead of hardcoded .planning/phases/
- [x] **DEBT-02**: cmdStateUpdateProgress resolves state path via planningRoot() for milestone-scoped projects
- [x] **DEBT-03**: Milestone-scoped progress tracking verified with test covering milestone workspace invocation

### Skill Tracking

- [x] **STRK-01**: Workflow observe steps populate skills_loaded with actual skill directory names from .claude/skills/
- [x] **STRK-02**: Gate execution entries include skills_active field listing skills loaded at gate fire time
- [x] **STRK-03**: Skill call data persists across sessions in sessions.jsonl for downstream analytics consumption

### Skill History

- [x] **SHST-01**: Skill refinement appends unified diff and rationale to SKILL-HISTORY.md in the skill directory
- [x] **SHST-02**: SKILL-HISTORY.md rotates at 50 entries with archive to SKILL-HISTORY-YYYY-MM.md
- [x] **SHST-03**: .gitattributes configured with merge=union for SKILL-HISTORY.md files

### Benchmarking

- [x] **BNCH-01**: Plan completion writes execution metrics (correction count, gate fire count, quality level) to phase-benchmarks.jsonl
- [x] **BNCH-02**: Benchmark entries segmented by phase type and quality level before aggregation
- [x] **BNCH-03**: /gsd:digest surfaces recent plan benchmark trends with N >= 5 minimum sample guard

### Debt Impact

- [x] **DIMP-01**: debt impact CLI subcommand joins DEBT.md entries with corrections.jsonl by component-to-category mapping
- [x] **DIMP-02**: Debt entries ranked by associated correction count with link_confidence field (high/medium/low)
- [x] **DIMP-03**: /gsd:fix-debt surfaces correction-linked impact data when selecting debt items to resolve

### Session Report

- [x] **SRPT-01**: /gsd:session-report command surfaces per-session correction density, gate fire count, and skills loaded
- [x] **SRPT-02**: Session report reads sessions.jsonl via Node.js pre-processing (not raw inline), with --last N flag
- [x] **SRPT-03**: Session report includes plan performance trends from phase-benchmarks.jsonl when available

### Skill Quality

- [x] **SQLQ-01**: Per-skill correction rate computed using CATEGORY_SKILL_MAP attribution (not raw co-presence)
- [x] **SQLQ-02**: Skill metrics stored in .planning/patterns/skill-metrics.json with attribution_confidence field
- [x] **SQLQ-03**: /gsd:digest surfaces per-skill correction rates with absolute counts alongside rates

### Skill Relevance

- [x] **SREL-01**: Skill relevance scored against task description using keyword overlap at session start
- [x] **SREL-02**: Score floor of 0.3 for skills under 14 days old to prevent cold-start exclusion
- [x] **SREL-03**: Decay factor of 10% per week applied to dormant skills not loaded in recent sessions
- [x] **SREL-04**: Score cache invalidated on SKILL.md content change via content hash comparison

## Future Requirements

### v10.0 Candidates

- **ESLint MCP gate integration** — deterministic static analysis gate via MCP server
- **Cross-project pattern synthesis** — aggregate corrections across multiple projects for global preference promotion
- **MCP server selection intelligence** — task-type-aware MCP server recommendations
- **Multi-project tmux/web dashboard** — unified cross-project view with live gate status
- **Pre-computed session summary cache** — session-summary.json refreshed by SessionEnd hook for faster reports

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-apply skill relevance scores to skip loading | Scores are advisory; automated exclusion risks dropping needed skills |
| Benchmark-driven automated routing | Goodhart's Law — metrics that drive decisions become gaming targets |
| Real-time skill performance dashboards | File-based architecture; dashboard updates at natural checkpoints only |
| ML/model training from correction data | Out of scope for prompt-engineering framework |
| Database-backed analytics stores | JSONL + JSON aligns with GSD file-based philosophy |
| Modifying DEBT.md automatically from impact analysis | DEBT.md is human-curated; analysis is read-only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEBT-01 | Phase 37 | Complete |
| DEBT-02 | Phase 37 | Complete |
| DEBT-03 | Phase 37 | Complete |
| STRK-01 | Phase 38 | Complete |
| STRK-02 | Phase 38 | Complete |
| STRK-03 | Phase 38 | Complete |
| SHST-01 | Phase 39 | Complete |
| SHST-02 | Phase 39 | Complete |
| SHST-03 | Phase 39 | Complete |
| BNCH-01 | Phase 39 | Complete |
| BNCH-02 | Phase 39 | Complete |
| BNCH-03 | Phase 39 | Complete |
| DIMP-01 | Phase 39 | Complete |
| DIMP-02 | Phase 39 | Complete |
| DIMP-03 | Phase 39 | Complete |
| SRPT-01 | Phase 40 | Complete |
| SRPT-02 | Phase 40 | Complete |
| SRPT-03 | Phase 40 | Complete |
| SQLQ-01 | Phase 41 | Complete |
| SQLQ-02 | Phase 41 | Complete |
| SQLQ-03 | Phase 41 | Complete |
| SREL-01 | Phase 42 | Complete |
| SREL-02 | Phase 42 | Complete |
| SREL-03 | Phase 42 | Complete |
| SREL-04 | Phase 42 | Complete |

**Coverage:**
- v9.0 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-03*
*Last updated: 2026-04-03 after roadmap creation*
