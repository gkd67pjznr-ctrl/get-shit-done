# Feature Research — v10.0 Shared MCP Dashboard

**Domain:** MCP tool endpoints on an existing project-management dashboard server
**Researched:** 2026-04-04
**Confidence:** HIGH — all SDK claims verified against published `@modelcontextprotocol/sdk@1.29.0`
docs and CJS compatibility confirmed. Feature scope derived from existing `server.cjs` functions and
`.planning/` data inventory.

---

## Context

v10.0 adds MCP (Model Context Protocol) tool endpoints to the existing GSD dashboard server
(`get-shit-done/bin/lib/server.cjs`). The server is a long-running shared Node.js process that
already: discovers all registered GSD projects, maintains an in-memory cache of project state,
watches `.planning/` directories for changes, and exposes an HTTP API at `/api/*`.

The MCP route (`/mcp`) is one more handler on the same server. Every Claude Code session that
connects gets access to cross-project data via tool calls — without spawning a new process or
reading foreign project files directly.

**Data inventory already available in `server.cjs` or `.planning/` directories:**

| Data source | File/function | Used by |
|---|---|---|
| Project registry | `loadRegistry()` / `dashboard.json` | All tools |
| Project state | `parseProjectData()` cache | `get-project-state` |
| Gate health | `aggregateGateHealth()` / `getProjectGateHealth()` | `get-gate-health` |
| Sessions (patterns) | `aggregatePatterns()` / `patterns/sessions.jsonl` | `get-sessions` |
| Gate executions | `observations/gate-executions.jsonl` | `get-gate-health` |
| Context7 calls | `observations/context7-calls.jsonl` | `get-gate-health` |
| Corrections | `patterns/corrections.jsonl` | `get-observations` |
| Preferences | `patterns/preferences.jsonl` | `get-observations` |
| Skill metrics | `patterns/skill-metrics.json` | `get-skill-metrics` |
| Skill scores | `patterns/skill-scores.json` | `get-skill-metrics` |
| Phase benchmarks | `patterns/phase-benchmarks.jsonl` | `get-observations` |
| Suggestions | `patterns/suggestions.json` | `get-observations` |

---

## Feature Landscape

### Table Stakes (Claude Code sessions expect these to work)

These are the minimum tools that make the MCP server worth connecting to. Missing any one of them
breaks the core use case: cross-session, cross-project data access.

| Feature | Why Expected | Complexity | Dependencies on server.cjs |
|---|---|---|---|
| `list-projects` tool | Entry point for all other tools. A session must be able to discover what projects exist before querying them. | LOW | `cache.values()` — same data as `handleListProjects()`. Returns name, path, health score, active milestone. |
| `get-project-state` tool | Sessions need to query another project's current phase, status, roadmap progress, and requirements without switching directories. | LOW | `cache.get(name)` returns `parseProjectData()` output including `state`, `roadmap`, `requirements`, `phases_summary`. Already fully computed. |
| `get-gate-health` tool | Gate health is the primary quality signal. A session running in project A should be able to check if project B's gates are passing. | LOW | `getProjectGateHealth(path)` for per-project; `aggregateGateHealth(registry)` for cross-project. Both functions exist. |
| `get-observations` tool | Corrections, preferences, and skill suggestions are the learning loop outputs. Sessions must be able to read another project's patterns without directly accessing its `.planning/` directory. | MEDIUM | No existing aggregator — requires direct JSONL file reads from project paths in registry. Parameterized by `type` (corrections/preferences/suggestions/benchmarks). |
| `get-sessions` tool | Sessions need to know what other sessions recently accomplished — phase completed, plans executed, skills loaded. | MEDIUM | `aggregatePatterns()` gives cross-project session patterns. Per-project sessions require `patterns/sessions.jsonl` reads. |
| `get-skill-metrics` tool | Skill correction rates are actionable cross-project signals — if a skill underperforms in two projects, it needs refinement. | LOW | `patterns/skill-metrics.json` and `patterns/skill-scores.json` exist per project. No aggregation function yet; requires file reads from registered project paths. |
| StreamableHTTP transport at `/mcp` | The transport that enables multiple Claude Code sessions to share one server. Without it, tools can't be reached. | MEDIUM | Requires `@modelcontextprotocol/sdk@1.29.0` (CJS-compatible v1 stable). `StreamableHTTPServerTransport.handleRequest(req, res)` mounts on existing `http.createServer`. |
| CORS headers for MCP | MCP client sends POST and DELETE with `mcp-session-id` header. Current CORS only allows GET and PATCH. | LOW | `CORS_HEADERS` in `createHttpServer()` must add POST, DELETE, and `mcp-session-id` to allowed methods/headers. |
| Auto-configuration via installer | Sessions shouldn't need manual `claude mcp add` commands. The installer should wire the MCP connection when the dashboard is detected. | MEDIUM | `bin/install.js` currently writes to `~/.claude/`. Needs new capability: write to Claude Code MCP config (`~/.claude/mcp.json` or equivalent). |

