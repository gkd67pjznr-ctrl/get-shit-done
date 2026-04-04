# Project Research Summary

**Project:** GSD — v10.0 Shared MCP Dashboard
**Domain:** Adding StreamableHTTP MCP endpoints to an existing Node.js CJS dashboard server
**Researched:** 2026-04-04
**Confidence:** HIGH

## Executive Summary

v10.0 adds MCP server endpoints to the existing `server.cjs` dashboard, enabling any Claude Code session to query cross-project GSD data (state, gate health, corrections, skill metrics) via tool calls rather than direct file reads. The implementation is narrowly scoped: one new runtime dependency (`@modelcontextprotocol/sdk@1.29.0`), one new module (`mcp-server.cjs`), three targeted edits to `server.cjs` (CORS headers, `/mcp` route dispatch, async callback), and a Phase 2 installer update. The server remains a plain `http.createServer` CJS process — no framework additions, no restructuring.

The recommended approach is stateless per-request transport: create a new `McpServer` + `StreamableHTTPServerTransport` on every POST, register 6 read-only tools as thin wrappers over existing server functions, and clean up on `res.close`. All six tools map directly onto data already computed by `server.cjs` (cache, registry, aggregation functions) plus live JSONL file reads for patterns data not currently in the cache. The MCP endpoint slots into the existing route switch block at `/mcp` alongside `/api/projects`, `/api/events`, etc. No restructuring of the server is needed.

The dominant risk is a cluster of CJS compatibility and session routing pitfalls that are easy to introduce and, in some cases, hard to detect without deliberate testing. The SDK must be pinned to exactly `1.29.0` (v2 is ESM-only; earlier v1 versions have a pkce-challenge CJS bug). Session routing must use a per-session `McpServer` instance — sharing one instance across multiple Claude Code sessions silently misroutes responses or throws on SDK v1.26.0+. CORS headers must be updated before the route handler is wired. Origin validation must be added in Phase 1 per the MCP spec to prevent DNS rebinding. These are all Phase 1 constraints, not afterthoughts.

## Key Findings

### Recommended Stack

The only new runtime dependency is `@modelcontextprotocol/sdk@1.29.0` (pinned exact). This version is the current v1 stable release, ships explicit CJS builds at `dist/cjs/`, and satisfies the existing `zod@^4.3.6` peer dependency without conflict. All other capabilities — session ID generation (`node:crypto`), HTTP handling (`node:http`), body parsing — are already available in the runtime or in `server.cjs`. The SDK's `StreamableHTTPServerTransport` accepts `IncomingMessage`/`ServerResponse` directly, making framework additions (Express, Hono) unnecessary. The SDK internally uses `@hono/node-server` as a transitive dependency to convert between Node.js HTTP objects and Web Standard APIs, but this is transparent to `server.cjs`.

**Core technologies:**
- `@modelcontextprotocol/sdk@1.29.0`: MCP server + StreamableHTTP transport — the only v1 stable release with verified CJS exports and no pkce-challenge dependency issue; pin exact, not `^1.x`
- `McpServer` + `StreamableHTTPServerTransport`: mounted on existing `http.createServer`; `handleRequest(req, res, body)` accepts Node.js HTTP objects directly
- `zod` (existing devDep at `^4.3.6`): tool input validation — already satisfies SDK peer dep `^3.25 || ^4.0`; no version change needed
- `node:crypto` `randomUUID()`: session ID generation — built-in since Node.js 14.17, no new dependency
- `~/.claude.json` (user scope): MCP config install target for installer — not `~/.claude/settings.json`, which Claude Code does not read for MCP config

### Expected Features

All 6 MCP tools are table stakes for the milestone — they are the feature. Differentiators are quality attributes on those tools (filtering, structured errors, auto-configuration). Everything write-facing is explicitly deferred to a future milestone after a concurrency safety model is designed.

**Must have (table stakes — v10.0 Phase 1):**
- `StreamableHTTPServerTransport` at `/mcp` (POST/GET/DELETE) — no transport means no tools callable
- CORS headers updated: POST, DELETE, `mcp-session-id` allowed and exposed
- `list-projects` tool — entry point; wraps `cache.values()`
- `get-project-state` tool — per-project state, roadmap, requirements; wraps `cache.get(name)`
- `get-gate-health` tool — per-project or aggregated gate metrics; wraps existing aggregation functions
- `get-observations` tool — corrections/preferences/suggestions/benchmarks from JSONL files with `limit` + `since` params
- `get-sessions` tool — session history per-project or cross-project; wraps `aggregatePatterns()`
- `get-skill-metrics` tool — per-project skill correction rates; live file reads
- Structured error responses (`{ error, code, available_projects }`) on all failure paths
- Origin validation (`req.headers.origin` check returning 403 on mismatch) — required by MCP spec

