'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const chokidar = require('chokidar');

const { resolveActiveMilestone, planningRoot } = require('./core.cjs');
const { loadRegistry, getDashboardPath } = require('./dashboard.cjs');

// ─── Markdown parsing helpers ─────────────────────────────────────────────────

function parseStateFile(content) {
  try {
    const lines = content.split('\n');
    let current_phase = null;
    let status = null;
    let progress = null;
    let last_activity = null;

    for (const line of lines) {
      if (!current_phase) {
        const phaseMatch = line.match(/Phase:\s*(\S+)/);
        if (phaseMatch) current_phase = phaseMatch[1];
      }
      if (!status) {
        const statusMatch = line.match(/^Status:\s*(.+)$/m);
        if (statusMatch) status = statusMatch[1].trim();
      }
      if (!progress) {
        const progressMatch = line.match(/\[[\u2588\u2591░█▓▒░\s]+\]\s*[\d.]+%|\[[\u2588\u2591░█▓▒░\s]+\]/);
        if (progressMatch) progress = line.trim();
      }
      if (!last_activity) {
        const actMatch = line.match(/Last activity:\s*(.+)$/);
        if (actMatch) last_activity = actMatch[1].trim();
      }
    }

    // Second pass for status if not found yet
    if (!status) {
      const statusMatch = content.match(/^Status:\s*(.+)$/m);
      if (statusMatch) status = statusMatch[1].trim();
    }

    return { current_phase, status, progress, last_activity };
  } catch {
    return null;
  }
}

function parseRoadmapFile(content) {
  try {
    const phases = [];
    const lines = content.split('\n');
    for (const line of lines) {
      // Match: - [x] Phase 01 - Name or - [ ] 01: Name
      const checkMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
      if (checkMatch) {
        const done = checkMatch[1].trim().toLowerCase() === 'x';
        const rest = checkMatch[2].trim();
        // Extract phase number if present
        const numMatch = rest.match(/^(?:Phase\s+)?(\d+)[\s:-]+(.+)$/i);
        if (numMatch) {
          phases.push({ number: numMatch[1], name: numMatch[2].trim(), status: done ? 'complete' : 'pending', goal: null });
        } else {
          phases.push({ number: null, name: rest, status: done ? 'complete' : 'pending', goal: null });
        }
      }
    }
    return { phases };
  } catch {
    return null;
  }
}

function parseRequirementsFile(content) {
  try {
    let complete = 0;
    let pending = 0;
    const lines = content.split('\n');
    for (const line of lines) {
      if (/^[-*]\s+\[[xX]\]/.test(line)) complete++;
      else if (/^[-*]\s+\[ \]/.test(line)) pending++;
    }
    return { total: complete + pending, complete, pending };
  } catch {
    return null;
  }
}

function parseDebtFile(content) {
  try {
    let open = 0;
    let resolved = 0;
    const lines = content.split('\n');
    for (const line of lines) {
      if (/\|\s*open\s*\|/i.test(line)) open++;
      else if (/\|\s*resolved\s*\|/i.test(line)) resolved++;
    }
    return { open, resolved };
  } catch {
    return null;
  }
}

function scanPhasesSummary(phasesDir) {
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const result = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const phaseDir = path.join(phasesDir, entry.name);
      let plan_count = 0;
      try {
        const files = fs.readdirSync(phaseDir);
        plan_count = files.filter(f => f.endsWith('-PLAN.md')).length;
      } catch { /* skip */ }
      result.push({ name: entry.name, plan_count });
    }
    return result;
  } catch {
    return [];
  }
}

// ─── Multi-milestone aggregation ─────────────────────────────────────────────