### Differentiators (What Makes This MCP Server Genuinely Useful)

Features that go beyond "data is accessible" to "data is actionable."

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| Filtered `get-observations` by time window | `since: "7d"` param on corrections/sessions limits results to relevant recent data. Without filtering, long-running projects return thousands of JSONL entries — too large for context window. | LOW | Parse ISO timestamps in JSONL loop, filter by `since` cutoff. No new infrastructure. |
| Aggregated cross-project skill metrics | `get-skill-metrics` with no `name` param returns a merged view across all projects — skills performing poorly everywhere are the highest-priority refinement targets. | MEDIUM | No aggregation function exists. Requires merging `skill-metrics.json` across all registered project paths, deduplicating by skill name, summing correction counts. |
| `--no-mcp` opt-out flag on installer | Power users who don't want Claude Code sessions auto-connecting to the dashboard get a clean opt-out. Without this, the installer becomes a footgun for users with multiple machine profiles or custom MCP configs. | LOW | Conditional branch in `bin/install.js` based on `hasNoMcp` flag. One-time config write. |
| Structured error responses | When a project name is invalid, a JSONL file is missing, or a registry is empty, the tool returns a JSON object with `{ error, code, available_projects }` rather than a bare error string. This lets the calling session handle errors gracefully without prompt-level confusion. | LOW | Standard JSON error shape. No new infrastructure. |
| Tool result pagination or `limit` param | `get-observations` and `get-sessions` accept a `limit: 50` param. Sessions should request only what they need; returning full JSONL dumps wastes context and may exceed MCP payload limits. | LOW | Integer cap on JSONL lines read. Return most-recent N entries (read file, take tail). |
| Phase benchmark comparison tool | `get-benchmarks` returns plan execution durations and correction counts per phase, enabling a session to compare "is this plan taking longer than expected based on similar historical plans?" | MEDIUM | Reads `patterns/phase-benchmarks.jsonl`. No server.cjs function exists yet — requires new file read logic. Lower priority than the 6 core tools. |

### Anti-Features (Avoid These)

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| Write tools (mark phase complete, update state, log corrections from remote) | Sessions want to drive other projects from a central session. | Cross-project writes create race conditions with the local session's file watchers, git state, and roadmap progress tracking. A write from session A into project B's `.planning/` would fight project B's active session. Data integrity cannot be guaranteed without locking, and locking introduces deadlock risk. The PROJECT.md explicitly calls out "file locking for concurrent writes — stale locks from killed sessions worse than no locks" as out of scope. | Read-only in v10.0. If write tools are needed, implement them under project B's own session, not remotely. |
| stdio transport variant | Reduces server coupling — each session runs its own MCP process. | Completely defeats the purpose. stdio spawns a new process per session; sessions can't share the dashboard's in-memory cache or cross-project registry. Each process reads files independently — no benefit over direct file reads. | StreamableHTTP only. |
| Bearer token auth / API keys | Localhost security looks like due diligence. | Localhost-only server with no external exposure doesn't need auth overhead. Adding auth creates a setup friction step that breaks the "zero-config" installer goal. Adding auth also requires key management (where is the token stored? what if it rotates?). | Trust the network boundary. If multi-user machine scenarios arise, scope that as a future security hardening task with a proper threat model. |
| Semantic search / embeddings over corrections | "Find corrections similar to my current problem" is a powerful idea. | Requires an embedding model, a vector store, or an external API call — all of which add binary dependencies, startup latency, and operational complexity. The dashboard server is a lightweight Node.js process. | Keyword filtering via the `type` param on `get-observations` covers 80% of the use case. Full semantic search is a v12+ feature if the need is validated. |
| MCP server as a standalone binary separate from the dashboard | Decouples MCP from dashboard lifecycle. | Means two processes to manage instead of one. The whole point is to piggyback on the dashboard's existing project registry and in-memory cache. A separate binary duplicates all the file-reading logic. | Mount at `/mcp` on the existing server. One process, one cache. |
| Real-time streaming tool results (SSE/WebSocket per tool call) | Live correction feed for a monitoring session. | MCP tool calls are request-response, not streaming. The spec does not define a streaming result type for tools in v1.x. Implementing a fake streaming pattern on top of tool calls would require polling and adds complexity for minimal gain. | The dashboard already has `/api/events` SSE for real-time updates. Direct the browser dashboard at that endpoint. MCP tools for on-demand queries only. |
| 40+ tools mirroring the full gsd-skill-creator MCP server | Comprehensive API surface. | gsd-skill-creator's 6-server, 40+ tool architecture was built for a different product (standalone TypeScript CLI with LLM proxy, trust pipeline, skill lifecycle management). gsdup's use case is 6-8 read-only data access tools on a shared server. Over-engineering the tool count bloats the MCP server's initialization, increases test surface, and makes Claude sessions unsure which tool to call for a given query. | 6-8 tools with clear, non-overlapping responsibilities. |

