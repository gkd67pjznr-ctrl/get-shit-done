'use strict';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');

// Allowed origins for DNS rebinding protection (MCP spec requirement)
const ALLOWED_ORIGINS = new Set([
  'http://localhost:7778',
  'http://127.0.0.1:7778',
]);

/**
 * Parse the request body as JSON. Returns undefined for non-POST or empty bodies.
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<object|undefined>}
 */
async function readBody(req) {
  if (req.method !== 'POST') return undefined;
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : undefined);
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Register all 8 GSD query tools on an McpServer instance.
 * cache is the Map<name, projectData> from server.cjs.
 * loadRegistry is the function from dashboard.cjs.
 *
 * @param {McpServer} server
 * @param {Map<string, object>} cache
 * @param {Function} loadRegistry
 */
function registerGsdTools(server, cache, loadRegistry) {
  server.tool(
    'list-projects',
    'Return all registered GSD projects with health and state summary',
    {},
    async () => ({ content: [{ type: 'text', text: 'TODO' }] })
  );

  server.tool(
    'get-project-state',
    'Return STATE.md data and project detail for a named project',
    { name: z.string().describe('Project name as registered in the dashboard') },
    async () => ({ content: [{ type: 'text', text: 'TODO' }] })
  );

  server.tool(
    'get-gate-health',
    'Return gate pass/fail metrics, per-project or aggregated',
    { name: z.string().optional().describe('Project name (omit for aggregated)') },
    async () => ({ content: [{ type: 'text', text: 'TODO' }] })
  );

  server.tool(
    'get-observations',
    'Return corrections, preferences, or session entries from a project',
    {
      name: z.string().describe('Project name'),
      type: z.enum(['corrections', 'preferences', 'sessions', 'suggestions']).describe('Observation type'),
      limit: z.number().int().positive().optional().default(50).describe('Max entries to return'),
      since: z.string().optional().describe('ISO 8601 timestamp — only return entries after this time'),
    },
    async () => ({ content: [{ type: 'text', text: 'TODO' }] })
  );

  server.tool(
    'get-sessions',
    'Return recent session summaries, per-project or cross-project',
    {
      name: z.string().optional().describe('Project name (omit for all projects)'),
      since: z.string().optional().describe('ISO 8601 timestamp filter'),
      limit: z.number().int().positive().optional().default(20).describe('Max sessions to return'),
    },
    async () => ({ content: [{ type: 'text', text: 'TODO' }] })
  );

  server.tool(
    'get-skill-metrics',
    'Return per-skill correction rates for a project',
    { name: z.string().optional().describe('Project name (omit for all projects)') },
    async () => ({ content: [{ type: 'text', text: 'TODO' }] })
  );

  server.tool(
    'get-cost-metrics',
    'Return session token usage and cost data',
    {
      name: z.string().optional().describe('Project name (omit for all projects)'),
      since: z.string().optional().describe('ISO 8601 timestamp filter'),
    },
    async () => ({ content: [{ type: 'text', text: 'TODO' }] })
  );

  server.tool(
    'get-git-status',
    'Return current branch, dirty files, and recent commits for a project',
    { name: z.string().describe('Project name') },
    async () => ({ content: [{ type: 'text', text: 'TODO' }] })
  );
}

/**
 * Handle all HTTP requests to /mcp.
 * Stateless per-request transport: creates new McpServer + transport on every POST.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {Map<string, object>} cache
 * @param {Function} loadRegistry
 * @returns {Promise<boolean>} true if the request was handled, false otherwise
 */
async function handleMcpRequest(req, res, cache, loadRegistry) {
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    return false;
  }
  if (url.pathname !== '/mcp') return false;

  // Origin validation — MCP spec requires this to prevent DNS rebinding attacks
  const origin = req.headers['origin'];
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden: invalid origin');
    return true;
  }

  try {
    const server = new McpServer({ name: 'gsd-dashboard', version: '1.0.0' });
    registerGsdTools(server, cache, loadRegistry);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless per-request mode
    });

    res.on('close', () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);

    const body = await readBody(req);
    await transport.handleRequest(req, res, body);
  } catch (err) {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error: ' + (err.message || String(err)) },
        id: null,
      }));
    }
  }

  return true;
}

module.exports = { handleMcpRequest, registerGsdTools };
