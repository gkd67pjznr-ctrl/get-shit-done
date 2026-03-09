---
phase: 16
plan: "02"
status: complete
completed_at: "2026-03-09T10:45:00.000Z"
requirements_met:
  - DEPR-01
  - DEPR-02
  - DEPR-03
  - DEPR-04
---

# Plan 16-02 Summary -- Deprecation Cleanup

## What Was Built

Removed all deprecated standalone skill-creator artifacts from the repository and updated skill files and configuration to reflect the integrated GSD v4.0 system.

## Tasks Completed

### Task 16-02-01: Delete wrap/ and sc/ command directories
- Deleted `.claude/commands/wrap/` (4 files: execute.md, verify.md, plan.md, phase.md)
- Deleted `.claude/commands/sc/` (6 files: suggest.md, digest.md, start.md, observe.md, status.md, wrap.md)
- Both directories confirmed absent

### Task 16-02-02: Delete 13 standalone source files from .claude/commands/
- Confirmed all 13 targets exist in `commands/gsd/` before deletion
- Deleted all 13 standalone files (api-design.md, beautiful-commits.md, code-review.md, context-handoff.md, decision-framework.md, env-setup.md, file-operation-patterns.md, gsd-dashboard.md, gsd-onboard.md, gsd-preflight.md, gsd-trace.md, test-generator.md, typescript-patterns.md)
- `.claude/commands/` is now empty

### Task 16-02-03: Update skill files -- remove skill-creator references
Updated 7 files:
- `skills/skill-integration/SKILL.md`: Updated description, paths (.claude/commands/ -> .claude/skills/), removed "skill-creator has captured" sentence, updated suggestion notification text, renamed "When to Suggest skill-creator" -> "When to Suggest Skill Creation"
- `skills/skill-integration/references/bounded-guardrails.md`: Changed "skill-creator source" -> "GSD adaptive learning system"
- `skills/session-awareness/SKILL.md`: Renamed "skill-creator Artifacts" -> "Adaptive Learning Artifacts", updated paths
- `skills/security-hygiene/SKILL.md`: Changed "skill-creator security" -> "GSD adaptive learning security"
- `skills/gsd-workflow/SKILL.md`: Renamed "When to Suggest skill-creator" -> "When to Suggest Skill Creation", updated .claude/commands/ -> .claude/skills/ paths
- `skills/gsd-workflow/references/command-routing.md`: Renamed "skill-creator Actions" -> "Adaptive Learning Actions", updated /sc:* -> /gsd:* command mappings
- `skills/gsd-workflow/references/yolo-mode.md`: Removed "throwing away everything skill-creator has captured" sentence

### Task 16-02-04: Remove wrapper_commands from config schema and types
- `src/integration/config/schema.ts`: Removed `wrapper_commands: z.boolean().default(true)` from IntegrationTogglesSchema and default factory
- `src/integration/config/types.ts`: Removed `wrapper_commands: boolean` field from IntegrationToggles interface, updated header comment
- `tests/foundation.test.cjs`: Removed `wrapper_commands: true` from SC_SCHEMA in CFG-02 test
- `.planning/config.json`: Removed `"wrapper_commands": true` from adaptive_learning.integration block

### Task 16-02-05: Create deprecation notice document
- Created `docs/skill-creator-deprecation.md` with:
  - Status, date, and replacement info
  - Full before/after migration guide (/sc:* -> /gsd:* commands)
  - Config migration instructions (skill-creator.json -> config.json)
  - Table of removed features and reasons
  - Data compatibility notes

### Task 16-02-06: Run full test verification
- `node --test tests/commands-deprecation.test.cjs`: 43/43 tests pass
- `npm test`: 903/904 pass (1 pre-existing config-get failure, unchanged from before this phase)

## Deviations

**DASH-04 test path update**: The DASH-04 test in `tests/dashboard-integration.test.cjs` was checking `.claude/commands/gsd-dashboard.md` which was deleted as part of Task 16-02-02. Updated the test to check `commands/gsd/dashboard.md` (the new canonical location established in Plan 16-01). This was a required fix -- not a plan deviation per se -- since the plan requires `npm test` to pass.

## Commit

`37b0c03` feat(depr-16): remove wrap/sc commands, clean skill references, deprecate standalone package

## Requirements Verification

- DEPR-01: `.claude/commands/wrap/` does not exist -- PASS
- DEPR-02: `.claude/commands/sc/` does not exist -- PASS
- DEPR-03: No `skill-creator.json` references in skill files; `wrapper_commands` removed from schema.ts -- PASS
- DEPR-04: `docs/skill-creator-deprecation.md` exists with migration guide -- PASS
