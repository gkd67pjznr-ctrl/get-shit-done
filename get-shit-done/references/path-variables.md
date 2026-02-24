# Path Variable Glossary

Reference for all path-related variables returned by gsd-tools.cjs init commands.

## Variables from init JSON

| Variable | Source | Legacy Value | Milestone-Scoped Value |
|----------|--------|-------------|------------------------|
| `planning_root` | init JSON | `.planning/` (absolute) | `.planning/milestones/v2.0/` (absolute) |
| `layout_style` | init JSON | `"legacy"` | `"milestone-scoped"` |
| `milestone_scope` | init JSON | `null` | `"v2.0"` |
| `milestone_version` | init JSON | `"v1.0"` (from ROADMAP) | `"v2.0"` (explicit) |
| `state_path` | init JSON | `.planning/STATE.md` | `.planning/milestones/v2.0/STATE.md` |
| `roadmap_path` | init JSON | `.planning/ROADMAP.md` | `.planning/milestones/v2.0/ROADMAP.md` |
| `requirements_path` | init JSON | `.planning/REQUIREMENTS.md` | `.planning/milestones/v2.0/REQUIREMENTS.md` |
| `phase_dir` | init JSON | `.planning/phases/01-name` | `.planning/milestones/v2.0/phases/01-name` |
| `config_path` | init JSON | `.planning/config.json` | `.planning/config.json` (always global) |

## Core Resolver: planningRoot()

All path resolution flows through a single function in `core.cjs`:

```javascript
function planningRoot(cwd, milestoneScope) {
  const base = path.join(cwd, '.planning');
  if (milestoneScope) {
    return path.join(base, 'milestones', milestoneScope);
  }
  return base;
}
```

Rules:
- `milestoneScope` uses truthiness — `null`, `undefined`, and `""` all return the legacy `.planning/` path
- Never use string literals like `path.join(cwd, '.planning', 'STATE.md')` in lib functions — always call `planningRoot()`
- `config.json` is always global (never passed through planningRoot)

## Commands That Return milestone Fields

All of these commands return `milestone_scope`, `planning_root`, and `layout_style` when called with `--milestone`:

| Command | Function | milestoneScope Added |
|---------|----------|----------------------|
| `init execute-phase` | `cmdInitExecutePhase` | v2.0 (Phase 8) |
| `init plan-phase` | `cmdInitPlanPhase` | v2.0 (Phase 8) |
| `init resume` | `cmdInitResume` | v2.0 (Phase 12) |
| `init verify-work` | `cmdInitVerifyWork` | v2.0 (Phase 12) |
| `init phase-op` | `cmdInitPhaseOp` | v2.0 (Phase 12) |
| `init milestone-op` | `cmdInitMilestoneOp` | v2.0 (Phase 12) |
| `init progress` | `cmdInitProgress` | v2.0 (Phase 12) |
| `phase complete` | `cmdPhaseComplete` | v2.0 (Phase 12) |

Commands NOT receiving milestoneScope (project-level, not milestone-level):
- `init new-project` — creates the project, has no milestone context
- `init new-milestone` — creates the milestone workspace itself
- `init quick` — quick tasks live at project root
- `init todos` — todos are project-wide
- `init map-codebase` — codebase maps are project-wide

## Conventions

### PHASE-01: Phase Numbering Reset

Phase numbering resets to 01 per milestone. Each milestone workspace has its own
`phases/` directory, so phase numbers are naturally scoped. There is no code enforcement
needed — it is an emergent property of workspace isolation via `planningRoot()`.

Example:
- `v1.0` milestone: phases 01–11
- `v2.0` milestone: phases 01–N (independent sequence)

### PHASE-02: Cross-Milestone Phase References

When referencing a phase across milestones, use the qualified format:
- `v2.0/phase-01` (not just `phase-01`)
- `v1.0/phase-03` for historical phases

This is a naming convention for humans and AI agents, not enforced by code.

## Global vs Milestone-Scoped Files

| File | Scope | Notes |
|------|-------|-------|
| `config.json` | Global (`.planning/`) | Never milestone-scoped; contains `concurrent: true` sentinel |
| `PROJECT.md` | Global (`.planning/`) | Shared across all milestones |
| `MILESTONES.md` | Global (`.planning/`) | Live dashboard aggregating all milestone status |
| `STATE.md` | Per-milestone | Each workspace has its own project state |
| `ROADMAP.md` | Per-milestone | Phase plan and progress scoped to milestone |
| `REQUIREMENTS.md` | Per-milestone | Requirements scoped to milestone |
| `phases/` | Per-milestone | Phase directories scoped to milestone workspace |

## Passing --milestone in CLI

The `--milestone` flag is parsed before command routing in `gsd-tools.cjs`:

```bash
# Space form
node gsd-tools.cjs --milestone v2.0 init phase-op 1 --raw

# Equals form
node gsd-tools.cjs --milestone=v2.0 init phase-op 1 --raw
```

The parsed value is stored as `milestoneScope` and threaded as the **last parameter** to all
milestone-aware lib functions. Existing callers that omit the parameter receive `undefined`,
which `planningRoot()` treats as null and returns the legacy `.planning/` path.
