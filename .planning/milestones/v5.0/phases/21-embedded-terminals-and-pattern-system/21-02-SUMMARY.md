---
phase: 21
plan: "02"
status: complete
completed: "2026-03-09"
duration_estimate: "~15 min"
---

# Summary: Plan 21-02 -- WebSocket-to-Tmux Bridge Backend (TERM-03)

## What Was Done

Implemented the `setupTerminalWebSocket(httpServer)` function in `server.cjs` that bridges browser WebSocket clients to live tmux sessions, plus integration tests for the bridge.

## Tasks Completed

### 21-02-01: Add setupTerminalWebSocket function to server.cjs

Added `setupTerminalWebSocket(httpServer)` function to `get-shit-done/bin/lib/server.cjs`:

- Uses `WebSocketServer({ noServer: true })` attached to the existing HTTP server via `server.on('upgrade')`
- URL pattern: `/ws/terminal/<sessionName>` -- all other upgrade paths are rejected via `socket.destroy()`
- Session validation: `tmux has-session -t <name>` via `execSync` -- closes with code 4004 if missing
- Empty session name closes immediately with code 4000
- Duplicate connections to the same session close with code 4009
- Single `ws.on('message')` handler: JSON resize control messages (`{ type: 'resize', cols, rows }`) are handled via `tmux resize-window`, binary data is forwarded to `proc.stdin`
- `process.on('SIGINT')` cleanup kills all active tmux-attach processes
- Exported from `module.exports` as `setupTerminalWebSocket`

Imports added: `spawn` from `child_process` (destructured alongside existing `execSync`), `WebSocketServer` from `ws`.

**Deviation:** Python script used for insertion produced `\!` escape sequences (invalid in Node.js). Fixed by applying `sed 's/\\!/!/g'` before the commit reached the working tree, resulting in correct syntax.

### 21-02-02: Integration tests in tests/server.test.cjs

Added `describe('setupTerminalWebSocket integration', ...)` block with 3 tests:

1. `rejects connection with empty session name` -- expects close code 4000
2. `rejects connection for non-existent tmux session` -- expects close code 4004 (connection error also accepted)
3. `non-terminal upgrade path is rejected` -- expects error or close (socket destroyed)

All tests use `return new Promise((resolve) => ...)` pattern per the [21-01] decision (Node.js built-in test runner requires Promise-based async tests).

### 21-02-03: Full test suite verification

`npm test` result: 957 pass, 1 fail (pre-existing `config-get command` failure, unchanged from baseline).

## Decisions Made

- [21-02]: `setupTerminalWebSocket` uses `noServer: true` mode sharing the HTTP server's port -- no second port needed
- [21-02]: `tmux has-session` validation is synchronous (`execSync`) to keep the connection handler linear -- acceptable since it has a 2s timeout
- [21-02]: Single `ws.on('message')` handler handles both JSON control messages (resize) and binary stdin forwarding, with JSON parse failure falling through to binary path

## Files Modified

- `get-shit-done/bin/lib/server.cjs` -- added `setupTerminalWebSocket` function and export
- `tests/server.test.cjs` -- added 3 integration tests for the WebSocket bridge

## Commits

- `fbbebb0` feat(server): add setupTerminalWebSocket WebSocket-to-tmux bridge (TERM-03)
- `ec4b089` docs(quick-21-04a): add summary and update STATE.md for plan 04a (includes test and syntax fixes)

## must_haves Verification

- [x] `setupTerminalWebSocket(httpServer)` is defined and exported from `server.cjs`
- [x] WebSocket upgrades on `/ws/terminal/*` are handled; all other upgrade paths are rejected (socket destroyed)
- [x] Empty session name closes WebSocket with code 4000
- [x] Non-existent tmux session closes WebSocket with code 4004
- [x] Duplicate session attachment closes second WebSocket with code 4009
- [x] Single `ws.on('message')` handler forwards binary data to tmux stdin AND handles JSON resize control messages
- [x] `process.on('SIGINT')` cleanup kills all active tmux-attach processes
- [x] `npm test` full suite passes (1 pre-existing failure, not introduced by this plan)