**Should have (differentiators — v10.0 Phase 2):**
- Auto-configuration in `bin/install.js`: write `mcpServers.gsd-dashboard` to `~/.claude.json` with `--no-mcp` opt-out flag
- Unit tests for all 6 tool handlers using in-memory transport (no HTTP subprocess)
- Cross-project `get-skill-metrics` merge across all registered projects

**Defer (v10.1+):**
- Dedicated `get-benchmarks` tool (currently reachable via `get-observations` with `type: benchmarks`)
- Write tools (mark correction resolved, promote preference) — requires concurrency safety model; explicitly out of scope per PROJECT.md
- Stateful sessions with server-initiated messages — not needed for read-only tools
- Semantic search over corrections — requires embedding model, out of scope for a lightweight Node.js daemon

### Architecture Approach

The MCP integration is additive: a new `mcp-server.cjs` module contains all MCP logic (`McpServer` instance creation, 6 tool registrations, `handleMcpRequest` function, Origin validation), and `server.cjs` gets three targeted edits — CORS header update, `/mcp` route case, and async callback wrapper. Tool implementations are thin wrappers: `list-projects` and `get-project-state` read from the existing `cache` Map; `get-gate-health` calls existing aggregation functions; `get-observations`, `get-sessions`, and `get-skill-metrics` do live JSONL/JSON file reads from registered project paths (patterns/ directory is not currently cached). The `registerGsdTools(server, cache)` function must be exported from `mcp-server.cjs` so tests can call it directly without an HTTP server.

**Major components:**
1. `mcp-server.cjs` (new) — `McpServer` instance creation per request, 6 tool definitions with zod schemas, `handleMcpRequest(req, res, cache, loadRegistry)`, stateless per-request transport, Origin validation, structured error responses; exported `registerGsdTools(server, cache)` for test isolation
2. `server.cjs` (modified) — `CORS_HEADERS` update to add POST/DELETE/`mcp-session-id`, `/mcp` route case in existing request handler switch, async handler wrapper with explicit try/catch
3. `bin/install.js` (modified, Phase 2) — `installMcpConfig()` writing idempotently to `~/.claude.json` under `mcpServers.gsd-dashboard`, `--no-mcp` opt-out flag

### Critical Pitfalls

1. **SDK v2 ESM-only crash** — `npm install @modelcontextprotocol/sdk` without pinning may pull v2 alpha, which drops CJS and throws `ERR_REQUIRE_ESM` on first `require()`. Pin to exactly `1.29.0` and verify with `node -e "require('@modelcontextprotocol/sdk/server/mcp.js')"` before any other implementation work.

2. **Single shared McpServer instance — silent response misrouting** — One `McpServer` + one `StreamableHTTPServerTransport` shared across sessions routes all responses through the last-connected session's `res` object. Concurrent sessions get each other's responses or get no response. Use stateless per-request transport (new `McpServer` per POST) so session state lives in the MCP client, not the server.

3. **CORS missing POST/DELETE/Mcp-Session-Id** — The existing `CORS_HEADERS` (line ~1144 in `server.cjs`) only allows GET and PATCH. MCP requires POST (tool calls), DELETE (session termination), and `mcp-session-id` in both `Access-Control-Allow-Headers` and `Access-Control-Expose-Headers`. Update CORS before wiring the `/mcp` route — CORS blocks all MCP requests silently from the client side.

4. **Origin validation absent — DNS rebinding attack surface** — The MCP spec requires Origin header validation on all connections. Without it, a malicious web page can exfiltrate cross-project corrections, preferences, and session data. Add `req.headers.origin` check returning 403 in Phase 1, not as a follow-up hardening task.

5. **MCP config written to wrong file** — `~/.claude/settings.json` does not store MCP config; `~/.claude.json` (home directory root) does. Writing `mcpServers` to the wrong file produces no error but the server never appears in `claude mcp list`. Use `claude mcp add --scope user` or write to `~/.claude.json` with JSON parse-merge-stringify (never string manipulation).

## Implications for Roadmap

Based on combined research, two phases are sufficient. The dependency order is clear: transport and CORS must land together because CORS blocks every POST, security constraints are Phase 1 per the MCP spec, and auto-configuration is independent of tool correctness and can wait for manual verification. There are no inter-tool dependencies — the 6 tools can be implemented in any order once the transport is wired.

### Phase 1: MCP Server Scaffolding and Tools

