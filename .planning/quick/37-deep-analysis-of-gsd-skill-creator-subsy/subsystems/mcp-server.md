# MCP Server

## What It Is

The MCP server is gsd-skill-creator's implementation of the Model Context Protocol, exposing skill-creator capabilities — and by extension GSD project state — as tools that any MCP-compatible AI client can query. It lives in `src/mcp/` (~28 files total, 22 compiled artifacts in `dist/`) and is the mechanism by which gsd-skill-creator becomes a participant in a broader ecosystem of interoperable AI tooling, not just a standalone CLI.

## How It Works

The server is split across six logical server types, each handling a different concern:

- **Skill Creator server** — core CRUD operations for skills: list, read, create, validate, refine.
- **Skill Lifecycle server** — tracks skill state transitions (draft → active → retired) and exposes lifecycle events as MCP tool calls.
- **Gateway server** — routes incoming MCP requests to the appropriate sub-server based on the tool namespace.
- **SCOUT server** — exposes observability data: session history, correction logs, gate-execution records.
- **VERIFY server** — exposes verification results, gate pass/fail status, and phase completion signals.
- **LLM Wrapper server** — wraps Anthropic API calls with skill-aware context injection, allowing MCP clients to invoke LLM completions pre-loaded with relevant skills.

Transport is stdio-based (the MCP SDK default), meaning the server is launched as a subprocess and communicates via JSON-RPC 2.0 over stdin/stdout. The `@modelcontextprotocol/sdk` package handles message framing, capability negotiation, and error enveloping. Each tool is defined with a Zod schema for input validation. The Gateway server acts as a multiplexer: it reads the tool name prefix (e.g., `skill_creator.*`, `scout.*`) and forwards the call to the matching sub-server process.

Data flow: MCP client → Gateway (stdin/stdout) → routes to sub-server → sub-server reads `.planning/` files or `src/` skill data → returns structured JSON result → Gateway wraps in MCP response envelope → MCP client receives tool result.

## Integration Verdict for gsdup

**Integrate**

The MCP server is the highest-value integration target for gsdup. v9.0 Signal Intelligence already flags MCP server selection intelligence as in scope, and the logical complement is gsdup acting as an MCP server itself — exposing phase status, gate results, skill metrics, and session data to any MCP client. The integration effort is M: requires adding `@modelcontextprotocol/sdk`, scaffolding a CJS-compatible server entry point, and mapping GSD commands to MCP tool definitions. The existing `server.cjs` and `ws` infrastructure provide a foundation. The gsd-skill-creator pattern (Gateway → sub-servers) can be simplified to a single-server model for gsdup's narrower surface area.

## Action Items

1. Add `@modelcontextprotocol/sdk` as a dependency in `package.json` and verify it works with the existing CJS module structure.
2. Scaffold `get-shit-done/bin/lib/mcp-server.cjs` with a single server exposing tools for `phase_status`, `gate_results`, `session_data`, and `skill_metrics`.
3. Add a `mcp` CLI subcommand to `gsd-tools.cjs` that starts the MCP server process on a configurable stdio or TCP transport.
4. Write a v9.0 phase plan for MCP server scaffolding, linking to the existing v9.0 roadmap MCP entry.
