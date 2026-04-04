# Pitfalls Research

**Domain:** Adding MCP StreamableHTTP endpoints to an existing Node.js CJS dashboard server (v10.0 Shared MCP Dashboard)
**Researched:** 2026-04-04
**Confidence:** HIGH (SDK issues verified against official GitHub issues and closed PRs; spec requirements from official MCP specification; CORS pitfall confirmed against live server.cjs code)

---

## Critical Pitfalls

### Pitfall 1: SDK v2 Alpha Is ESM-Only — Installing It Breaks CJS Require

**What goes wrong:**
`@modelcontextprotocol/sdk` v2.x alpha dropped CJS builds entirely. Running `npm install @modelcontextprotocol/sdk` on a project using a v2.x dist tag will install an ESM-only package into a CJS server. The first `require('@modelcontextprotocol/sdk/...')` call crashes with `ERR_REQUIRE_ESM`. The dashboard server is pure CJS (`'use strict'`; all `require()` calls) — ESM is not an option without a full server rewrite.

**Why it happens:**
npm dist tags move forward automatically when a maintainer publishes a new major under the `latest` or `alpha` tag. Developers running `npm install @modelcontextprotocol/sdk` without pinning a version get whatever is current. The SDK changelog does not prominently warn CJS users in the install flow.

**How to avoid:**
Pin the version explicitly: `npm install @modelcontextprotocol/sdk@1.29.0`. Verify CJS compatibility after install by checking `node_modules/@modelcontextprotocol/sdk/dist/cjs/` exists and the `package.json` exports map includes `"require"` conditions. Do not use the `@latest` tag or version ranges (`^1.x`) that could resolve to v2.

**Warning signs:**
- `node_modules/@modelcontextprotocol/sdk/dist/cjs/` directory is absent after install
- `package.json` exports only show `"import"` conditions, no `"require"`
- `require()` of SDK path throws `ERR_REQUIRE_ESM` at server startup

**Phase to address:** Phase 1 (MCP server scaffolding). Pin the version in the very first `npm install` command. Never leave this to the implementer's memory.

---

### Pitfall 2: Single Server Instance Shared Across Multiple Sessions — Silent Response Routing Failure

**What goes wrong:**
The intuitive implementation creates one `McpServer` instance and one `StreamableHTTPServerTransport` at server startup, then calls `transport.handleRequest(req, res)` for every incoming `/mcp` POST. This works for the first Claude Code session. When a second session connects and initializes, the SDK's `Protocol.connect()` overwrites `this._transport` with the second session's transport. Responses destined for session 1 are now routed to session 2's HTTP response object, or silently dropped. Before SDK v1.26.0, this failure was silent — no error thrown, no warning logged. After v1.26.0, `connect()` throws if already connected, making the bug loud but still incorrect in architecture.

**Why it happens:**
The MCP spec says one `Server` handles many sessions. Developers assume "one server instance" means "one `McpServer` object." The SDK documentation does clarify this but the correct pattern — one `McpServer` per session — contradicts the natural instinct to share a single initialized server. The official SDK examples (e.g., `sseAndStreamableHttpCompatibleServer.js`) demonstrate the correct pattern but are not prominently linked from the basic setup docs.

**How to avoid:**
Create a new `McpServer` instance for every incoming session initialization request. Store each `(sessionId → { server, transport })` pair in a `Map`. On each incoming POST, look up the session's transport from the Map, call `transport.handleRequest(req, res)`. On DELETE or session close, call `transport.close()` and remove from the Map.

```javascript
const sessions = new Map(); // sessionId → { server, transport }

// On POST /mcp:
const sessionId = req.headers['mcp-session-id'];
if (sessionId && sessions.has(sessionId)) {
  sessions.get(sessionId).transport.handleRequest(req, res);
} else if (isInitializeRequest(body)) {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => sessions.set(id, { server: mcpServer, transport }),
  });
  const mcpServer = new McpServer({ name: 'gsd-dashboard', version: '1.0.0' });
  registerTools(mcpServer);
  await mcpServer.connect(transport);
  await transport.handleRequest(req, res);
} else {
  res.writeHead(400); res.end();
}
```

**Warning signs:**
- Only one session can use MCP tools at a time; the second session's tool calls time out
- SDK v1.26.0+: server throws `"Already connected to a transport"` on the second session
- Tool responses from one Claude Code session appear in a different session's context