**Rationale:** The transport and CORS are co-dependent — neither is testable without the other. Session architecture (stateless per-request transport) is the foundational architectural decision; getting it wrong requires a full rewrite of the routing layer. Origin validation is a Phase 1 spec requirement. All 6 tools build on top of the verified transport with no inter-tool dependencies and no blocking on installer work.

**Delivers:** A working MCP server at `http://localhost:7778/mcp` with all 6 tools callable via manual `claude mcp add gsd-dashboard --transport http http://localhost:7778/mcp`; no installer change required to verify

**Addresses features:**
- StreamableHTTP transport at `/mcp` (POST/GET/DELETE)
- CORS headers updated (POST, DELETE, `mcp-session-id`)
- All 6 tools: `list-projects`, `get-project-state`, `get-gate-health`, `get-observations`, `get-sessions`, `get-skill-metrics`
- `limit` and `since` params on `get-observations` and `get-sessions`
- Structured error responses on all failure paths
- Origin validation

**Avoids pitfalls:**
- Pitfall 1 (SDK v2 ESM-only): Pin `@modelcontextprotocol/sdk@1.29.0` as first step; verify CJS require before proceeding
- Pitfall 2 (shared McpServer instance): Stateless per-request transport from the start; new `McpServer` on every POST
- Pitfall 3 (CORS): Update `CORS_HEADERS` before writing the `/mcp` handler
- Pitfall 4 (Origin validation): Add `req.headers.origin` check in `handleMcpRequest` before `transport.handleRequest()`
- Pitfall 5 (pkce-challenge): Covered by pinning 1.29.0
- Pitfall 8 (testing via HTTP subprocess): `registerGsdTools` exported from `mcp-server.cjs`, not embedded in the route handler

**Recommended build order within Phase 1:**
1. `npm install @modelcontextprotocol/sdk@1.29.0` + CJS require smoke test
2. Update `CORS_HEADERS` in `server.cjs`
3. Write `mcp-server.cjs` with `handleMcpRequest` skeleton and exported `registerGsdTools`
4. Wire `/mcp` route case in `server.cjs` with async wrapper
5. Implement all 6 tools with zod schemas and structured errors
6. Add Origin validation in `handleMcpRequest`
7. Manual end-to-end verification via `claude mcp add`

### Phase 2: Auto-Configuration and Tests

**Rationale:** Auto-configuration is independent of tool correctness — the right order is to prove the tools work manually before automating setup. Tests are unblocked by the `registerGsdTools` extraction done in Phase 1 (in-memory transport tests require the function to be importable without spinning up an HTTP server). The MCP config file location pitfall (writing to wrong file) is isolated to this phase.

**Delivers:** `node bin/install.js --claude --global` configures MCP automatically; unit tests for all 6 tools run in under 1 second with no HTTP server; `claude mcp list` shows `gsd-dashboard` after a fresh install

**Addresses features:**
- Auto-configuration in `bin/install.js` with `--no-mcp` opt-out
- Unit tests for all 6 tool handlers using `InMemoryTransport` (no subprocess, no port conflicts)
- Cross-project `get-skill-metrics` merge function (if deferred from Phase 1)

**Avoids pitfalls:**
- Pitfall 6 (wrong config file): Use `claude mcp add --scope user` or write to `~/.claude.json` with JSON parse-merge-stringify; verify with `claude mcp list` in tests
- Pitfall 8 (subprocess testing): All tests use in-memory transport; no `setTimeout` delays, no `EADDRINUSE` conflicts

### Phase Ordering Rationale

- Security constraints (Origin validation, CORS) belong in Phase 1 per the MCP spec — they cannot be bolted on after real sessions connect without leaving a window of exposure
- The session routing architecture decision (stateless vs. stateful, per-request vs. shared instance) must be made and implemented in Phase 1; changing it later requires rewriting the entire routing layer
- Auto-configuration deferred to Phase 2 because manual `claude mcp add` is sufficient to verify Phase 1 works; installer complexity should not block core feature delivery
- Tests deferred to Phase 2 because the `registerGsdTools` extraction (Phase 1 requirement) is what makes isolated unit tests possible; they cannot be written until the function boundary exists
- There is no reason for a Phase 3 in v10.0 — the 6 tools, transport, security, installer, and tests are fully covered in two phases

### Research Flags

No phases require `/gsd:research-phase` during planning. Research coverage is comprehensive and all API surfaces have been verified against live code or official sources.

