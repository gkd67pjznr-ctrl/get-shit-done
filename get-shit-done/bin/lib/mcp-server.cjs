'use strict';

const fs = require('fs');
const path = require('path');
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
 * Read gate health for a single project path.
 * Returns { totalExecutions, outcomes, gates } or null if no data.
 */
function readProjectGateHealth(projectPath) {
  const gateFile = path.join(projectPath, '.planning', 'observations', 'gate-executions.jsonl');
  const VALID_GATES = ['codebase_scan', 'context7_lookup', 'test_baseline', 'test_gate', 'diff_review'];
  const VALID_OUTCOMES = ['passed', 'warned', 'blocked', 'skipped'];
  const outcomes = { passed: 0, warned: 0, blocked: 0, skipped: 0 };
  const gates = {};
  for (const g of VALID_GATES) gates[g] = { total: 0, passed: 0, warned: 0, blocked: 0, skipped: 0 };
  let totalExecutions = 0;

  let lines;
  try {
    lines = fs.readFileSync(gateFile, 'utf-8').trim().split('\n').filter(Boolean);
  } catch {
    return null;
  }

  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (!VALID_GATES.includes(entry.gate) || !VALID_OUTCOMES.includes(entry.outcome)) continue;
    outcomes[entry.outcome]++;
    gates[entry.gate].total++;
    gates[entry.gate][entry.outcome]++;
    totalExecutions++;
  }

  return { totalExecutions, outcomes, gates };
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
    async () => {
      const projects = Array.from(cache.values()).map(p => ({
        name: p.name,
        path: p.path,
        health: p.health ?? null,
        tracking: p.tracking !== false,
        current_phase: p.state?.current_phase ?? null,
        status: p.state?.status ?? null,
        milestone_count: Array.isArray(p.milestones) ? p.milestones.length : 0,
      }));
      return { content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }] };
    }
  );

  server.tool(
    'get-project-state',
    'Return STATE.md data and project detail for a named project',
    { name: z.string().describe('Project name as registered in the dashboard') },
    async ({ name }) => {
      const project = cache.get(name);
      if (!project) {
        const available = Array.from(cache.keys()).sort();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: 'Project not found', code: 'NOT_FOUND', available_projects: available }),
          }],
        };
      }
      return { content: [{ type: 'text', text: JSON.stringify(project, null, 2) }] };
    }
  );

  server.tool(
    'get-gate-health',
    'Return gate pass/fail metrics, per-project or aggregated',
    { name: z.string().optional().describe('Project name (omit for aggregated across all projects)') },
    async ({ name } = {}) => {
      if (name) {
        const project = cache.get(name);
        if (!project) {
          const available = Array.from(cache.keys()).sort();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ error: 'Project not found', code: 'NOT_FOUND', available_projects: available }),
            }],
          };
        }
        const health = readProjectGateHealth(project.path);
        return { content: [{ type: 'text', text: JSON.stringify({ name, ...health }) }] };
      }

      // Aggregate across all projects
      const projects = Array.from(cache.values());
      const VALID_GATES = ['codebase_scan', 'context7_lookup', 'test_baseline', 'test_gate', 'diff_review'];
      const VALID_OUTCOMES = ['passed', 'warned', 'blocked', 'skipped'];
      const totals = { passed: 0, warned: 0, blocked: 0, skipped: 0 };
      const gates = {};
      for (const g of VALID_GATES) gates[g] = { total: 0, passed: 0, warned: 0, blocked: 0, skipped: 0 };
      let totalExecutions = 0;

      for (const p of projects) {
        const h = readProjectGateHealth(p.path);
        if (!h) continue;
        totalExecutions += h.totalExecutions;
        for (const o of VALID_OUTCOMES) totals[o] += h.outcomes[o];
        for (const g of VALID_GATES) {
          gates[g].total += h.gates[g].total;
          for (const o of VALID_OUTCOMES) gates[g][o] += h.gates[g][o];
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ projectCount: projects.length, totalExecutions, outcomes: totals, gates }),
        }],
      };
    }
  );

  server.tool(
    'get-observations',
    'Return corrections, preferences, or session entries from a project',
    {
      name: z.string().describe('Project name'),
      type: z.enum(['corrections', 'preferences', 'sessions', 'suggestions']).describe('Observation type'),
      limit: z.number().int().positive().optional().describe('Max entries to return (default 50)'),
      since: z.string().optional().describe('ISO 8601 timestamp — only return entries after this time'),
    },
    async ({ name, type, limit = 50, since }) => {
      const project = cache.get(name);
      if (!project) {
        const available = Array.from(cache.keys()).sort();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: 'Project not found', code: 'NOT_FOUND', available_projects: available }),
          }],
        };
      }

      const filePath = path.join(project.path, '.planning', 'patterns', type + '.jsonl');
      let entries = [];
      try {
        const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n').filter(Boolean);
        for (const line of lines) {
          try { entries.push(JSON.parse(line)); } catch { /* skip malformed */ }
        }
      } catch {
        // File doesn't exist — return empty
      }

      // Apply since filter
      if (since) {
        entries = entries.filter(e => {
          const ts = e.timestamp || e.last_correction_ts || e.created_at;
          return ts && ts >= since;
        });
      }

      // Return last N entries
      const result = entries.slice(-limit);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ name, type, count: result.length, total: entries.length, entries: result }),
        }],
      };
    }
  );

  server.tool(
    'get-sessions',
    'Return recent session summaries, per-project or cross-project',
    {
      name: z.string().optional().describe('Project name (omit for all projects)'),
      since: z.string().optional().describe('ISO 8601 timestamp filter'),
      limit: z.number().int().positive().optional().describe('Max sessions to return (default 20)'),
    },
    async ({ name, since, limit = 20 } = {}) => {
      const projectList = name
        ? (() => {
            const p = cache.get(name);
            if (!p) return null;
            return [p];
          })()
        : Array.from(cache.values());

      if (projectList === null) {
        const available = Array.from(cache.keys()).sort();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: 'Project not found', code: 'NOT_FOUND', available_projects: available }),
          }],
        };
      }

      const allSessions = [];
      for (const project of projectList) {
        const filePath = path.join(project.path, '.planning', 'patterns', 'sessions.jsonl');
        try {
          const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              entry._project = project.name;
              allSessions.push(entry);
            } catch { /* skip malformed */ }
          }
        } catch { /* no sessions.jsonl */ }
      }

      let filtered = since
        ? allSessions.filter(e => {
            const ts = e.timestamp || e.started_at;
            return ts && ts >= since;
          })
        : allSessions;

      filtered.sort((a, b) => {
        const ta = a.timestamp || a.started_at || '';
        const tb = b.timestamp || b.started_at || '';
        return tb.localeCompare(ta);
      });

      const result = filtered.slice(0, limit);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ count: result.length, total: filtered.length, sessions: result }),
        }],
      };
    }
  );

  server.tool(
    'get-skill-metrics',
    'Return per-skill correction rates for a project or all projects',
    { name: z.string().optional().describe('Project name (omit for all projects)') },
    async ({ name } = {}) => {
      const projectList = name
        ? (() => {
            const p = cache.get(name);
            if (!p) return null;
            return [p];
          })()
        : Array.from(cache.values());

      if (projectList === null) {
        const available = Array.from(cache.keys()).sort();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: 'Project not found', code: 'NOT_FOUND', available_projects: available }),
          }],
        };
      }

      const merged = {};
      for (const project of projectList) {
        const filePath = path.join(project.path, '.planning', 'patterns', 'skill-metrics.json');
        try {
          const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          for (const [skill, data] of Object.entries(raw)) {
            if (!merged[skill]) {
              merged[skill] = { ...data, _projects: [project.name] };
            } else {
              for (const [k, v] of Object.entries(data)) {
                if (typeof v === 'number') merged[skill][k] = (merged[skill][k] || 0) + v;
              }
              merged[skill]._projects.push(project.name);
            }
          }
        } catch { /* no skill-metrics.json for this project */ }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ projectCount: projectList.length, skills: merged }),
        }],
      };
    }
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