function parseAllMilestones(projectPath) {
  try {
    const milestonesDir = path.join(projectPath, '.planning', 'milestones');
    let dirs;
    try {
      dirs = fs.readdirSync(milestonesDir, { withFileTypes: true });
    } catch {
      return [];
    }

    const milestoneEntries = dirs
      .filter(d => d.isDirectory() && /^v\d/.test(d.name))
      .sort((a, b) => a.name.localeCompare(b.name));

    let activeMilestone = null;
    try {
      activeMilestone = resolveActiveMilestone(projectPath);
    } catch { /* leave null */ }

    const result = [];
    for (const dir of milestoneEntries) {
      const milestoneRoot = path.join(milestonesDir, dir.name);
      const entry = {
        name: dir.name,
        active: dir.name === activeMilestone,
        state: null,
        roadmap: null,
        requirements: null,
        phases_summary: [],
      };

      try {
        const stateContent = fs.readFileSync(path.join(milestoneRoot, 'STATE.md'), 'utf-8');
        entry.state = parseStateFile(stateContent);
      } catch { /* leave null */ }

      try {
        const roadmapContent = fs.readFileSync(path.join(milestoneRoot, 'ROADMAP.md'), 'utf-8');
        entry.roadmap = parseRoadmapFile(roadmapContent);
      } catch { /* leave null */ }

      try {
        const reqContent = fs.readFileSync(path.join(milestoneRoot, 'REQUIREMENTS.md'), 'utf-8');
        entry.requirements = parseRequirementsFile(reqContent);
      } catch { /* leave null */ }

      try {
        const phasesDir = path.join(milestoneRoot, 'phases');
        entry.phases_summary = scanPhasesSummary(phasesDir);
      } catch { /* leave [] */ }

      result.push(entry);
    }
    return result;
  } catch {
    return [];
  }
}

// ─── Core data aggregation ────────────────────────────────────────────────────

function parseProjectData(project) {
  let state = null;
  let roadmap = null;
  let requirements = null;
  let config = null;
  let debt = null;
  let phases_summary = [];

  try {
    const activeMilestone = resolveActiveMilestone(project.path);
    const root = planningRoot(project.path, activeMilestone);

    try {
      const stateContent = fs.readFileSync(path.join(root, 'STATE.md'), 'utf-8');
      state = parseStateFile(stateContent);
    } catch { state = null; }

    try {
      const roadmapContent = fs.readFileSync(path.join(root, 'ROADMAP.md'), 'utf-8');
      roadmap = parseRoadmapFile(roadmapContent);
    } catch { roadmap = null; }

    try {
      const reqContent = fs.readFileSync(path.join(root, 'REQUIREMENTS.md'), 'utf-8');
      requirements = parseRequirementsFile(reqContent);
    } catch { requirements = null; }

    try {
      const cfgContent = fs.readFileSync(path.join(root, 'config.json'), 'utf-8');
      config = JSON.parse(cfgContent);
    } catch { config = null; }

    try {
      const debtContent = fs.readFileSync(path.join(root, 'DEBT.md'), 'utf-8');
      debt = parseDebtFile(debtContent);
    } catch { debt = null; }

    try {
      const phasesDir = path.join(root, 'phases');
      phases_summary = scanPhasesSummary(phasesDir);
    } catch { phases_summary = []; }
  } catch { /* project path unresolvable */ }

  const milestones = parseAllMilestones(project.path);

  return {
    name: project.name,
    display_name: project.display_name,
    path: project.path,
    added: project.added,
    state,
    roadmap,
    requirements,
    config,
    debt,
    phases_summary,
    milestones,
    parsed_at: new Date().toISOString(),
  };
}

// ─── SSE formatting ───────────────────────────────────────────────────────────

function formatSSE(eventType, data) {
  return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
}

function broadcast(clients, eventType, data) {
  const msg = formatSSE(eventType, data);
  for (const client of Array.from(clients)) {
    try {
      client.write(msg);
    } catch {
      clients.delete(client);
    }
  }
}

// ─── HTTP handlers ────────────────────────────────────────────────────────────

function handleSSE(req, res, clients) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write(':ok\n\n');
  clients.add(res);
  req.on('close', () => { clients.delete(res); });
}

function handleListProjects(res, cache) {
  const data = JSON.stringify(Array.from(cache.values()));
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(data);
}

function handleGetProject(res, cache, name) {
  const project = cache.get(name);
  if (!project) {
    res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(project));
}

