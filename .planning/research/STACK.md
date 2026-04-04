# Technology Stack — v10.0 Shared MCP Dashboard

**Project:** GSD — MCP Dashboard Integration milestone
**Researched:** 2026-04-04
**Confidence:** HIGH (SDK exports verified against v1.29.0 tag; pkce-challenge issue verified closed; transport API confirmed against source)

---

## Executive Summary

v10.0 adds MCP server endpoints to the existing `server.cjs` dashboard server. The critical constraint: the dashboard is a CJS Node.js server (`http.createServer`, no framework) and must remain so.

**One new runtime dependency.** `@modelcontextprotocol/sdk@1.29.0` is the only addition. It ships dual CJS/ESM builds, and `StreamableHTTPServerTransport` (the class that handles `/mcp` route integration) accepts Node.js `IncomingMessage` and `ServerResponse` directly — no Express, no Hono, no adapter layer needed by the consumer.

`zod` is already a `devDependency`. The SDK requires `zod: ^3.25 || ^4.0` as a peer dependency, and the existing `zod@^4.3.6` satisfies it. No version conflict.

---

## Stack Additions

### New Runtime Dependency

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@modelcontextprotocol/sdk` | `1.29.0` (pin exact) | MCP server scaffolding, StreamableHTTP transport | Official Anthropic SDK; v1 stable branch; only package that provides `McpServer` + `StreamableHTTPServerTransport` with CJS support |

### No Other New Dependencies

| Capability | How Covered |
|------------|-------------|
| Session ID generation | `node:crypto` built-in (`randomUUID()`) — already available in Node.js 25.x |
| Session state (Map) | In-memory `Map` in `server.cjs` — same pattern as existing cache |
| Tool input validation | `zod` already a devDependency; SDK peer dep satisfied |
| HTTP request handling | `node:http` `IncomingMessage`/`ServerResponse` — already used by `server.cjs` |
| CORS headers | Already implemented in `server.cjs`; add `Mcp-Session-Id` to expose list |

---

## SDK Integration API

### Imports (CJS)

```js
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { randomUUID } = require('node:crypto');
const { z } = require('zod');
```

All four import paths resolve to `dist/cjs/` variants in the SDK's exports map. The wildcard export pattern `(.*)` in the SDK's `package.json` maps `./server/streamableHttp` to `./dist/cjs/server/streamableHttp.js` when `require()` is used.

### StreamableHTTPServerTransport Constructor

```js
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),           // stateful mode
  onsessioninitialized: (sessionId) => {            // callback when session is assigned
    sessions.set(sessionId, transport);
  },
});
```

Setting `sessionIdGenerator: undefined` switches to stateless mode (no session tracking). Use stateful mode for the dashboard — sessions persist while the dashboard is running, matching the existing in-memory cache pattern.

### handleRequest Signature

```js
await transport.handleRequest(req, res, parsedBody);
// req:        http.IncomingMessage (no auth extension needed for localhost)
// res:        http.ServerResponse
// parsedBody: pre-parsed JSON body (object) — parse in route handler before calling
```

The transport internally uses `@hono/node-server` to convert between Node.js HTTP objects and the Web Standard Request/Response that the underlying transport implementation uses. This conversion is transparent to `server.cjs` — the consumer only sees `handleRequest(req, res, body)`.

### Session Map Pattern

```js
// In server.cjs — add alongside existing cache Map
const mcpSessions = new Map(); // sessionId -> { transport, server }

// Route handler for POST /mcp
async function handleMcpRequest(req, res) {
  const sessionId = req.headers['mcp-session-id'];

  if (sessionId && mcpSessions.has(sessionId)) {
    const { transport } = mcpSessions.get(sessionId);
    const body = await parseBody(req);
    await transport.handleRequest(req, res, body);
    return;
  }

  // New session — create transport + McpServer
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      mcpSessions.set(id, { transport, server: mcpServer });
    },
  });
  const body = await parseBody(req);
  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, body);
}
```

### GET and DELETE Routes

The same `/mcp` path handles three HTTP methods:

| Method | Purpose | Handler |
|--------|---------|---------|
| `POST` | Client-to-server messages (initialize, tool calls) | `transport.handleRequest(req, res, body)` |
| `GET` | Server-to-client SSE stream (server-initiated messages) | `transport.handleRequest(req, res)` — no body |
| `DELETE` | Session termination | `transport.handleRequest(req, res)` — no body |

Route these in `server.cjs` by checking `req.method` in the existing `requestHandler` switch block.

### CORS Headers

Add to existing CORS response headers in `server.cjs`:

```js
'Access-Control-Expose-Headers': 'Mcp-Session-Id',
'Access-Control-Allow-Headers': '..., mcp-session-id',
'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
```

### Tool Definition Pattern

```js
const { z } = require('zod');

