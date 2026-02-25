---
phase: quick
plan: 1
subsystem: install
tags: [install, deploy, gsd, tooling]
dependency_graph:
  requires: []
  provides: [GSD v1.20.6 installed at ~/.claude/]
  affects: [~/.claude/get-shit-done/, ~/.claude/commands/gsd/, ~/.claude/agents/, ~/.claude/hooks/]
tech_stack:
  added: []
  patterns: [npm install -g, custom installer bin/install.js with path replacement]
key_files:
  created: []
  modified:
    - ~/.claude/get-shit-done/ (all files updated)
    - ~/.claude/commands/gsd/ (all commands updated)
    - ~/.claude/agents/ (all agents updated)
    - ~/.claude/hooks/ (hooks updated)
    - ~/.claude/get-shit-done/VERSION (1.20.6)
decisions:
  - Built hooks/dist/ manually via `node scripts/build-hooks.js` because `npm install -g .` does not trigger prepublishOnly lifecycle hook
metrics:
  duration: 71s
  completed: 2026-02-25T09:53:54Z
  tasks_completed: 2
  files_changed: 0
---

# Quick Task 1: Install GSD Modifications for Local Test — Summary

**One-liner:** Deployed GSD v1.20.6 dev modifications to global ~/.claude/ install including commands, workflows, templates, agents, and hooks.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Build hooks and install package globally | (no code changes — install to ~/.claude/) | ~/.claude/get-shit-done/*, ~/.claude/commands/gsd/*, ~/.claude/agents/*, ~/.claude/hooks/* |
| 2 | Verify all modifications are deployed | (no code changes — verification only) | — |

## Verification Results

All verification checks passed:

- `get-shit-done-cc --help` runs successfully
- `~/.claude/get-shit-done/VERSION` = `1.20.6` (matches package.json)
- Workflows: MATCH (dev vs installed)
- Templates: MATCH (dev vs installed)
- Bin: MATCH (dev vs installed)
- Commands: MATCH (dev vs installed)
- Agents: MATCH (dev vs installed)
- Content spot-check (execute-phase.md): content matches, path replacements applied correctly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Built hooks/dist/ manually before second install run**
- **Found during:** Task 1
- **Issue:** `npm install -g .` does not trigger the `prepublishOnly` lifecycle hook (which runs `build:hooks`) when installing from a local directory on npm v10+. As a result, `hooks/dist/` directory was not created, and the installer skipped hooks installation on the first run.
- **Fix:** Ran `node scripts/build-hooks.js` manually to build hooks/dist/, then re-ran `get-shit-done-cc --claude --global`.
- **Files modified:** `hooks/dist/gsd-check-update.js`, `hooks/dist/gsd-context-monitor.js`, `hooks/dist/gsd-statusline.js` (created)
- **Result:** Second install run showed "Installed hooks (bundled)" — hooks deployed correctly.

### Local Patches Notice

The installer detected 3 locally modified GSD files from the previous install and backed them up to `~/.claude/gsd-local-patches/`:
- `get-shit-done/templates/config.json`
- `get-shit-done/workflows/execute-phase.md`
- `get-shit-done/workflows/plan-phase.md`

These were backed up (not lost). The new dev versions from gsdup are now installed at `~/.claude/`. If needed, run `/gsd:reapply-patches` to merge old modifications back, or compare manually.

## Self-Check

- [x] `get-shit-done-cc --help` works: PASSED
- [x] `~/.claude/get-shit-done/VERSION` = `1.20.6`: PASSED
- [x] All file lists match between dev and installed: PASSED

## Self-Check: PASSED