---

## Feature Dependencies

```
[StreamableHTTP transport at /mcp]
    └──required-by──> ALL tools (no transport = no tools callable)

[loadRegistry() + parseProjectData() cache]
    └──required-by──> list-projects
    └──required-by──> get-project-state
    └──required-by──> get-gate-health (per-project)

[getProjectGateHealth() + aggregateGateHealth()]
    └──required-by──> get-gate-health tool

[JSONL file reads from registered project paths]
    └──required-by──> get-observations (corrections, preferences, suggestions, benchmarks)
    └──required-by──> get-sessions (per-project patterns/sessions.jsonl)
    └──required-by──> get-skill-metrics (per-project skill-metrics.json)

[CORS header update]
    └──required-by──> ALL tools (MCP POST requests blocked without it)

[Aggregated cross-project skill metrics function]
    └──required-by──> get-skill-metrics with no project name (cross-project mode)
    └──depends-on──> JSONL file reads from registered project paths

[Auto-configuration in installer]
    └──enhances──> ALL tools (removes manual setup step)
    └──no-hard-dependency──> tools work without it if user runs `claude mcp add` manually
```

### Dependency Notes

- **StreamableHTTP transport blocks everything:** The transport must be wired before any tool is
  testable. This is Phase 1, step 1.
- **CORS blocks all POST requests:** MCP clients send POST. The current `CORS_HEADERS` only allows
  GET and PATCH. This is a one-line fix but must land in the same phase as the transport.
- **6 core tools are independent of each other** once the transport is up. `list-projects` and
  `get-project-state` are the simplest (cache reads); `get-observations` and `get-skill-metrics`
  require new JSONL read logic but no new server functions.
- **Auto-configuration is independent of tool correctness.** It can ship in Phase 2 after the
  tools are verified to work via manual `claude mcp add`.
- **Cross-project `get-skill-metrics` depends on a new aggregation function** (not in server.cjs
  today). Per-project mode can ship without it.

---

## MVP Definition

### Launch With (v10.0 Phase 1)

Minimum viable MCP server — tools callable, data correct, transport stable.

- [ ] `@modelcontextprotocol/sdk@1.29.0` installed (CJS-compatible v1 stable, not v2 alpha)
- [ ] `StreamableHTTPServerTransport` mounted at `/mcp` on existing `http.createServer`
- [ ] CORS headers updated: POST and DELETE allowed, `mcp-session-id` in allowed headers
- [ ] MCP session management: unique `mcp-session-id` per Claude Code session, session map for
  stateful transports, cleanup on DELETE
- [ ] `list-projects` tool: returns all registered projects with name, path, health score, active
  milestone, gate health summary
- [ ] `get-project-state` tool: returns `state`, `roadmap`, `requirements`, `phases_summary`,
  `debt` for a named project from cache
- [ ] `get-gate-health` tool: returns gate pass/fail/warn/blocked counts; per-project when `name`
  provided, aggregated when omitted
- [ ] `get-observations` tool: reads `.planning/patterns/<type>.jsonl` (corrections, preferences,
  suggestions, benchmarks) for a named project; `limit` param, `since` param
- [ ] `get-sessions` tool: reads `.planning/patterns/sessions.jsonl` for a named project; `limit`
  param; cross-project aggregated patterns when no `name` provided
- [ ] `get-skill-metrics` tool: reads `.planning/patterns/skill-metrics.json` for a named project;
  cross-project merge when no `name` provided
- [ ] Zod input schemas for all 6 tools (zod already a devDep)
- [ ] Structured error responses: `{ error, code, available_projects }` shape on all failure paths
- [ ] Read-only enforcement: no write tools exposed in v10.0

### Add After Validation (v10.0 Phase 2)

After the tools work end-to-end via manual `claude mcp add`:

- [ ] Auto-configuration in `bin/install.js`: detect if dashboard is registered, write MCP
  connection entry to Claude Code MCP config, with `--no-mcp` opt-out flag
- [ ] Tests for MCP tool handlers: unit tests for each tool's handler function; integration test
  that actually sends MCP requests to a running test server
- [ ] `limit` and `since` param validation: reject negative limits, reject malformed ISO dates
  with clear error messages

### Future Consideration (v10.1 or later)

