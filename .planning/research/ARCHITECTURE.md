# Architecture Research — v10.0 MCP Integration

**Domain:** Adding StreamableHTTP MCP endpoints to existing Node.js CJS dashboard server
**Researched:** 2026-04-04
**Confidence:** HIGH — based on direct code inspection of server.cjs, MCP spec, and Azure/MS tutorial confirming CJS import paths

---

## Standard Architecture

### System Overview (After v10.0)

```
Claude Code Sessions (N concurrent)
  |
  | POST/GET/DELETE http://localhost:7778/mcp
  | (each session has mcp-session-id header)
  v
┌─────────────────────────────────────────────────────────────┐
│                  server.cjs  :7778                           │
├─────────────────────────────────────────────────────────────┤
│  Route: /mcp           │  Route: /api/*     │  Static /     │
│  MCP handler           │  Existing API      │  dashboard/   │
│  (POST/GET/DELETE)     │  handlers          │  dist/        │
├────────────────────────┤                    │               │
│  McpServer instance    │  cache (Map)        │               │
│  (created per-req or   │  loadRegistry()    │               │
│   one shared)          │  parseProjectData  │               │
│  6 tool definitions    │  aggregateGateHealth│               │
│  zod input schemas     │  aggregatePatterns │               │
├────────────────────────┴────────────────────┴───────────────┤
│  Shared Infrastructure                                       │
│  chokidar watchers │ SSE clients Set │ WebSocket (ws)        │
│  in-memory cache Map<name, projectData>                      │
│  loadRegistry() → ~/.gsd/dashboard.json                     │
└─────────────────────────────────────────────────────────────┘
             |                    |
    .planning/ files          sessions.jsonl
    per project               gate-executions.jsonl
    (STATE.md, ROADMAP.md,    corrections.jsonl
    gate-executions.jsonl,    skill-metrics.json
    sessions.jsonl, etc.)
```

### Component Responsibilities

| Component | Responsibility | Current State |
|-----------|----------------|---------------|
| `createHttpServer()` | Route dispatch via if/else on method+pathname | Existing — needs `/mcp` branch added |
| `CORS_HEADERS` const | Cross-origin header object | Existing — needs `POST, DELETE` and `mcp-session-id` added |
| MCP route handler | Parse body, delegate to transport, manage session map | **New** |
| `McpServer` instance | Tool registry, protocol lifecycle | **New** |
| `StreamableHTTPServerTransport` | JSON-RPC over HTTP, SSE streaming, session tracking | **New** |
| Session map | `Map<sessionId, transport>` for stateful sessions | **New** — module-scoped |
| Tool implementations | Thin wrappers calling existing server functions | **New** (6 tools) |
| `bin/install.js` | Writes skills/hooks/CLAUDE.md to user projects | Existing — needs `claude mcp add` step added |

---

## Integration Points with server.cjs

### What Changes in server.cjs

Three targeted modifications — no restructuring:

**1. CORS_HEADERS constant (line ~1144)**

Current:
```javascript
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
```

Required (add POST, DELETE, and mcp-session-id):
```javascript
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, mcp-session-id',
  'Access-Control-Expose-Headers': 'mcp-session-id',
};
```

**2. Route handler in createHttpServer() (line ~1175)**

Add before the `serveStatic()` fallback:
```javascript
if (pathname === '/mcp') {
  await handleMcpRequest(req, res, cache, loadRegistry);
  return;
}
```

The `createHttpServer` callback must become `async` to use `await`. This is safe — Node.js HTTP
server handles async callbacks by catching promise rejections via `'uncaughtException'` or
unhandled rejections, but explicit try/catch in the async callback is required.

**3. Body parsing for POST /mcp**

`server.cjs` currently reads bodies only for `PATCH /api/projects/:name/tracking` using
`req.on('data')` streaming. `StreamableHTTPServerTransport.handleRequest()` in CJS accepts
`(req, res, body)` where body is the pre-parsed JSON object.

Pattern used by the Azure tutorial (confirmed working with raw http.createServer):
```javascript
async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : undefined); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}
```

### New MCP Handler Module

The MCP logic should live in a new file `get-shit-done/bin/lib/mcp-server.cjs` (not inlined in
server.cjs) to keep server.cjs focused on routing. This module exports:

- `createMcpServer(cache, loadRegistry)` — builds and returns the McpServer with all 6 tools
- `handleMcpRequest(req, res, cache, loadRegistry)` — stateless per-request handler
- `mcpSessions` Map — module-scoped session store (if stateful mode chosen)

