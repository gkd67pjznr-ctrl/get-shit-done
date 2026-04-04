---
phase: 43-mcp-server-scaffolding-and-tools
plan: 01
subsystem: api
tags: [mcp, modelcontextprotocol, streamable-http, cors, node-http, cjs]

# Dependency graph
requires: []
provides:
  - MCP SDK pinned at 1.29.0 as CJS-compatible runtime dependency
  - mcp-server.cjs with handleMcpRequest and registerGsdTools (8 stub tools)
  - /mcp route in server.cjs dispatching to handleMcpRequest
  - DNS rebinding protection via ALLOWED_ORIGINS origin check
  - CORS headers updated to include POST, DELETE, mcp-session-id
affects:
  - 43-02 (tool implementations depend on handleMcpRequest skeleton)
  - 43-03 (tool implementations depend on registerGsdTools stub signatures)
  - 44-auto-config (MCP server must exist before auto-config can reference it)

# Tech tracking
tech-stack:
  added:
    - "@modelcontextprotocol/sdk 1.29.0 (CJS, stateless StreamableHTTPServerTransport)"
    - "zod (already in devDeps, used for tool input schemas in mcp-server.cjs)"
  patterns:
    - "Stateless per-request McpServer: new instance on every POST to /mcp"
    - "Origin whitelist for DNS rebinding protection (ALLOWED_ORIGINS Set)"
    - "Async http.createServer callback with try/catch error boundary"

key-files:
  created:
    - get-shit-done/bin/lib/mcp-server.cjs
  modified:
    - package.json
    - package-lock.json
    - get-shit-done/bin/lib/server.cjs

key-decisions:
  - "Stateless per-request transport chosen: new McpServer + StreamableHTTPServerTransport per POST — prevents silent response misrouting across concurrent Claude Code sessions"
  - "SDK pinned to exactly 1.29.0 (no caret/tilde) — v2 is ESM-only and breaks CJS server"
  - "zod already in devDeps at ^4.3.6 — used for MCP tool schemas without adding a new dep"
  - "ALLOWED_ORIGINS whitelist for /mcp: allows localhost:7778 and 127.0.0.1:7778 only"

patterns-established:
  - "MCP tool stubs: all 8 handlers return { content: [{ type: 'text', text: 'TODO' }] } — filled in 43-02/43-03"
  - "handleMcpRequest returns boolean: true if handled, false if pathname !== /mcp — allows server.cjs to fall through to other routes"
  - "res.on('close') cleanup: transport.close() + server.close() called on connection teardown"

requirements-completed:
  - TRANS-01
  - TRANS-02
  - TRANS-03
  - TRANS-04

# Metrics
duration: 20min
completed: 2026-04-04
---

# Plan 43-01: SDK Pin, CORS Update, and MCP Server Skeleton Summary

**MCP SDK 1.29.0 installed as CJS dep, /mcp route live in server.cjs returning valid InitializeResult, DNS rebinding protection returning 403 for untrusted origins**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-04T00:00:00Z
- **Completed:** 2026-04-04T00:20:00Z
- **Tasks:** 5 (4 implementation + 1 smoke test)
- **Files modified:** 3

## Accomplishments
- `@modelcontextprotocol/sdk` 1.29.0 pinned as runtime dependency; both `require('@modelcontextprotocol/sdk/server/mcp.js')` and `require('@modelcontextprotocol/sdk/server/streamableHttp.js')` exit 0
- `mcp-server.cjs` created with `handleMcpRequest` (stateless per-request transport) and `registerGsdTools` (8 stub tools with zod schemas)
- `/mcp` route wired into `createHttpServer` with async callback and try/catch error boundary
- Live smoke test: MCP initialize returns `{"result":{"protocolVersion":"2024-11-05",...}}` — valid InitializeResult
- Origin rejection: `http://attacker.example` returns HTTP 403 from /mcp

## Task Commits

1. **T01: Pin SDK in package.json and install** - `5010d9f` (feat)
2. **T02: Update CORS_HEADERS in server.cjs** - `84b81e2` (feat)
3. **T03: Create mcp-server.cjs skeleton** - `59dea38` (feat)
4. **T04: Wire /mcp route into createHttpServer** - `54c8912` (feat)
5. **T05: Smoke test** - (no file changes; verification only)

## Files Created/Modified
- `package.json` — Added `"@modelcontextprotocol/sdk": "1.29.0"` to dependencies
- `package-lock.json` — Updated by npm install
- `get-shit-done/bin/lib/mcp-server.cjs` — New file: handleMcpRequest, registerGsdTools, readBody, ALLOWED_ORIGINS
- `get-shit-done/bin/lib/server.cjs` — CORS_HEADERS updated; require('./mcp-server.cjs') added; /mcp route dispatched; callback made async with try/catch

## Decisions Made
- Stateless per-request McpServer transport confirmed correct — no shared state between Claude Code sessions
- zod already present in devDeps; used directly for tool input schemas (no new dep needed)
- ALLOWED_ORIGINS set to localhost:7778 and 127.0.0.1:7778 only, matching the dashboard default port

## Deviations from Plan

None — plan executed exactly as written.

The smoke test initially failed without the `Accept: application/json, text/event-stream` header (SDK returns -32000 "Not Acceptable"). Added correct header to the curl test; this is expected behavior from the MCP Streamable HTTP spec and is not a server bug. The origin rejection test returned 403 as expected on the first attempt.

## Quality Gates

**Quality Level:** standard

| Task | Gate | Outcome | Detail |
|------|------|---------|--------|
| T01 | codebase_scan | passed | checked existing dep format (chokidar, ws) |
| T01 | context7_lookup | skipped | npm pin — no library API to query |
| T01 | test_gate | passed | both CJS smoke tests exit 0 |
| T02 | codebase_scan | passed | matched existing CORS_HEADERS shape |
| T02 | diff_review | passed | clean diff, 2 lines added |
| T03 | codebase_scan | passed | readBody pattern mirrors existing body-parsing in server.cjs |
| T03 | test_gate | passed | module loads, both exports are functions |
| T04 | codebase_scan | passed | route dispatch pattern already established |
| T04 | test_gate | passed | server.cjs loads without error, grep finds 2 matches |
| T05 | test_gate | passed | initialize returns protocolVersion; attacker origin returns 403 |

**Summary:** 10 gates ran, 9 passed, 0 warned, 1 skipped, 0 blocked

## Issues Encountered
- Live smoke test required `Accept: application/json, text/event-stream` header — without it, MCP SDK returns -32000 "Not Acceptable". This is correct SDK behavior per the Streamable HTTP spec; not a bug.
- `startDashboardServer()` requires a registered project path to avoid a chokidar warning (`Skipping missing path`). Used port 7779 for the standalone test to avoid colliding with a running server.

## Next Phase Readiness
- `/mcp` route responds to MCP initialize — transport and origin guard are in place
- All 8 tool stubs registered; ready for implementation in plans 43-02 and 43-03
- No blockers

---
*Phase: 43-mcp-server-scaffolding-and-tools*
*Completed: 2026-04-04*