// ─── HTTP server ──────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function createHttpServer(port, cache, clients) {
  const server = http.createServer((req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    // Add CORS headers to all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad request' }));
      return;
    }

    const { pathname } = url;

    if (req.method === 'GET' && pathname === '/api/projects') {
      handleListProjects(res, cache);
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/api/projects/')) {
      const name = pathname.slice('/api/projects/'.length);
      if (name && !name.includes('/')) {
        handleGetProject(res, cache, decodeURIComponent(name));
        return;
      }
    }

    if (req.method === 'GET' && pathname === '/api/events') {
      handleSSE(req, res, clients);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  return server;
}

// ─── File watching ────────────────────────────────────────────────────────────

function watchProject(project, cache, clients, watchers, debounceTimers) {
  const planningDir = path.join(project.path, '.planning');

  if (!fs.existsSync(planningDir)) {
    console.warn('[gsd-server] Skipping missing path: ' + planningDir);
    return null;
  }

  const watcher = chokidar.watch(planningDir, {
    persistent: true,
    ignoreInitial: true,
    depth: 99,
  });

  watcher.on('all', () => {
    // Clear existing debounce timer for this project
    const existing = debounceTimers.get(project.name);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      debounceTimers.delete(project.name);
      try {
        const data = parseProjectData(project);
        cache.set(project.name, data);
        broadcast(clients, 'project-update', data);
      } catch (err) {
        console.warn('[gsd-server] Error refreshing project data for ' + project.name + ': ' + err.message);
      }
    }, 300);

    debounceTimers.set(project.name, timer);
  });

  watchers.set(project.name, watcher);
  return watcher;
}

function watchRegistry(cache, watchers, clients, debounceTimers, opts = {}) {
  // Use gsdHome override if provided
  const registryPath = opts.gsdHome
    ? path.join(opts.gsdHome, 'dashboard.json')
    : getDashboardPath();

  if (!fs.existsSync(registryPath)) {
    // Watch the parent directory for the file to appear
    const dir = path.dirname(registryPath);
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  }

  // Ensure the file exists before watching
  try {
    if (!fs.existsSync(registryPath)) {
      fs.writeFileSync(registryPath, JSON.stringify({ projects: [] }, null, 2), 'utf-8');
    }
  } catch {}

  const watcher = chokidar.watch(registryPath, {
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on('all', () => {
    function tryLoad(retries) {
      try {
        const raw = fs.readFileSync(registryPath, 'utf-8');
        const data = JSON.parse(raw);
        const newProjects = Array.isArray(data.projects) ? data.projects : [];

        const currentNames = new Set(cache.keys());
        const newNames = new Set(newProjects.map(p => p.name));

        // Detect additions
        for (const p of newProjects) {
          if (!currentNames.has(p.name)) {
            try {
              const parsed = parseProjectData(p);
              cache.set(p.name, parsed);
              watchProject(p, cache, clients, watchers, debounceTimers);
              broadcast(clients, 'project-added', parsed);
            } catch (err) {
              console.warn('[gsd-server] Error adding project ' + p.name + ': ' + err.message);
            }
          }
        }

        // Detect removals
        for (const name of currentNames) {
          if (!newNames.has(name)) {
            cache.delete(name);
            const w = watchers.get(name);
            if (w) {
              w.close().catch(() => {});
              watchers.delete(name);
            }
            broadcast(clients, 'project-removed', { name });
          }
        }
      } catch (err) {
        // Retry once after 100ms on JSON parse failure (partial write)
        if (retries > 0) {
          setTimeout(() => tryLoad(retries - 1), 100);
        } else {
          console.warn('[gsd-server] Failed to reload registry: ' + err.message);
        }
      }
    }
    tryLoad(1);
  });

  return watcher;
}

// ─── Port conflict detection and takeover ─────────────────────────────────────

function tryTakeoverPort(port, server, cache, clients, watchers, debounceTimers) {
  // Try GET /api/projects on the port to detect if it's another gsd-server
  const req = http.get(`http://localhost:${port}/api/projects`, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      let isGsdServer = false;
      try {
        const parsed = JSON.parse(body);
        // Our server returns an Array from /api/projects
        isGsdServer = Array.isArray(parsed);
      } catch {}

      if (isGsdServer) {
        console.log(`[gsd-server] Detected another gsd server on port ${port}. Taking over...`);
        // Kill the process holding the port
        try {
          const { execSync } = require('child_process');
          // lsof -ti :PORT returns PIDs using the port; kill them
          const pids = execSync(`lsof -ti :${port}`, { encoding: 'utf-8' }).trim();
          if (pids) {
            execSync(`kill -9 ${pids.split('\n').join(' ')}`);
          }
        } catch (killErr) {
          if (killErr.message && killErr.message.includes('lsof')) {
            console.error('[gsd-server] Port takeover failed: lsof not available on this platform. Use --port to choose a different port.');
          } else {
            console.error('[gsd-server] Failed to kill existing process:', killErr.message);
          }
          process.exit(1);
        }
        // Wait 500ms and retry listen
        setTimeout(() => {
          server.listen(port, 'localhost', () => {
            console.log(`[gsd-server] Dashboard server running at http://localhost:${port}`);
          });
        }, 500);
      } else {
        console.error(`[gsd-server] Port ${port} is in use by another process. Use --port to choose a different port.`);
        process.exit(1);
      }
    });
  });

  req.on('error', () => {
    // Port is in use but not responding as HTTP -- not our server
    console.error(`[gsd-server] Port ${port} is in use by another process. Use --port to choose a different port.`);
    process.exit(1);
  });

  req.setTimeout(1000, () => {
    req.destroy();
    console.error(`[gsd-server] Port ${port} is in use by another process. Use --port to choose a different port.`);
    process.exit(1);
  });
}

