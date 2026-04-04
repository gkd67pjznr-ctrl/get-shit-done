# Roadmap: GSD Enhanced Fork — v10.0 Shared MCP Dashboard

## Overview

v10.0 mounts MCP tool endpoints on the existing dashboard server so every Claude Code session can query cross-project GSD data via StreamableHTTP transport. Two phases: Phase 43 wires the transport, security, and all 8 read-only tools; Phase 44 automates installer configuration and adds test coverage.

## Phases

- [ ] **Phase 43: MCP Server Scaffolding and Tools** - Transport, CORS, Origin validation, SDK pin, and all 8 read-only query tools
- [ ] **Phase 44: Auto-Configuration and Tests** - Installer writes `~/.claude.json` MCP config; unit + integration tests for all tool handlers

## Phase Details

### Phase 43: MCP Server Scaffolding and Tools
**Goal**: Any Claude Code session can call all 8 GSD query tools via `http://localhost:7778/mcp` after manually running `claude mcp add`
**Depends on**: Nothing (first phase of v10.0 milestone)
**Requirements**: TRANS-01, TRANS-02, TRANS-03, TRANS-04, TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05, TOOL-06, TOOL-07, TOOL-08
**Success Criteria** (what must be TRUE):
  1. Running `node -e "require('@modelcontextprotocol/sdk/server/mcp.js')"` exits 0 with SDK pinned to 1.29.0
  2. Sending a POST to `/mcp` from a Claude Code session returns a valid MCP tool-list response with all 8 tools visible
  3. Calling `list-projects` returns the registered GSD projects; calling `get-project-state` for a known project returns its STATE.md data
  4. A request from an unlisted Origin receives a 403 response before any tool handler executes
  5. The dashboard server accepts POST and DELETE methods and the `mcp-session-id` header without CORS rejection
**Plans**: TBD

Plans:
- [x] 43-01: Pin SDK, install, update CORS headers, write `mcp-server.cjs` skeleton, wire `/mcp` route, smoke test
- [x] 43-02: Implement tools 1-4 (list-projects, get-project-state, get-gate-health, get-observations)
- [ ] 43-03: Implement tools 5-8 (get-sessions, get-skill-metrics, get-cost-metrics, get-git-status) + E2E verification

### Phase 44: Auto-Configuration and Tests
**Goal**: A fresh `node bin/install.js --claude --global` configures MCP automatically; all tool handlers are covered by fast-running unit tests with no HTTP server required
**Depends on**: Phase 43
**Requirements**: CONF-01, CONF-02, TEST-01, TEST-02
**Success Criteria** (what must be TRUE):
  1. Running `node bin/install.js --claude --global` causes `claude mcp list` to show `gsd-dashboard` pointing at `http://localhost:7778/mcp`
  2. Running `node bin/install.js --claude --global --no-mcp` leaves `~/.claude.json` unmodified
  3. All 8 tool handler unit tests pass without a running HTTP server or port conflicts
  4. The integration test sends a valid MCP request to `/mcp` and receives a non-error response
**Plans**: TBD

Plans:
- [ ] 44-01: Update `bin/install.js` to write `mcpServers.gsd-dashboard` to `~/.claude.json` with `--no-mcp` opt-out
- [ ] 44-02: Write unit tests for all 8 tool handlers using `registerGsdTools` + in-memory transport; write integration test for `/mcp` endpoint

## Progress

**Execution Order:**
Phases execute in order: 43 → 44

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 43. MCP Server Scaffolding and Tools | 2/3 | In progress | - |
| 44. Auto-Configuration and Tests | 0/2 | Not started | - |