---

## Session Lifecycle

### Stateless Mode (Recommended for v10.0)

Each POST to `/mcp` creates a fresh `StreamableHTTPServerTransport` and `McpServer`. No session
map. Simpler. Claude Code re-initializes every session start — this is fine for read-only tools
that carry no server-side state.

```
POST /mcp (InitializeRequest)
  → new McpServer() + new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  → server.connect(transport)
  → transport.handleRequest(req, res, body)
  → server responds with InitializeResult (no Mcp-Session-Id header)
  → connection closes

POST /mcp (tools/call)
  → new McpServer() + new transport (again)
  → tool executes, returns result
  → connection closes
```

No DELETE handler needed in stateless mode. Server responds 405 if Claude Code sends DELETE.

**Confidence:** HIGH — Confirmed by Azure tutorial code and MCP spec section 5.4.5 ("server MAY
respond with HTTP 405 Method Not Allowed, indicating that the server does not allow clients to
terminate sessions")

### Stateful Mode (Deferred to v10.1 if needed)

If streaming notifications or server-initiated messages are needed later:

```
POST /mcp (InitializeRequest) — no Mcp-Session-Id
  → new McpServer() + new transport with sessionIdGenerator: () => randomUUID()
  → transport.onsessioninitialized = (id) => sessions.set(id, transport)
  → server.connect(transport)
  → transport.handleRequest(req, res, body)
  → server responds with InitializeResult + Mcp-Session-Id: <uuid>

POST /mcp (tools/call) — Mcp-Session-Id: <uuid>
  → sessions.get(sessionId) → existing transport
  → transport.handleRequest(req, res, body)

DELETE /mcp — Mcp-Session-Id: <uuid>
  → sessions.get(sessionId).close()
  → sessions.delete(sessionId)
  → 200 OK
```

---

## MCP Route Handler Structure

```javascript
// get-shit-done/bin/lib/mcp-server.cjs
'use strict';

const { randomUUID } = require('crypto');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } =
  require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');

async function handleMcpRequest(req, res, cache, loadRegistry) {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname !== '/mcp') return false; // not our route

  try {
    const server = new McpServer({ name: 'gsd-dashboard', version: '1.0.0' });
    registerTools(server, cache, loadRegistry);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });

    res.on('close', () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);

    const body = req.method === 'POST' ? await readBody(req) : undefined;
    await transport.handleRequest(req, res, body);
  } catch (err) {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      }));
    }
  }
  return true;
}
```

---

## Data Flow: Cache/Registry to MCP Tools

The 6 MCP tools are thin wrappers over existing server functions. No new data layer.

```
MCP Tool Call
     |
     v
Tool implementation in mcp-server.cjs
     |
     ├── list-projects     → Array.from(cache.values())
     |                        same data as GET /api/projects
     |
     ├── get-project-state → cache.get(name) or loadRegistry() + parseProjectData()
     |                        same data as GET /api/projects/:name
     |
     ├── get-gate-health   → aggregateGateHealth(loadRegistry())
     |                        same function as GET /api/gate-health
     |
     ├── get-observations  → fs.readFileSync(.planning/patterns/<type>.jsonl)
     |                        live file read (not in cache — patterns/ not cached)
     |
     ├── get-sessions      → fs.readFileSync(.planning/patterns/sessions.jsonl)
     |                        live file read, filter by since param
     |
     └── get-skill-metrics → fs.readFileSync(.planning/patterns/skill-metrics.json)
                              live file read (computed output, not streamed)
```

**Cache vs. live-file decision:**
- `list-projects`, `get-project-state`, `get-gate-health`: use cache — already computed, fast,
  acceptable 300ms debounce lag for read-only queries
- `get-observations`, `get-sessions`, `get-skill-metrics`: live file reads — patterns/ directory
  is not cached by server.cjs today; adding cache for these would be a separate concern

---

## Tool Definitions

### list-projects
Input: none  
Output: `Array<{ name, path, health, state, milestones, gateHealth }>`  
Data source: `Array.from(cache.values())`

### get-project-state
Input: `{ name: z.string() }`  
Output: full project data object or `{ error: 'not found' }`  
Data source: `cache.get(name)` (refresh from disk if not found)

### get-gate-health
Input: `{ name: z.string().optional() }`  
Output: aggregated or per-project gate metrics  
Data source: `aggregateGateHealth(registry)` or `getProjectGateHealth(project.path)`

### get-observations
Input: `{ name: z.string(), type: z.enum(['corrections', 'preferences', 'sessions', 'suggestions']) }`  
Output: last N JSONL entries from `.planning/patterns/<type>.jsonl`  
Data source: live file read, parse, return last 50 entries

### get-sessions
Input: `{ name: z.string().optional(), since: z.string().optional() }`  
Output: session summaries from sessions.jsonl  
Data source: live file read, filter by since timestamp

### get-skill-metrics
Input: `{ name: z.string().optional() }`  
Output: skill-metrics.json content (per-skill correction rates)  
Data source: live file read of `.planning/patterns/skill-metrics.json`

---

## Recommended Project Structure

```
get-shit-done/bin/lib/
├── mcp-server.cjs          # New: McpServer, tool defs, handleMcpRequest()
├── server.cjs              # Modified: /mcp route + CORS headers
├── dashboard.cjs           # Unchanged
├── core.cjs                # Unchanged
└── (others unchanged)

bin/
└── install.js              # Modified: add claude mcp add step for Claude runtime

tests/
└── mcp-server.test.cjs     # New: tool handler unit tests
```

---

## Installer Changes

The installer (`bin/install.js`) currently writes skills, hooks, agents, and CLAUDE.md to user
projects. For v10.0 it needs to also configure the MCP connection in the user's Claude Code
runtime.

### How Claude Code stores MCP config (HIGH confidence, confirmed from official docs)

- **User scope** (default): stored in `~/.claude.json` under `mcpServers` key
- **Project scope**: stored in `.mcp.json` at project root, checked into version control
- **CLI to add**: `claude mcp add gsd-dashboard --transport http http://localhost:7778/mcp`
- **Programmatic**: edit `~/.claude.json` directly (JSON file, read/write like settings.json)

### Installer integration pattern

```javascript
// In bin/install.js, after existing Claude runtime install steps:
function installMcpConfig(globalDir, opts = {}) {
  if (opts.noMcp) return; // --no-mcp opt-out

  const claudeJsonPath = path.join(os.homedir(), '.claude.json');
  let config = {};
  try { config = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf-8')); } catch {}

  if (!config.mcpServers) config.mcpServers = {};

  // Idempotent: only add if not present or if URL changed
  config.mcpServers['gsd-dashboard'] = {
    type: 'http',
    url: 'http://localhost:7778/mcp',
  };

  fs.writeFileSync(claudeJsonPath, JSON.stringify(config, null, 2) + '\n');
  console.log('  ✓ Configured GSD dashboard MCP server in ~/.claude.json');
}
```

**Scope decision:** User scope (`~/.claude.json`) is correct for this installer — the MCP
server is device-wide, not project-specific. Project-scoped `.mcp.json` would require every
project repo to contain the config, which is wrong for a local server.

**Opt-out flag:** `--no-mcp` added to installer CLI so users who don't run the dashboard can
skip this step without breaking the install.

---

## CORS Header Requirements for MCP

MCP StreamableHTTP transport has specific CORS requirements beyond what server.cjs currently
provides:

| Header | Current | Required |
|--------|---------|----------|
| `Access-Control-Allow-Methods` | `GET, PATCH, OPTIONS` | + `POST, DELETE` |
| `Access-Control-Allow-Headers` | `Content-Type` | + `mcp-session-id` |
| `Access-Control-Expose-Headers` | (not set) | `mcp-session-id` (so client can read it) |

The MCP spec requires clients to send `Accept: application/json, text/event-stream` — the
server does not need to validate this, but must respond with `Content-Type: text/event-stream`
for SSE responses. The SDK handles `Content-Type` on responses internally.

**Origin validation warning (from MCP spec):** "Servers MUST validate the Origin header on
all incoming connections to prevent DNS rebinding attacks." For a localhost-only server this
risk is minimal — bind to `127.0.0.1` (already done in server.cjs via `--host` option) rather
than `0.0.0.0`. Adding `Origin` header validation is a security hardening step for v10.1.

---

## Architectural Patterns

### Pattern 1: Stateless Per-Request Transport (Primary)

**What:** Create new `McpServer` + `StreamableHTTPServerTransport` on every POST. No session
map. Clean up on `res.close`.

**When to use:** Read-only tools, no server-initiated messages, simplest deployment.

**Trade-offs:** Slightly more object allocation per request. Tool definitions re-registered
each time. Acceptable because tool registration is synchronous and cheap (~microseconds).

### Pattern 2: Module-Scoped Tool Definitions

**What:** Define all 6 tools once at module load time (not inside the handler). The handler
just creates a new server instance and registers the pre-defined tools.

**When to use:** Always — avoids re-parsing zod schemas on every request.

```javascript
const TOOLS = [
  { name: 'list-projects', schema: {}, handler: (args, ctx) => ... },
  // ...
];

function registerTools(server, cache, registry) {
  for (const tool of TOOLS) {
    server.tool(tool.name, tool.schema, (args) => tool.handler(args, { cache, registry }));
  }
}
```

### Pattern 3: Cache-First with Live-File Fallback

**What:** For project-level detail queries, check cache first. If cache miss (project recently
added), fall back to `loadRegistry() + parseProjectData()`.

**When to use:** `get-project-state` tool — cache may not have the project if it was just added.

---

## Build Order

Dependencies between new components:

```
Phase 1: MCP scaffolding on server (no installer changes needed to test)
  1a. Write mcp-server.cjs (McpServer, tool skeletons, handleMcpRequest)
  1b. Modify server.cjs (CORS headers, /mcp route, async handler)
  1c. npm install @modelcontextprotocol/sdk@1.x (add to get-shit-done/package.json)
  1d. Write tests for tool handlers
  Deliverable: `claude mcp add gsd-dashboard --transport http http://localhost:7778/mcp`
               works manually; all 6 tools callable

Phase 2: Auto-configuration via installer
  2a. Add --no-mcp flag parsing to install.js
  2b. Add installMcpConfig() function (read ~/.claude.json, write mcpServers entry)
  2c. Add MCP install step to Claude runtime flow (after hooks/skills)
  2d. Test with fresh install: verify ~/.claude.json updated correctly
  Deliverable: `node bin/install.js --claude --global` configures MCP automatically

Phase 3 (optional): Extended tools
  3a. Additional tools (brainstorm queries, benchmark data, debt queries)
  Deliverable: richer cross-project data access
```

**Phase 1 can be verified immediately** using `claude mcp add` manually — no installer changes
needed to prove the integration works.

---

## Anti-Patterns

### Anti-Pattern 1: Inlining MCP Logic in server.cjs

**What people do:** Add 80+ lines of McpServer code directly into `createHttpServer()`.

**Why it's wrong:** server.cjs is already 500+ lines. MCP logic (tool defs, session map,
body parser) is a distinct concern. Inlining makes it untestable in isolation.

**Do this instead:** New `mcp-server.cjs` module. server.cjs calls `handleMcpRequest()`.

### Anti-Pattern 2: Importing SDK at v2 Alpha

**What people do:** `npm install @modelcontextprotocol/sdk@latest` which may pull in v2 alpha.

**Why it's wrong:** v2 alpha is ESM-only. CJS `require()` of an ESM-only package throws
`ERR_REQUIRE_ESM`. server.cjs and all lib modules are CJS — ESM is incompatible.

**Do this instead:** `npm install @modelcontextprotocol/sdk@1.x` — pin to v1 stable which
ships explicit CJS builds.

### Anti-Pattern 3: Caching patterns/ Files in the Dashboard Cache

**What people do:** Add `sessions.jsonl`, `corrections.jsonl`, etc. to the `cache` Map in
server.cjs alongside project data.

**Why it's wrong:** The cache is project-data shaped (`parseProjectData()` output). JSONL
entries are a different shape. Mixing them in the same Map with different value schemas
makes cache consumers fragile.

**Do this instead:** MCP tool handlers read patterns/ files directly from disk (live reads).
Add a separate patterns cache only if profiling shows file reads are a bottleneck (unlikely).

### Anti-Pattern 4: Using Project-Scoped .mcp.json for a Device-Wide Server

**What people do:** Install `.mcp.json` at the user project root so the dashboard MCP is
configured per-project.

**Why it's wrong:** The dashboard is a device-wide shared server, not a per-project service.
Scoping it to projects means each project repo needs the config, and teams that clone the
repo get an `.mcp.json` pointing to someone else's `localhost:7778`.

**Do this instead:** Write to `~/.claude.json` (user scope). The server is a local daemon,
and the config belongs in user-level Claude Code settings.

### Anti-Pattern 5: Stateful Sessions Without Need

**What people do:** Implement stateful session map (UUID-keyed, transport reuse) for v10.0
read-only tools.

**Why it's wrong:** Stateful sessions add session leak risk (sessions that never receive
DELETE accumulate in memory). Read-only tools don't need to push server-initiated messages,
which is the only reason to maintain a persistent connection.

**Do this instead:** Stateless per-request transport. The SDK's `sessionIdGenerator: undefined`
is the correct config. Session state lives in Claude Code's MCP client, not the server.

---

## Scaling Considerations

| Concern | At current scale (1-5 projects) | At 50 projects | At 500 projects |
|---------|----------------------------------|----------------|-----------------|
| Tool response time | Negligible — cache hits | Negligible — same cache | May need cache eviction |
| Memory | ~0 MB (stateless transport) | ~0 MB | ~0 MB |
| File reads (patterns/) | Fast — small files | Fast | May need caching |
| Concurrent MCP sessions | 1-5 | 1-20 | May need connection limit |

At current scale (1-5 concurrent Claude Code sessions, <10 projects), stateless mode with
direct cache access is sufficient. No scaling changes needed for v10.0.

---

## Integration Points Summary

| Component | Action | New vs. Modified |
|-----------|--------|-----------------|
| `get-shit-done/bin/lib/mcp-server.cjs` | McpServer, 6 tools, handleMcpRequest | **New** |
| `get-shit-done/bin/lib/server.cjs` | CORS headers, `/mcp` route dispatch, async callback | **Modified** |
| `get-shit-done/package.json` | Add `@modelcontextprotocol/sdk@1.x` runtime dep | **Modified** |
| `bin/install.js` | `installMcpConfig()`, `--no-mcp` flag, Claude flow step | **Modified** |
| `tests/mcp-server.test.cjs` | Tool handler unit tests | **New** |

**Not changed:** `dashboard.cjs`, `core.cjs`, `phase.cjs`, `roadmap.cjs`, all hooks, all
workflow files, all agent files, all skills.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| CJS import paths | HIGH | Confirmed: `require('@modelcontextprotocol/sdk/server/mcp.js')` and `server/streamableHttp.js` — Azure tutorial uses these exact paths |
| `handleRequest(req, res, body)` signature | HIGH | Azure tutorial uses this exact 3-arg form; spec confirms POST body must be pre-parsed |
| Stateless mode config | HIGH | `sessionIdGenerator: undefined` — confirmed by SDK README and tutorial |
| CORS changes needed | HIGH | Confirmed from spec (mcp-session-id) and SDK example (exposed headers) |
| `~/.claude.json` as install target | HIGH | Confirmed from official Claude Code MCP docs: user-scoped servers in `~/.claude.json` |
| SDK v1 vs v2 CJS compatibility | HIGH | Milestone context explicitly states v1.29.0 has CJS builds; v2 alpha drops CJS |
| Body parsing approach | MEDIUM | Azure tutorial uses Express (which pre-parses). Raw http.createServer needs manual body read. Pattern confirmed by reading server.cjs PATCH handler which already does manual body streaming. |
| Session map needed for v10.0 | HIGH | No server-initiated messages required for read-only tools → stateless is correct |

---

## Sources

- `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/server.cjs` — direct inspection: CORS_HEADERS (line ~1144), createHttpServer (line ~1150), existing route handlers, PATCH body parsing pattern
- `/Users/tmac/Projects/gsdup/bin/install.js` — direct inspection: settings.json read/write pattern, Claude runtime install flow
- `/Users/tmac/Projects/gsdup/.planning/v10.0-MILESTONE-CONTEXT.md` — SDK version (1.29.0), architecture decisions, tool list
- [MCP Transports Specification (2025-03-26)](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) — authoritative: session lifecycle, POST/GET/DELETE semantics, Mcp-Session-Id header protocol, `sessionIdGenerator: undefined` = stateless
- [Azure App Service MCP Tutorial (Node.js)](https://learn.microsoft.com/en-us/azure/app-service/tutorial-ai-model-context-protocol-server-node) — confirmed: CJS require paths, stateless per-request pattern, `handleRequest(req, res, req.body)` signature
- [Claude Code MCP Docs](https://code.claude.com/docs/en/mcp) — confirmed: `~/.claude.json` for user-scoped servers, `claude mcp add --transport http <name> <url>` command syntax

---

*Architecture research for: v10.0 Shared MCP Dashboard — adding MCP endpoints to existing dashboard server*
*Researched: 2026-04-04*
