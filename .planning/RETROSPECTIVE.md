# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.1 — Quality UX

**Shipped:** 2026-02-24
**Phases:** 3 | **Plans:** 5 | **Sessions:** ~2

### What Was Built
- Config auto-migration and global defaults system (~/.gsd/defaults.json)
- /gsd:set-quality command with per-project and --global scope
- Quality gate outcome tracking (GATE_OUTCOMES) in executor sentinel
- Quality Gates section in SUMMARY.md templates for standard/strict modes
- Config validation warnings on missing sections
- Context7 configurable token cap
- Progress and help UX improvements (quality level display, patches reminder)

### What Worked
- TDD pattern (RED/GREEN) caught real bugs during implementation (spawnSync vs execSync, cmdConfigGet vs loadConfig path)
- Phase dependency chain worked well — Phase 5 foundation → Phase 6 commands → Phase 7 observability built cleanly on each other
- 100% of auto-fixed deviations were genuine bugs in plans, not scope creep — deviation system working as intended
- All 9 requirements mapped cleanly to 3 phases with zero unmapped requirements

### What Was Inefficient
- ROADMAP.md progress table had inconsistent milestone column formatting for v1.1 phases (missing v1.1 label on phases 5-6)
- Plan generation sometimes suggested loadConfig for quality.level reads, but loadConfig doesn't expose the quality section — this bug surfaced twice across Phase 6

### Patterns Established
- GSD_HOME env var for test isolation of global state
- requiredQualityDefaults single source of truth for config defaults
- Runtime config reads (bash one-liner with fallback) for values that should reflect live changes
- Gate outcome vocabulary: passed/warned/skipped/blocked with clear per-level semantics
- New GSD command = pair of files: commands/gsd/X.md (entry) + workflows/X.md (logic)

### Key Lessons
1. When a library function (loadConfig) returns a subset of config, don't assume it returns everything — read directly when you need fields it doesn't expose
2. spawnSync > execSync when you need stderr on exit code 0 — this is a Node.js gotcha worth remembering
3. Guard variables (GATE_OUTCOMES_INITIALIZED) prevent state reset in loops — useful pattern for per-plan-not-per-task initialization

### Cost Observations
- Model mix: ~80% sonnet (executor), ~15% haiku (plan-checker), ~5% opus (orchestration)
- Sessions: ~2
- Notable: 5 plans in ~26 min total execution time; config/UX work slightly slower than pure agent-file modifications

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 MVP | ~3 | 4 | Established quality sentinel, TDD pattern |
| v1.1 Quality UX | ~2 | 3 | Added user-facing config/observability layer |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 102 | N/A | 8 (agents, config, tests) |
| v1.1 | 129+ | N/A | 13 (commands, workflows, templates) |

### Top Lessons (Verified Across Milestones)

1. TDD catches real integration bugs that reading code alone would miss — verified in both v1.0 (test baseline) and v1.1 (spawnSync, loadConfig)
2. Config-driven behavior gating (fast/standard/strict) keeps changes additive — verified across both milestones with zero behavioral change in fast mode