mcpServer.tool(
  'list-projects',
  'List all registered GSD projects with current state',
  {},                           // no input schema for this tool
  async () => {
    const registry = loadRegistry();
    return {
      content: [{ type: 'text', text: JSON.stringify(registry, null, 2) }],
    };
  }
);

mcpServer.tool(
  'get-project-state',
  'Get STATE.md data for a specific GSD project',
  { name: z.string().describe('Project name from registry') },
  async ({ name }) => {
    const state = getProjectState(name);   // existing server.cjs function
    return {
      content: [{ type: 'text', text: JSON.stringify(state, null, 2) }],
    };
  }
);
```

Tool handlers return `{ content: [{ type: 'text', text: string }] }`. All six planned tools follow this pattern with zod-validated inputs.

---

## Installation

```bash
# Single new runtime dependency (pin exact version — v2 is breaking, ESM-only)
npm install @modelcontextprotocol/sdk@1.29.0

# No other installs needed
# zod already in devDependencies (^4.3.6 satisfies SDK peer dep ^3.25 || ^4.0)
# node:crypto built-in (randomUUID available since Node.js 14.17)
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `@modelcontextprotocol/sdk@1.29.0` | `@modelcontextprotocol/sdk@2.x` (alpha) | v2 is pre-alpha, ESM-only — drops CJS, `package.json` has `"type": "module"`, no `dist/cjs/` — incompatible with `server.cjs` |
| `@modelcontextprotocol/sdk@1.29.0` | Building stdio transport | stdio spawns one process per client session; cannot share data across sessions — fundamentally wrong for this use case |
| Pin exact `1.29.0` | `^1.29.0` | Minor version bumps may introduce breaking changes in an active SDK; pin until v10.0 ships, then evaluate upgrading |
| Stateful session Map | Stateless (no sessionIdGenerator) | Stateless requires clients to re-initialize on every request; the dashboard's in-memory cache only pays off with persistent sessions |
| Raw `http.createServer` | Adding Express | Express is a 5MB framework addition for one route; `server.cjs` already handles routing with `switch(req.url)` — no new framework needed |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@modelcontextprotocol/sdk@2.x` | Pre-alpha, ESM-only, breaking API changes; v2 README says "v1.x remains the recommended version" | `@modelcontextprotocol/sdk@1.29.0` |
| stdio transport | Spawns isolated per-session subprocess; no shared state across Claude Code sessions | StreamableHTTP at `/mcp` |
| `@modelcontextprotocol/node` package | This is a v2 package providing `NodeStreamableHTTPServerTransport`; does not exist as a separate v1 package | `StreamableHTTPServerTransport` from core SDK v1.29.0 |
| `@modelcontextprotocol/express` | v2 package; ESM-only; also unnecessary since the SDK transport handles `IncomingMessage`/`ServerResponse` natively | Direct `handleRequest(req, res, body)` call |
| Bearer token auth / OAuth | Overkill for a localhost-only server; adds the pkce-challenge dependency path that was previously problematic in CJS | No auth for localhost; scope to 127.0.0.1 binding if needed |

---

## CJS Compatibility Notes

**pkce-challenge issue (Issue #217) — resolved.** The SDK had a CJS incompatibility where `auth.js` used synchronous `require()` on `pkce-challenge`, an ESM-only package. This was fixed via PR #254 and merged before v1.29.0. The fix uses dynamic `import()` in `auth.js`.

**Server-only import path avoids auth entirely.** Even if the fix weren't present, `require('@modelcontextprotocol/sdk/server/streamableHttp.js')` does not load `auth.js` — that module is only in the client auth path. The dashboard only uses server-side exports.

**Verified export paths for v1.29.0:**

| Import path | CJS resolution |
|-------------|---------------|
| `@modelcontextprotocol/sdk/server/mcp.js` | `./dist/cjs/server/mcp.js` |
| `@modelcontextprotocol/sdk/server/streamableHttp.js` | `./dist/cjs/server/streamableHttp.js` |
| `@modelcontextprotocol/sdk/types.js` | `./dist/cjs/types.js` |

The wildcard `(.*)` export pattern in the SDK's `package.json` maps these paths correctly when `require()` is detected.

**Transitive dependency note.** The SDK depends on `@hono/node-server@^1.19.9` and `hono@^4.11.4`. These are used internally by `StreamableHTTPServerTransport` to convert between Node.js HTTP objects and Web Standard APIs. They are transparent to `server.cjs` — no Hono APIs are called directly.

---

## Version Compatibility

| Package | Version | Satisfies |
|---------|---------|-----------|
| `@modelcontextprotocol/sdk` | `1.29.0` | zod peer dep: `^3.25 \|\| ^4.0` |
| `zod` (existing devDep) | `^4.3.6` | Satisfies SDK peer dep |
| Node.js | 25.x (current env) | `randomUUID()` available since 14.17; `http.createServer` stable since v0.1 |
| `@hono/node-server` | `^1.19.9` (transitive) | Bundled with SDK; no direct installation needed |

---

## Integration Points in server.cjs

The MCP addition touches `server.cjs` in four places:

1. **Top of file — imports** (~3 lines): `require` McpServer, StreamableHTTPServerTransport, randomUUID
2. **After cache initialization — MCP server setup** (~40 lines): create `McpServer` instance, register 6 tool handlers using existing `loadRegistry()`, `cache.get()`, file read functions
3. **Request router (`switch(req.url)`)** (~30 lines): add `case '/mcp':` branch that checks `req.method` (POST/GET/DELETE) and routes to `handleMcpRequest`
4. **CORS headers** (~5 lines): add `Mcp-Session-Id` to expose and allow headers

The existing `requestHandler` function already switches on `req.url`. The `/mcp` case slots in alongside `/api/projects`, `/api/events`, etc. No restructuring of the server is needed.

**Session cleanup on server shutdown:** Add to the existing SIGTERM/SIGINT handler (or process exit) to close all transports in `mcpSessions` and clear the Map.

---

## Claude Code Connection

After the MCP endpoint is live at `http://localhost:7778/mcp`, Claude Code sessions connect with:

```bash
claude mcp add --transport http gsd-dashboard http://localhost:7778/mcp
```

The installer (`bin/install.js`) will run this command automatically unless `--no-mcp` is passed. The installer already writes to `~/.claude/` for skills and commands — adding an MCP config write follows the same pattern.

---

## Sources

- `@modelcontextprotocol/sdk` v1.29.0 `package.json` (verified via GitHub tag): CJS exports map, `@hono/node-server` dependency, zod peer dep, pkce-challenge@5.0.0 included
- `src/server/streamableHttp.ts` at v1.29.0 tag: `handleRequest(req: IncomingMessage, res: ServerResponse, parsedBody?: unknown)` confirmed; `@hono/node-server` usage for Node.js HTTP conversion confirmed
- GitHub Issue #217 (pkce-challenge CJS incompatibility): closed via PR #254, fixed in client auth path only; server imports unaffected
- GitHub Issue #340 (stateless mode): confirmed `sessionIdGenerator: undefined` enables stateless mode
- `examples/server/src/simpleStreamableHttp.ts` (main branch): Map-based session pattern, `onsessioninitialized` callback, POST/GET/DELETE handler pattern confirmed
- v10.0-MILESTONE-CONTEXT.md: architecture decisions, tool list, estimated scope (~80 lines in server.cjs)
- Live `package.json` inspection: `zod@^4.3.6` confirmed in devDependencies; `ws@^8.19.0` and `chokidar@^4.0.3` confirmed in dependencies

---

*Stack research for: MCP server endpoints on existing CJS Node.js dashboard*
*Researched: 2026-04-04*