**Phase to address:** Phase 1 (MCP server scaffolding). This is the foundational architectural decision. Getting it wrong requires a rewrite of the entire session routing layer.

---

### Pitfall 3: CORS Headers Missing POST, DELETE, and Mcp-Session-Id — All MCP Requests Blocked

**What goes wrong:**
The existing `CORS_HEADERS` constant in `server.cjs` (line 1144) is:
```javascript
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
```
MCP StreamableHTTP requires POST (for tool calls), DELETE (for session termination), and the `Mcp-Session-Id` header in both `Access-Control-Allow-Headers` (so clients can send it) and `Access-Control-Expose-Headers` (so browser-based clients can read it from responses). The existing CORS config does not allow POST or DELETE and does not expose `Mcp-Session-Id`. The Claude Code client is not browser-based, but preflight OPTIONS requests from any web-based MCP client will be rejected. The bigger problem: the dashboard server already runs behind this CORS config, and adding the `/mcp` route without updating CORS breaks the entire MCP integration silently (no CORS error is logged server-side — the block happens in the client).

**Why it happens:**
The existing server was built for a web dashboard (GET for data, PATCH for state updates). MCP requires a different HTTP method surface. Updating CORS is easy to forget because the server starts without error and the MCP route receives requests fine from Node.js-based clients, masking the browser-client breakage.

**How to avoid:**
Update `CORS_HEADERS` before adding the `/mcp` route:
```javascript
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Mcp-Session-Id',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
};
```
Apply this to the OPTIONS preflight handler and all response paths. The `Mcp-Session-Id` must appear in both `Allow-Headers` and `Expose-Headers` — one without the other is insufficient.

**Warning signs:**
- Claude Code connects fine but a browser-based MCP client cannot initialize
- Preflight OPTIONS to `/mcp` returns 204 but the actual POST fails with a CORS error in browser devtools
- `Mcp-Session-Id` header is not visible in response headers when inspecting from a browser

**Phase to address:** Phase 1 (MCP server scaffolding). Update CORS before writing the `/mcp` route handler — not after.

---

### Pitfall 4: Session Map Memory Leak — Transports Never Removed

**What goes wrong:**
Every Claude Code session that connects creates a new entry in the sessions `Map`. When a session ends (user closes the terminal, Claude Code exits), the client either sends a DELETE request to terminate the session or simply disconnects without cleanup. If the server only populates the Map (never removes entries), memory grows unbounded. Each transport entry holds references to request/response objects, event listeners, and the McpServer instance. A developer running 10 Claude Code sessions/day accumulates 300+ leaked entries per month. At the scale of this project (a local dev tool, not a web service), this means the dashboard server restarts become necessary every few days.

**Why it happens:**
The happy path — "Claude Code sends DELETE, server removes the session" — works correctly. The failure path — "Claude Code crashes or is force-killed without sending DELETE" — is never tested during development. The DELETE handling is added but the crash/disconnect path is not, leaving a Map that only grows. The MCP spec allows servers to respond to DELETE with `405 Method Not Allowed` (opting out of client-driven termination), which means some clients never send DELETE.

**How to avoid:**
Three layers of cleanup:
1. **DELETE handler:** When DELETE `/mcp` arrives with a valid `Mcp-Session-Id`, call `transport.close()` and `sessions.delete(sessionId)`.
2. **Idle TTL:** On each session Map entry, record `lastActivity: Date.now()`. A `setInterval` running every 5 minutes scans the Map and removes entries idle for more than 2 hours.
3. **Session cap:** If `sessions.size > 50`, reject new initialization requests with HTTP 429. Local dev tool will never legitimately have 50 concurrent sessions — this cap signals a leak, not a load spike.

**Warning signs:**
- `sessions.size` grows without bound — add a periodic `console.log` during development
- Dashboard server process memory climbs from ~50MB at start to 200MB+ after a day of use
- Tool calls from old sessions succeed when they should have been cleaned up

**Phase to address:** Phase 1 (MCP server scaffolding). The TTL cleanup and cap must be in the initial implementation. Adding cleanup retroactively requires tracking `lastActivity` timestamps from the start — if that field is not populated at session creation, retroactive cleanup has no data to work from.

---

### Pitfall 5: pkce-challenge ESM Dependency Breaks CJS Require on SDK 1.7.x