Defer until the 6 core tools are validated in real multi-session usage:

- [ ] `get-benchmarks` tool: dedicated phase benchmark comparison queries (currently covered by
  `get-observations` with `type: benchmarks`)
- [ ] Cross-project skill metric aggregation with trend lines (requires more data from multi-
  project installations)
- [ ] Debt query tool: filter DEBT.md entries by component, severity, and associated correction
  count (depends on v9.0 debt impact analysis data being populated)
- [ ] Write tools: mark a correction resolved, promote a preference — only after read-only mode
  is validated and a concurrency safety model is designed

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| StreamableHTTP transport at `/mcp` | HIGH | MEDIUM | P1 |
| CORS header update | HIGH | LOW | P1 |
| `list-projects` tool | HIGH | LOW | P1 |
| `get-project-state` tool | HIGH | LOW | P1 |
| `get-gate-health` tool | HIGH | LOW | P1 |
| `get-observations` tool | HIGH | MEDIUM | P1 |
| `get-sessions` tool | MEDIUM | MEDIUM | P1 |
| `get-skill-metrics` tool | MEDIUM | LOW | P1 |
| `limit` / `since` params | HIGH | LOW | P1 |
| Structured error responses | MEDIUM | LOW | P1 |
| Auto-configuration in installer | HIGH | MEDIUM | P2 |
| `--no-mcp` opt-out flag | MEDIUM | LOW | P2 |
| Tests for MCP tool handlers | HIGH | MEDIUM | P2 |
| Cross-project skill metric aggregation | MEDIUM | MEDIUM | P3 |
| `get-benchmarks` dedicated tool | LOW | MEDIUM | P3 |
| Write tools | MEDIUM | HIGH | Deferred |
| Semantic search over corrections | LOW | HIGH | Deferred |

**Priority key:**
- P1: Must have for v10.0 Phase 1 (MCP server ships)
- P2: Must have for v10.0 Phase 2 (installer and tests)
- P3: Future milestone

---

## Existing server.cjs Functions Directly Used by Each Tool

This maps each MCP tool to the existing `server.cjs` code it calls. The dependency is on
functions that already exist and are tested — no new data layer required.

| MCP Tool | Existing Functions Called | New Code Required |
|---|---|---|
| `list-projects` | `cache.values()` | Format as MCP result |
| `get-project-state` | `cache.get(name)` | Format as MCP result |
| `get-gate-health` | `getProjectGateHealth(path)`, `aggregateGateHealth(registry)` | Route by `name` param |
| `get-observations` | Direct `fs.readFileSync()` of `patterns/*.jsonl` | JSONL reader with `limit`/`since` |
| `get-sessions` | `aggregatePatterns(registry)` for cross-project; `fs.readFileSync()` of `patterns/sessions.jsonl` for per-project | Route by `name` param |
| `get-skill-metrics` | `fs.readFileSync()` of `patterns/skill-metrics.json` | Per-project read + cross-project merge |
| Transport + session mgmt | `http.createServer` (existing) | `StreamableHTTPServerTransport` wiring, session map |
| CORS update | `CORS_HEADERS` constant | Add POST, DELETE, `mcp-session-id` |

---

## Sources

- `/Users/tmac/Projects/gsdup/.planning/v10.0-MILESTONE-CONTEXT.md` — milestone context with
  confirmed SDK compatibility, transport architecture decision, and initial tool list
- `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/server.cjs` — existing server functions
  inventory (functions: `getProjectGateHealth`, `aggregateGateHealth`, `aggregatePatterns`,
  `parseProjectData`, `loadRegistry`, `handleListProjects`, `handleGetProject`)
- `/Users/tmac/Projects/gsdup/.planning/observations/` and `.planning/patterns/` — data file
  inventory (confirmed files: `gate-executions.jsonl`, `corrections.jsonl`, `sessions.jsonl`,
  `skill-metrics.json`, `skill-scores.json`, `preferences.jsonl`, `phase-benchmarks.jsonl`,
  `suggestions.json`)
- `@modelcontextprotocol/sdk@1.29.0` — CJS compatibility confirmed in milestone context (verified
  against package exports; v2 alpha is ESM-only and explicitly excluded)
- MCP StreamableHTTP transport pattern: `StreamableHTTPServerTransport.handleRequest(req, res)`
  mounts on any `http.createServer` handler (confirmed in milestone context research notes)
- PROJECT.md constraints: "file locking for concurrent writes — stale locks from killed sessions
  worse than no locks" and "real-time inter-session sync — requires always-on daemon" — both
  confirm read-only tool scope for v10.0

---

*Feature research for: MCP tool endpoints on existing GSD dashboard server (v10.0)*
*Researched: 2026-04-04*
