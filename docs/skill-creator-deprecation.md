# gsd-skill-creator Deprecation Notice

**Status:** Deprecated as of GSD v4.0
**Date:** 2026-03-09
**Replacement:** GSD core (this repository)

## What Changed

The `gsd-skill-creator` standalone package has been merged into GSD core as of v4.0.
All skill-creator functionality is now available natively through GSD without any
separate installation step.

## Migration Guide

### Before (standalone skill-creator)

```bash
# Separate install
npm install -g gsd-skill-creator

# Separate commands
npx skill-creator install
/sc:suggest
/sc:digest
/sc:start
/sc:observe
/sc:status
/sc:wrap execute -- /gsd:execute-phase 12
```

### After (GSD v4.0 integrated)

```bash
# Single install (GSD handles everything)
node project-claude/install.cjs

# Commands now in /gsd: namespace
/gsd:suggest       # was /sc:suggest
/gsd:digest        # was /sc:digest
/gsd:session-start # was /sc:start

# Observation is automatic -- no /sc:observe or /sc:wrap needed
# GSD workflow commands (plan-phase, execute-phase, etc.) capture observations natively
```

### Config Migration

The standalone `skill-creator.json` config file is no longer used. Settings have moved
to `.planning/config.json` under the `adaptive_learning` key.

```json
// Old: .planning/skill-creator.json
{
  "observation": { "retention_days": 30 },
  "suggestions": { "min_occurrences": 3 }
}

// New: .planning/config.json
{
  "adaptive_learning": {
    "observation": { "retention_days": 30 },
    "suggestions": { "min_occurrences": 3 }
  }
}
```

Run `/gsd:migrate` to automatically merge any existing `skill-creator.json` into `config.json`.

## What Was Removed

| Removed | Reason |
|---------|--------|
| `/sc:observe` | Phase 15 baked native observation into all 7 GSD workflow commands |
| `/sc:status` | Skill budget info is now in `/gsd:session-start` |
| `/sc:wrap` | Wrapper concept deprecated -- GSD commands are natively skill-aware |
| `/wrap:*` commands | Native observation in GSD workflows makes wrappers redundant |
| `wrapper_commands` config toggle | No wrappers remain; toggle had no effect |
| `skill-creator.json` config file | Config merged into `config.json` under `adaptive_learning` key |

## Skills and Teams

Skills and teams that were installed by `gsd-skill-creator` are now shipped directly with GSD
and installed by `node project-claude/install.cjs`. No action is required -- re-running the
GSD installer will deliver the same skills to `~/.claude/skills/`.

## Data Compatibility

Session observation data in `.planning/patterns/sessions.jsonl` is forward-compatible.
Existing JSONL entries continue to work with `/gsd:digest` and `/gsd:session-start`.

Pattern data in `.planning/patterns/suggestions.json` is also forward-compatible.
Run `/gsd:suggest` to review any existing pending suggestions.

## Support

For migration questions, see the [GSD documentation](../docs/) or open an issue.