**What goes wrong:**
`@modelcontextprotocol/sdk@1.7.0` introduced `pkce-challenge` as a dependency. `pkce-challenge` is an ESM-only package. The SDK's CJS build attempts `require('pkce-challenge')` and throws `ERR_REQUIRE_ESM` on first import — even if the application code never uses OAuth or PKCE features. This is unrelated to whether the application needs PKCE; the SDK's CJS bundle unconditionally imports it.

**Why it happens:**
The SDK added OAuth/PKCE support in 1.7.x and introduced an ESM-only transitive dependency in the CJS build path. This was not caught in the SDK's own CI because the SDK's tests run in ESM. The bug was reported (GitHub issue #217), fixed via PR #254, and resolved in a subsequent minor release.

**How to avoid:**
Use `@modelcontextprotocol/sdk@1.29.0` specifically. This version is confirmed to have CJS builds with no ESM-only transitive dependency issues. Verify after install: `node -e "require('@modelcontextprotocol/sdk/server/mcp.js')"` should exit 0 without throwing. If it throws `ERR_REQUIRE_ESM`, the installed version has the pkce-challenge bug.

**Warning signs:**
- `require('@modelcontextprotocol/sdk/...')` throws `ERR_REQUIRE_ESM` at server startup even when no OAuth code is used
- The error stack trace mentions `pkce-challenge` in the require chain
- `node_modules/pkce-challenge/package.json` contains `"type": "module"` with no CJS build

**Phase to address:** Phase 1 (MCP server scaffolding). Test the require() call in isolation before wiring anything else.

---

### Pitfall 6: Claude Code MCP Config Written to Wrong File — Server Never Connects

**What goes wrong:**
The installer (`bin/install.js`) needs to register the MCP server with Claude Code. There are three valid locations: `~/.claude.json` (user-scope, all projects), `.mcp.json` (project root, project-scope), and local scope via `claude mcp add`. Developers attempting to write to `~/.claude/settings.json` — which exists for other Claude settings — produce a silently-ignored MCP config. Claude Code does not read `mcpServers` from `settings.json`. Similarly, manual edits to `mcpServers` inside `settings.json` are ignored without any error logged.

**Why it happens:**
`~/.claude/settings.json` is the natural place to configure Claude Code settings. The MCP configuration using a separate `~/.claude.json` at the home directory root (not inside `~/.claude/`) is counterintuitive and poorly documented. The installer copying its output to the wrong file produces no error — the file writes succeed, Claude Code starts, and MCP just never appears.

**How to avoid:**
Use the `claude mcp add` CLI command rather than writing config files directly. The command handles file placement and format correctly:
```bash
claude mcp add gsd-dashboard --transport http --scope user http://localhost:7778/mcp
```
- `--scope user` writes to `~/.claude.json` — available in all projects on the machine
- `--scope project` writes to `.mcp.json` in the current project root
- `--scope local` (default) writes to `~/.claude.json` under the current project's path

If the installer must write config files directly (to avoid requiring the user to have `claude` in PATH during install), write to `~/.claude.json` at `mcpServers.gsd-dashboard`, not to `~/.claude/settings.json`.

**Warning signs:**
- `claude mcp list` does not show `gsd-dashboard` after install runs
- MCP tools are not visible in Claude Code's tool list
- No error during install — the config file was written, just to the wrong location

**Phase to address:** Phase 2 (auto-configuration via installer). Test the installer against a clean Claude Code install and verify `claude mcp list` shows the server.

---

### Pitfall 7: Missing Origin Validation — DNS Rebinding Attack Surface

**What goes wrong:**
The MCP specification explicitly requires: "Servers MUST validate the `Origin` header on all incoming connections to prevent DNS rebinding attacks." The current dashboard server binds to `0.0.0.0` (all interfaces) by default (or at least does not explicitly bind to `127.0.0.1`). Without Origin validation, a malicious web page can make cross-origin requests to `http://localhost:7778/mcp` via DNS rebinding — the browser sends the request from the attacker's domain resolving to 127.0.0.1, bypassing the same-origin policy. The MCP tools expose cross-project data (corrections, preferences, session history) — sensitive enough to warrant this protection.

**Why it happens:**
Localhost servers feel safe because they're not on the internet. DNS rebinding is a non-obvious attack vector that most developers have not encountered directly. The spec's security warning is in the transport documentation, not in the SDK's `StreamableHTTPServerTransport` constructor — there is no default protection.

**How to avoid:**
Add Origin validation to the `/mcp` route handler before passing to `transport.handleRequest()`:
```javascript
const origin = req.headers['origin'];
if (origin && origin !== 'http://localhost:7778' && origin !== 'http://127.0.0.1:7778') {
  res.writeHead(403, { 'Content-Type': 'text/plain' });
  res.end('Forbidden: invalid origin');
  return;
}
```
Also bind the server to `127.0.0.1` explicitly (or add a note that the server should not be exposed on external interfaces).

**Warning signs:**
- Server binds to `0.0.0.0` rather than `127.0.0.1`
- The `/mcp` route does not inspect `req.headers.origin` before calling `transport.handleRequest()`
- MCP tools are accessible from any origin (can verify with `curl -H "Origin: http://attacker.com" http://localhost:7778/mcp`)

**Phase to address:** Phase 1 (MCP server scaffolding). Security must be in the initial implementation, not a follow-up.

---

### Pitfall 8: Testing MCP Tool Handlers via HTTP — Race Conditions and Subprocess Overhead

**What goes wrong:**
Attempting to test MCP tool handlers by spawning the full dashboard server subprocess in tests, then making HTTP requests to `/mcp`, produces race conditions (server not ready when the first request arrives), requires port cleanup between tests, and makes tests slow (server startup takes 200-500ms). Parallel test runs collide on port 7778. The tests become integration tests of the entire server stack rather than unit tests of the tool logic.

**Why it happens:**
The natural instinct is to test the full stack end-to-end: "call the tool the same way Claude Code would." But the overhead and flakiness of HTTP-based subprocess testing is well-documented in the MCP community. The correct pattern — in-memory transport binding — tests the tool handler logic directly without HTTP.

**How to avoid:**
Test tool handlers directly by creating an MCP server in the test, registering the same tools, and calling them via an in-memory `InMemoryTransport` or direct handler invocation:
```javascript
// In test:
const server = new McpServer({ name: 'test', version: '0.0.1' });
registerGsdTools(server, mockCache); // same function used in server.cjs
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await server.connect(serverTransport);
const client = new McpClient({ name: 'test-client', version: '0.0.1' });
await client.connect(clientTransport);
const result = await client.callTool({ name: 'list-projects', arguments: {} });
assert.ok(Array.isArray(result.content));
```
This tests the exact tool logic with no HTTP, no subprocess, no port conflicts.

**Warning signs:**
- Tests use `setTimeout` delays waiting for the server to start
- Test cleanup requires `kill -9` of the server subprocess
- Parallel test runs fail with `EADDRINUSE` on port 7778
- Test suite takes >5 seconds for a handful of tool handler tests

**Phase to address:** Phase 1 (MCP server scaffolding). The tool registration function must be extractable (not embedded in the HTTP route handler) so tests can call it directly. This is an architectural constraint, not a testing afterthought.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Inline tool handler logic in route handler | Fewer files, faster initial implementation | Cannot unit test tool logic without HTTP; tool code mixed with transport code | Never — extract to `registerGsdTools(server, cache)` from day one |
| Stateless mode (no session IDs) | No Map management, simpler code | Breaks resumability; stateless mode had a validated bug in SDK versions pre-1.10.1; requires each request to re-initialize | Never for this use case — tools query cache state, sessions add value |
| `Access-Control-Allow-Origin: *` without Origin validation | Works immediately for all clients | DNS rebinding attack surface on localhost; spec violation | Acceptable temporarily if bound strictly to 127.0.0.1 |
| Single shared McpServer instance | Fewer objects, feels cleaner | Silent response routing failure with concurrent sessions; throws on SDK v1.26.0+ | Never |
| Writing MCP config directly to `~/.claude.json` with string manipulation | Avoids JSON parse/write complexity | Corrupts the file if the JSON is malformed; overwrites existing mcpServers config | Never — use `JSON.parse` → merge → `JSON.stringify` or use `claude mcp add` |
| No session TTL cleanup | Less code to write | Memory leak accumulates with every session; dashboard restarts needed weekly | Never |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude Code `claude mcp add` | Using `--scope project` without running from the project root | `--scope project` writes `.mcp.json` in CWD; always run from the project directory |
| Claude Code `claude mcp add` | Flags placed after server name: `claude mcp add gsd --transport http url` works but `claude mcp add gsd url --transport http` may not be parsed correctly | All flags must precede the server URL argument |
| Claude Code MCP connection | Server not running when Claude Code starts → connection error → MCP tools silently absent | Add a startup check in the installer; document that `gsd-tools dashboard start` must run before Claude Code sessions |
| Dashboard server CORS | Existing CORS_HEADERS used on `/mcp` route without update | MCP requires POST + DELETE + Mcp-Session-Id; the existing headers only allow GET + PATCH |
| MCP SDK CJS require path | Using `require('@modelcontextprotocol/sdk')` (bare specifier) | Use explicit subpath: `require('@modelcontextprotocol/sdk/server/mcp.js')` and `require('@modelcontextprotocol/sdk/server/streamableHttp.js')` — the package exports map requires subpaths |
| Tool input schema (zod) | Defining zod schemas inline in the route handler | zod is already a devDep in this project; import from the same zod instance to avoid version mismatch |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Reading full `.planning/` files for every tool call | Tool calls take 500ms+; dashboard server CPU spikes during active sessions | Tool handlers should read from the existing `cache` object, not disk; use live file reads only for single-project detail queries | At 5+ concurrent sessions all calling tools simultaneously |
| Returning all projects in `list-projects` with full detail | Response payload too large; client parsing slow | `list-projects` returns lightweight summary (name, status, phase count); separate `get-project-state` call for detail | At 20+ registered projects |
| No session cap on the sessions Map | Memory grows to 500MB+; OOM kills the dashboard | Hard cap at 50 concurrent sessions; reject new init with HTTP 429 | At ~100 accumulated dead sessions (never happens in practice without the bug) |
| Tool handler awaiting disk reads for every call | Latency accumulates; Claude Code waits for responses | Use the dashboard cache (already populated by chokidar watchers) for aggregate queries; cache-miss reads fall back to disk | At 3+ concurrent tool calls on the same data |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| No Origin header validation on `/mcp` | DNS rebinding attack: malicious web page reads cross-project corrections, preferences, session data | Validate `req.headers.origin` against localhost; return 403 on mismatch |
| Exposing write tools in v10.0 | Remote session modifying another project's STATE.md, DEBT.md, or skills | All v10.0 tools are read-only; defer write tools to a future milestone after auth design |
| Binding to `0.0.0.0` instead of `127.0.0.1` | Server accessible on LAN; coworkers on same network can query all projects | Explicitly bind to `127.0.0.1` in `server.listen()` |
| Session IDs not cryptographically random | Predictable session IDs can be guessed; attacker can hijack another session's tool responses | Use `crypto.randomUUID()` (built into Node.js 14.17+) — not `Math.random()` or sequential IDs |
| MCP config in version control with internal URLs | `.mcp.json` committed to a public repo exposes internal server addresses | Install to `--scope user` (writes to `~/.claude.json`, not tracked by git) rather than `--scope project` |

---

## "Looks Done But Isn't" Checklist

- [ ] **MCP route:** POST `/mcp` returns valid `InitializeResult` with `Mcp-Session-Id` in response headers — not just HTTP 200
- [ ] **Session routing:** Second Claude Code session can call tools independently while first session's tool calls are still working
- [ ] **CORS:** OPTIONS preflight to `/mcp` includes `POST` and `DELETE` in `Access-Control-Allow-Methods` and `Mcp-Session-Id` in both `Access-Control-Allow-Headers` and `Access-Control-Expose-Headers`
- [ ] **Session cleanup:** DELETE `/mcp` with valid session ID removes it from the Map and calls `transport.close()`
- [ ] **TTL cleanup:** Sessions idle for 2+ hours are removed by the interval scan, verified by checking `sessions.size` before and after the interval fires
- [ ] **CJS compatibility:** `node -e "require('@modelcontextprotocol/sdk/server/mcp.js')"` exits 0 with no error
- [ ] **Tool isolation:** `registerGsdTools(server, cache)` is an exported function callable from tests, not embedded in the HTTP route handler
- [ ] **Installer:** `claude mcp list` shows `gsd-dashboard` with correct URL after running `install.js`
- [ ] **Tool tests:** Each tool handler has at least one unit test using in-memory transport (no HTTP subprocess)
- [ ] **Origin validation:** POST to `/mcp` with `Origin: http://attacker.com` returns 403
- [ ] **Read-only enforcement:** No MCP tool handler calls a write function (cmdStateSet, cmdPhaseComplete, etc.)

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong SDK version installed (v2 ESM-only) | LOW | `npm uninstall @modelcontextprotocol/sdk && npm install @modelcontextprotocol/sdk@1.29.0` |
| Single-instance session collision | HIGH | Architectural rewrite of `/mcp` handler to Map-per-session pattern; all tool definitions remain the same, only routing changes |
| CORS blocking MCP clients | LOW | Update `CORS_HEADERS` constant; no other code changes needed |
| Session Map memory leak | LOW | Add TTL interval cleanup and DELETE handler; no change to tool logic |
| MCP config in wrong file | LOW | Run `claude mcp add gsd-dashboard --transport http --scope user http://localhost:7778/mcp` to register correctly |
| Tool logic untestable (embedded in route handler) | MEDIUM | Extract tool registration to a separate function; update the route handler to call it; update tests to import it directly |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| SDK version (ESM-only v2) | Phase 1 — first step is `npm install @modelcontextprotocol/sdk@1.29.0`; verify CJS require succeeds | `node -e "require('@modelcontextprotocol/sdk/server/mcp.js')"` exits 0 |
| Single shared McpServer instance | Phase 1 — session Map pattern in initial scaffolding | Two concurrent clients both get valid tool responses |
| Missing CORS headers | Phase 1 — update CORS_HEADERS before writing `/mcp` handler | OPTIONS preflight to `/mcp` returns correct Allow-Methods and Allow-Headers |
| Session Map memory leak | Phase 1 — TTL cleanup + session cap in initial implementation | `sessions.size` stays bounded over 24h of use |
| pkce-challenge ESM dependency | Phase 1 — pinned version avoids the affected range | Same node -e require test |
| Claude Code config wrong file | Phase 2 — installer uses `claude mcp add` or writes to correct `~/.claude.json` | `claude mcp list` shows gsd-dashboard after install |
| Origin validation missing | Phase 1 — add before opening to connections | curl with bad Origin returns 403 |
| Subprocess testing | Phase 1 — `registerGsdTools` extracted before any tests written | Unit tests for all 6 tools run in <1 second with no HTTP server |

---

## Sources

- Official MCP Specification (2025-03-26): [Transports — Streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) — session lifecycle, Origin validation requirement, DELETE termination spec, CORS requirements
- SDK Issue #1405 (silent transport overwrite, fixed v1.26.0): [connect() overwrites transport silently](https://github.com/modelcontextprotocol/typescript-sdk/issues/1405)
- SDK Issue #217 (pkce-challenge ESM-only dependency, fixed post-1.7.0): [ESM-only dependency breaks CJS](https://github.com/modelcontextprotocol/typescript-sdk/issues/217)
- SDK Issue #340 (stateless mode validateSession bug, fixed v1.10.1): [stateless mode validateSession failure](https://github.com/modelcontextprotocol/typescript-sdk/issues/340)
- Claude Code Issue #4976 (MCP config file location confusion): [Documentation incorrect about config location](https://github.com/anthropics/claude-code/issues/4976)
- Claude Code Issue #33947 (MCP orphan process accumulation): [MCP server processes not cleaned up on session end](https://github.com/anthropics/claude-code/issues/33947)
- MCPcat CORS Guide: [Implementing CORS Policies for Web-Based MCP Servers](https://mcpcat.io/guides/implementing-cors-policies-web-based-mcp-servers/)
- MCPcat Testing Guide: [Unit Testing MCP Servers](https://mcpcat.io/guides/writing-unit-tests-mcp-servers/)
- Claude Code MCP Docs: [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp)
- Codebase: `get-shit-done/bin/lib/server.cjs` lines 1144-1162 — existing CORS_HEADERS (missing POST, DELETE, Mcp-Session-Id)
- Milestone context: `.planning/v10.0-MILESTONE-CONTEXT.md` — SDK compatibility notes, confirmed CJS support at v1.29.0

---
*Pitfalls research for: v10.0 Shared MCP Dashboard — adding StreamableHTTP MCP endpoints to existing CJS dashboard server*
*Researched: 2026-04-04*
