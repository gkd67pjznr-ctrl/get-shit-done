---
phase: 44-auto-configuration-and-tests
plan: "01"
subsystem: install
tags: [mcp, installer, configuration, claude-json]

# Dependency graph
requires:
  - phase: 43-mcp-scaffolding-and-tools
    provides: mcp-server.cjs at http://localhost:7778/mcp with 8 read-only tools
provides:
  - writeMcpConfig helper function in bin/install.js
  - --no-mcp opt-out flag for installer
  - Automatic mcpServers.gsd-dashboard entry in ~/.claude.json on --claude --global
affects:
  - 44-02-tests
  - any phase touching bin/install.js or MCP configuration

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Merge-safe JSON config writes (read → merge → write, never clobber)
    - Three-condition guard pattern (runtime === 'claude' && isGlobal && !hasNoMcp)

key-files:
  created: []
  modified:
    - bin/install.js

key-decisions:
  - "writeMcpConfig reads existing ~/.claude.json before writing — never destroys other keys"
  - "Three-condition guard ensures MCP config only written for Claude global installs with no opt-out"
  - "Failure in writeMcpConfig is non-fatal — logs yellow warning and continues install"

patterns-established:
  - "Merge-safe config write: read existing JSON, merge, write back — used for ~/.claude.json"
  - "Opt-out flag pattern: --no-mcp skips the write entirely, file untouched"

requirements-completed:
  - CONF-01
  - CONF-02

# Metrics
duration: 15min
completed: 2026-04-04
---

# Plan 44-01: Installer MCP Auto-Configuration Summary

**`writeMcpConfig` helper and `--no-mcp` opt-out wired into `bin/install.js` so `--claude --global` installs automatically configure `mcpServers.gsd-dashboard` in `~/.claude.json`**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-04T13:10:00Z
- **Completed:** 2026-04-04T13:25:00Z
- **Tasks:** 5
- **Files modified:** 1

## Accomplishments

- Added `hasNoMcp` flag parsing at module scope alongside existing `has*` flag variables
- Added `--no-mcp` to the help text Options block, appearing after `--force-statusline`
- Implemented `writeMcpConfig(homeDir)` — merge-safe write of `mcpServers['gsd-dashboard']` to `~/.claude.json`
- Called `writeMcpConfig` from `finishInstall` under three-condition guard (`runtime === 'claude' && isGlobal && !hasNoMcp`)
- Both smoke tests pass (MCP config written correctly; `--no-mcp` leaves existing file unchanged)

## Task Commits

All tasks shipped in a single atomic commit as directed by the plan:

1. **Tasks 1-4: flag parsing, help text, writeMcpConfig, call site** - `56ab210` (feat(install): write mcpServers.gsd-dashboard to ~/.claude.json on --claude --global)

## Files Created/Modified

- `bin/install.js` — added `hasNoMcp` flag, `--no-mcp` help entry, `writeMcpConfig` function, and call inside `finishInstall`

## Decisions Made

- Followed plan exactly as written — no additional decisions required

## Deviations from Plan

None - plan executed exactly as written.

## Quality Gates

**Quality Level:** standard

| Task | Gate | Outcome | Detail |
|------|------|---------|--------|
| 1-4 | codebase_scan | passed | Confirmed `readSettings`/`writeSettings` patterns; reused fs.existsSync approach |
| 1-4 | context7_lookup | skipped | Pure Node.js fs/path/os — no library docs needed |
| 1-4 | test_baseline | passed | 1108 tests passing before changes |
| 1-4 | test_gate | passed | 1108 pass, 3 fail — same 3 pre-existing failures, no regressions |
| 1-4 | diff_review | passed | Clean diff, 33 insertions |

**Summary:** 5 gates ran, 4 passed, 0 warned, 1 skipped, 0 blocked

## Issues Encountered

None.

## Next Phase Readiness

- Plan 44-02 ready: write unit tests for all 8 tool handlers using in-memory transport + integration test for `/mcp` endpoint
- No blockers

---
*Phase: 44-auto-configuration-and-tests*
*Completed: 2026-04-04*