Phases with standard patterns (skip research-phase):
- **Phase 1 (MCP scaffolding + tools):** SDK API verified against v1.29.0 tag source; `handleRequest(req, res, body)` signature confirmed; CORS requirements confirmed from MCP spec and live `server.cjs` code; all 6 tools mapped to existing functions. Implementation should proceed directly from ARCHITECTURE.md.
- **Phase 2 (installer + tests):** `~/.claude.json` write target confirmed from official Claude Code MCP docs and GitHub issue #4976; in-memory transport test pattern confirmed from MCPcat testing guide. Standard work.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | SDK v1.29.0 exports verified against GitHub tag; CJS import paths confirmed via Azure tutorial; zod peer dep confirmed; `@hono/node-server` transitive dep is transparent |
| Features | HIGH | All 6 tools mapped to existing `server.cjs` functions; data files confirmed present on disk; SDK tool API confirmed; anti-features have documented rationale from PROJECT.md constraints |
| Architecture | HIGH | `handleRequest(req, res, body)` 3-arg signature confirmed; stateless mode confirmed; `~/.claude.json` install target confirmed from official docs; body parsing pattern confirmed from existing PATCH handler in `server.cjs` line ~1162 |
| Pitfalls | HIGH | Session routing bug verified against SDK issue #1405 (closed v1.26.0); pkce-challenge bug verified against issue #217 (closed); CORS gap confirmed against live `server.cjs` line 1144; MCP config file confusion confirmed against Claude Code issue #4976 |

**Overall confidence:** HIGH

### Gaps to Address

- **Body parsing for GET and DELETE:** ARCHITECTURE.md notes body parsing confidence as MEDIUM because the Azure tutorial used Express (which pre-parses). The correct handling for GET and DELETE is to pass `undefined` as the body argument — no body read needed. The existing PATCH handler in `server.cjs` confirms the streaming body read pattern for POST. Treat this as a known implementation detail, not a research gap.

- **Cross-project `get-skill-metrics` aggregation:** No existing aggregation function in `server.cjs` for skill metrics. Requires merging `skill-metrics.json` across all registered project paths. Implementation is a straightforward file-read-and-merge; it just doesn't exist yet. Can ship per-project mode in Phase 1 and add cross-project aggregation in Phase 2 without any architectural dependency.

- **Session TTL cleanup if stateful mode is ever needed:** The research recommends stateless per-request transport for v10.0. If stateful sessions are needed in a future milestone, the PITFALLS.md TTL cleanup patterns (2-hour idle TTL, 50-session cap, `lastActivity` timestamp) should be implemented from day one of that milestone — not retroactively.

## Sources

### Primary (HIGH confidence)
- `@modelcontextprotocol/sdk` v1.29.0 source at GitHub tag — CJS exports map, `handleRequest(req, res, body)` signature, session patterns, zod peer dep, `@hono/node-server` transitive dep
- MCP Specification 2025-03-26 (Transports section) — session lifecycle, CORS requirements, Origin validation requirement, DELETE semantics, stateless mode spec
- `get-shit-done/bin/lib/server.cjs` (direct inspection) — `CORS_HEADERS` at line ~1144, route handler structure, PATCH body parsing pattern at line ~1162, existing aggregation functions (`getProjectGateHealth`, `aggregateGateHealth`, `aggregatePatterns`, `loadRegistry`)
- `bin/install.js` (direct inspection) — `settings.json` read/write pattern, Claude runtime install flow structure
- Claude Code MCP Docs — `~/.claude.json` for user-scoped servers, `claude mcp add --transport http --scope user` command syntax
- Azure App Service MCP Tutorial (Node.js, Microsoft) — CJS require paths, stateless per-request pattern, 3-arg `handleRequest` form confirmed working with raw `http.createServer`

### Secondary (MEDIUM confidence)
- SDK Issue #1405 (connect() transport overwrite, fixed v1.26.0) — session routing pitfall confirmed
- SDK Issue #217 (pkce-challenge ESM-only dependency, fixed post-1.7.0) — CJS compatibility pitfall confirmed
- MCPcat Testing Guide — in-memory transport test pattern for MCP servers
- MCPcat CORS Guide — CORS requirements for MCP servers (confirms spec requirements)
- `.planning/v10.0-MILESTONE-CONTEXT.md` — milestone architecture decisions, tool list, scope estimate (~80 lines in `server.cjs`)

### Tertiary (reference)
- SDK Issue #340 (stateless mode validateSession bug, fixed v1.10.1) — confirms 1.29.0 is past the affected range
- Claude Code Issue #4976 (MCP config file location confusion) — confirms `~/.claude.json` vs `settings.json` confusion is a real and documented failure mode
- Claude Code Issue #33947 (MCP orphan process accumulation) — confirms importance of session cleanup patterns

---
*Research completed: 2026-04-04*
*Ready for roadmap: yes*