// ─── Main entry point ─────────────────────────────────────────────────────────

function startDashboardServer(port, opts = {}) {
  // Support gsdHome override for test isolation
  if (opts.gsdHome) {
    process.env.GSD_HOME = opts.gsdHome;
  }

  const clients = new Set();
  const cache = new Map();
  const watchers = new Map();
  const debounceTimers = new Map();

  // Load initial registry
  let projects = [];
  try {
    if (opts.gsdHome) {
      // Load from override path directly
      const registryPath = path.join(opts.gsdHome, 'dashboard.json');
      try {
        const raw = fs.readFileSync(registryPath, 'utf-8');
        const data = JSON.parse(raw);
        projects = Array.isArray(data.projects) ? data.projects : [];
      } catch {
        projects = [];
      }
    } else {
      projects = loadRegistry();
    }
  } catch {
    projects = [];
  }

  // Parse initial data for each project and set up file watchers
  for (const project of projects) {
    try {
      const data = parseProjectData(project);
      cache.set(project.name, data);
    } catch (err) {
      console.warn('[gsd-server] Error parsing initial data for ' + project.name + ': ' + err.message);
    }
    watchProject(project, cache, clients, watchers, debounceTimers);
  }

  // Start registry watcher
  const registryWatcher = watchRegistry(cache, watchers, clients, debounceTimers, opts);

  // Create and start HTTP server
  const server = createHttpServer(port, cache, clients);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      tryTakeoverPort(port, server, cache, clients, watchers, debounceTimers);
    } else {
      console.error('[gsd-server] Fatal error:', err.message);
      process.exit(1);
    }
  });

  server.listen(port, 'localhost', () => {
    console.log('[gsd-server] Dashboard server running at http://localhost:' + port);
  });

  // SIGINT handler — graceful shutdown
  const sigintHandler = () => {
    const forceExit = setTimeout(() => process.exit(1), 3000);
    forceExit.unref();

    // Close all SSE clients
    for (const client of clients) {
      try { client.end(); } catch {}
    }
    clients.clear();

    // Close all project watchers
    const closePromises = [];
    for (const [, w] of watchers) {
      closePromises.push(w.close().catch(() => {}));
    }
    watchers.clear();
    closePromises.push(registryWatcher.close().catch(() => {}));

    Promise.all(closePromises).then(() => {
      server.close(() => process.exit(0));
    });
  };

  process.once('SIGINT', sigintHandler);

  // Return handle for programmatic use (tests, etc.)
  function close() {
    return new Promise((resolve) => {
      // Remove SIGINT handler
      process.removeListener('SIGINT', sigintHandler);

      // Clear debounce timers
      for (const [, timer] of debounceTimers) {
        clearTimeout(timer);
      }
      debounceTimers.clear();

      // Close all SSE clients
      for (const client of clients) {
        try { client.end(); } catch {}
      }
      clients.clear();

      // Close all file watchers
      const closePromises = [];
      for (const [, w] of watchers) {
        closePromises.push(w.close().catch(() => {}));
      }
      watchers.clear();
      closePromises.push(registryWatcher.close().catch(() => {}));

      Promise.all(closePromises).then(() => {
        server.close(() => resolve());
      });
    });
  }

  return { server, clients, cache, watchers, close };
}

module.exports = {
  startDashboardServer,
  parseProjectData,
  parseAllMilestones,
  formatSSE,
  broadcast,
};
