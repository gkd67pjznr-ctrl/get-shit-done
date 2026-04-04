'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const chokidar = require('chokidar');
const { execSync, spawn } = require('child_process');
const { WebSocketServer } = require('ws');

const { resolveActiveMilestone, planningRoot, compareVersions } = require('./core.cjs');
const { loadRegistry, getDashboardPath } = require('./dashboard.cjs');

const DASHBOARD_DIR = path.join(__dirname, '..', '..', '..', 'dashboard');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

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
        // Skip plan-level checkboxes — two formats found in older ROADMAPs:
        //   "- [x] 01-01-PLAN.md — ..." (contains PLAN.md)
        //   "- [x] 07-01: Delete ..."   (NN-NN: plan number format)
        if (/PLAN\.md/i.test(rest)) continue;
        if (/^\d{2}-\d{2}[\s:-]/.test(rest)) continue;
        // Strip markdown bold formatting before numeric extraction
        const cleanRest = rest.replace(/\*\*/g, '').trim();
        // Extract phase number if present (supports integers and decimals like 16.1)
        const numMatch = cleanRest.match(/^(?:Phase\s+)?(\d+(?:\.\d+)*)[\s:-]+(.+)$/i);
        if (numMatch) {
          phases.push({ number: numMatch[1], name: numMatch[2].trim(), status: done ? 'complete' : 'pending', goal: null });
        } else {
          phases.push({ number: null, name: cleanRest, status: done ? 'complete' : 'pending', goal: null });
        }
      }
    }
    // Deduplicate by phase number — keep first occurrence; null-number entries always kept
    const seen = new Set();
    const deduped = phases.filter(p => {
      if (p.number === null) return true;
      if (seen.has(p.number)) return false;
      seen.add(p.number);
      return true;
    });
    return { phases: deduped };
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

/**
 * Read .planning/cost-log.jsonl and return the latest cumulative total across all sessions.
 * Returns { total: number } or null if file doesn't exist.
 */
function readProjectCostLog(projectPath) {
  try {
    const logPath = path.join(projectPath, '.planning', 'cost-log.jsonl');
    const content = fs.readFileSync(logPath, 'utf-8').trim();
    if (!content) return null;
    const lines = content.split('\n').filter(Boolean);
    // Sum unique session cumulatives — use last entry per session
    const sessionMax = new Map();
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.session && entry.cumulative != null) {
          const prev = sessionMax.get(entry.session) || 0;
          if (entry.cumulative > prev) sessionMax.set(entry.session, entry.cumulative);
        }
      } catch { /* skip malformed */ }
    }
    if (sessionMax.size === 0) return null;
    const total = Array.from(sessionMax.values()).reduce((sum, v) => sum + v, 0);
    return { total: Math.round(total * 10000) / 10000 };
  } catch {
    return null;
  }
}

/**
 * Scan /tmp/claude-ctx-*.json bridge files for session metrics (cost, lines, duration).
 * Returns a Map: projectPath → [{ session_id, cost, lines_added, lines_removed, duration_ms }]
 * Cached for 5s to avoid hammering the filesystem on every project parse.
 */
let _bridgeCache = null;
let _bridgeCacheTs = 0;
function scanSessionBridgeFiles() {
  const now = Date.now();
  if (_bridgeCache && (now - _bridgeCacheTs) < 5000) return _bridgeCache;

  const result = new Map(); // projectPath → sessions[]
  try {
    const tmpDir = os.tmpdir();
    const files = fs.readdirSync(tmpDir).filter(f => f.startsWith('claude-ctx-') && f.endsWith('.json'));
    for (const fname of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(tmpDir, fname), 'utf-8'));
        if (!data.cwd || !data.session_id) continue;
        // Stale check: skip bridge files older than 24h
        if (data.timestamp && (now / 1000 - data.timestamp) > 86400) continue;
        const entry = {
          session_id: data.session_id,
          cost: data.cost || 0,
          lines_added: data.lines_added || 0,
          lines_removed: data.lines_removed || 0,
          duration_ms: data.duration_ms || 0,
          cwd: data.cwd,
        };
        if (!result.has(data.cwd)) result.set(data.cwd, []);
        result.get(data.cwd).push(entry);
      } catch { /* skip malformed */ }
    }
  } catch { /* /tmp unreadable */ }
  _bridgeCache = result;
  _bridgeCacheTs = now;
  return result;
}

/**
 * Get session metrics for a specific project path from bridge file scan.
 * Returns array of { session_id, cost, lines_added, lines_removed, duration_ms }.
 */
function getProjectSessions(projectPath) {
  if (!projectPath) return [];
  const bridge = scanSessionBridgeFiles();
  const sessions = [];
  for (const [cwd, entries] of bridge) {
    if (cwd === projectPath || cwd.startsWith(projectPath + '/')) {
      sessions.push(...entries);
    }
  }
  return sessions;
}

// ─── Tmux polling functions ───────────────────────────────────────────────────

const TMUX_FORMAT = '#{session_name}|#{pane_index}|#{pane_current_path}|#{pane_title}|#{pane_current_command}|#{session_windows}|#{window_panes}|#{window_activity}|#{pane_pid}|#{window_name}|#{window_index}';

function parseTmuxOutput(raw) {
  return raw.split('\n').filter(line => line.trim() !== '').map(line => {
    const [sessionName, paneIndex, paneCwd, paneTitle, paneCmd, sessionWindows, windowPanes, windowActivity, panePid, windowName, windowIndex] = line.split('|');
    return {
      sessionName,
      paneIndex: parseInt(paneIndex, 10),
      cwd: paneCwd,
      title: paneTitle,
      command: paneCmd,
      sessionWindows: parseInt(sessionWindows, 10),
      windowPanes: parseInt(windowPanes, 10),
      lastActivity: parseInt(windowActivity, 10) * 1000,
      pid: parseInt(panePid, 10),
      windowName: windowName || sessionName,
      windowIndex: parseInt(windowIndex, 10) || 0,
      isClaude: (windowName || '').startsWith('cc'),
    };
  });
}

function pollTmux() {
  try {
    const raw = execSync(`tmux list-panes -a -F '${TMUX_FORMAT}'`, {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return parseTmuxOutput(raw);
  } catch {
    return [];
  }
}

function mapPanesToProjects(panes, cache) {
  // Sort project paths by length descending so most-specific path wins
  const sortedProjects = Array.from(cache.entries()).sort(
    ([, a], [, b]) => (b.path || '').length - (a.path || '').length
  );

  const result = new Map();

  for (const pane of panes) {
    for (const [name, project] of sortedProjects) {
      if (project.path && pane.cwd && pane.cwd.startsWith(project.path)) {
        if (!result.has(name)) {
          result.set(name, { sessions: new Set(), panes: [] });
        }
        const entry = result.get(name);
        entry.sessions.add(pane.sessionName);
        entry.panes.push(pane);
        break;
      }
    }
  }

  return result;
}

function tmuxStateHash(tmuxEntry) {
  if (!tmuxEntry) return '';
  const sortedSessions = Array.from(tmuxEntry.sessions).sort();
  const sortedPaneKeys = tmuxEntry.panes
    .map(p => `${p.sessionName}:${p.windowName}:${p.paneIndex}:${p.lastActivity}`)
    .sort();
  return JSON.stringify({ sessions: sortedSessions, paneKeys: sortedPaneKeys });
}

// ─── Health score computation ─────────────────────────────────────────────────

function computeHealthScore(projectData) {
  try {
    const factors = [];
    const now = Date.now();

    // Factor 1: Progress momentum -- parse last_activity date
    if (projectData.state && projectData.state.last_activity) {
      const dateMatch = projectData.state.last_activity.match(/^(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const activityDate = new Date(dateMatch[1]).getTime();
        const daysSince = (now - activityDate) / (1000 * 60 * 60 * 24);
        if (daysSince > 30) factors.push('at_risk');
        else if (daysSince > 14) factors.push('warning');
      }
    }

    // Factor 2: Stale in-progress phases
    if (projectData.state && projectData.state.last_activity) {
      const dateMatch = projectData.state.last_activity.match(/^(\d{4}-\d{2}-\d{2})/);
      const status = (projectData.state.status || '').toLowerCase();
      if (dateMatch && (status.includes('in-progress') || status.includes('executing'))) {
        const activityDate = new Date(dateMatch[1]).getTime();
        const daysSince = (now - activityDate) / (1000 * 60 * 60 * 24);
        if (daysSince > 7) factors.push('warning');
      }
    }

    // Factor 3: Open debt
    if (projectData.debt) {
      if (projectData.debt.open > 10) factors.push('at_risk');
      else if (projectData.debt.open > 5) factors.push('warning');
    }

    // Factor 4: Blocked milestones
    if (Array.isArray(projectData.milestones)) {
      for (const ms of projectData.milestones) {
        const msStatus = (ms.state && ms.state.status) || '';
        if (/block/i.test(msStatus)) {
          factors.push('warning');
          break;
        }
      }
    }

    if (factors.includes('at_risk')) return { label: 'At Risk', level: 'error' };
    if (factors.includes('warning')) return { label: 'Needs Attention', level: 'warning' };
    if (!projectData.state && (!projectData.milestones || projectData.milestones.length === 0)) {
      return { label: 'New/Unknown', level: 'neutral' };
    }
    return { label: 'Healthy', level: 'success' };
  } catch {
    return { label: 'New/Unknown', level: 'neutral' };
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
      .sort((a, b) => compareVersions(a.name, b.name));

    const result = [];
    for (const dir of milestoneEntries) {
      const milestoneRoot = path.join(milestonesDir, dir.name);
      const entry = {
        name: dir.name,
        active: false,   // will be set after state is parsed
        state: null,
        roadmap: null,
        requirements: null,
        phases_summary: [],
      };

      try {
        const stateContent = fs.readFileSync(path.join(milestoneRoot, 'STATE.md'), 'utf-8');
        entry.state = parseStateFile(stateContent);
      } catch { /* leave null */ }

      // Determine active: check YAML frontmatter status first, then body Status, then roadmap
      const TERMINAL_EXACT = /^(completed|shipped|done)$/i;
      const TERMINAL_CONTAINS = /\b(complete|completed|shipped|done|milestone complete)\b/i;
      let canonicalStatus = null;
      try {
        const stateContent = fs.readFileSync(path.join(milestoneRoot, 'STATE.md'), 'utf-8');
        const fmMatch = stateContent.match(/^---\n([\s\S]*?)\n---/);
        if (fmMatch) {
          const statusLine = fmMatch[1].match(/^status:\s*(.+)$/m);
          if (statusLine) canonicalStatus = statusLine[1].trim();
        }
      } catch { /* already read above, ignore */ }

      if (canonicalStatus) {
        // Frontmatter status is canonical — exact match
        entry.active = !TERMINAL_EXACT.test(canonicalStatus);
      } else if (entry.state && entry.state.status) {
        // Body Status line is descriptive — use contains match
        entry.active = !TERMINAL_CONTAINS.test(entry.state.status);
      } else {
        // No status at all — infer from roadmap (all phases done = inactive)
        entry.active = false;
      }

      try {
        const roadmapContent = fs.readFileSync(path.join(milestoneRoot, 'ROADMAP.md'), 'utf-8');
        entry.roadmap = parseRoadmapFile(roadmapContent);
      } catch { /* leave null */ }

      // Override active/completed state using ROADMAP.md checkboxes (ground truth).
      // STATE.md status field is unreliable — Claude may write "completed" even when phases remain.
      if (entry.roadmap && entry.roadmap.phases && entry.roadmap.phases.length > 0) {
        const totalPhases = entry.roadmap.phases.length;
        const completedPhases = entry.roadmap.phases.filter(p => p.status === 'complete').length;
        const allDone = completedPhases === totalPhases;

        // ROADMAP.md is authoritative: all phases checked = done (inactive), any pending = active
        entry.active = !allDone;

        // Inject computed progress into state so frontend shows accurate percentage
        const pct = Math.round((completedPhases / totalPhases) * 100);
        if (entry.state) {
          entry.state.progress = `[${completedPhases}/${totalPhases} phases] ${pct}%`;
        } else {
          entry.state = { current_phase: null, status: null, progress: `[${completedPhases}/${totalPhases} phases] ${pct}%`, last_activity: null };
        }
      }

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

// ─── Cross-Project Pattern Aggregation (PAT-01) ───────────────────────────────

/**
 * Reads sessions.jsonl from every project in the registry and returns a merged
 * array of pattern summary objects.
 *
 * Each returned object:
 *   { type, count, projects: string[], projectCount, lastSeen }
 *
 * @param {Array<{name: string, path: string}>} registry
 * @returns {Array}
 */
function aggregatePatterns(registry) {
  /** @type {Map<string, { count: number, projects: Set<string>, lastSeen: string|null }>} */
  const byType = new Map();

  for (const project of registry) {
    const sessionsFile = path.join(project.path, '.planning', 'patterns', 'sessions.jsonl');
    let lines;
    try {
      lines = fs.readFileSync(sessionsFile, 'utf-8').trim().split('\n').filter(Boolean);
    } catch {
      continue; // project has no sessions.jsonl -- skip
    }

    for (const line of lines) {
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue; // malformed JSONL -- skip
      }
      entry._project = project.name;

      const type = entry.commit_type || entry.event || entry.type || 'unknown';
      if (!byType.has(type)) {
        byType.set(type, { count: 0, projects: new Set(), lastSeen: null });
      }
      const bucket = byType.get(type);
      bucket.count++;
      bucket.projects.add(project.name);
      if (entry.timestamp && (!bucket.lastSeen || entry.timestamp > bucket.lastSeen)) {
        bucket.lastSeen = entry.timestamp;
      }
    }
  }

  // Sort by count descending
  return Array.from(byType.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([type, data]) => ({
      type,
      count: data.count,
      projects: Array.from(data.projects).sort(),
      projectCount: data.projects.size,
      lastSeen: data.lastSeen,
    }));
}

/**
 * Returns gate health metrics for a single project.
 *
 * Reads .planning/observations/gate-executions.jsonl and returns compact
 * metrics for use in overview card rendering (DASH-06, DASH-07, DASH-08).
 *
 * @param {string} projectPath - Absolute path to the project root
 * @returns {object} Per-project gate health data
 */
function getProjectGateHealth(projectPath) {
  const VALID_GATES = ['codebase_scan', 'context7_lookup', 'test_baseline', 'test_gate', 'diff_review'];
  const VALID_OUTCOMES = ['passed', 'warned', 'blocked', 'skipped'];
  const obsDir = path.join(projectPath, '.planning', 'observations');
  const gateFile = path.join(obsDir, 'gate-executions.jsonl');
  let lines;
  try {
    lines = fs.readFileSync(gateFile, 'utf-8').trim().split('\n').filter(Boolean);
  } catch {
    return { hasData: false, qualityLevel: null, totalFires: 0, warnCount: 0, warnPct: 0, blockedCount: 0, recentFires: 0 };
  }

  let totalFires = 0, warnCount = 0, blockedCount = 0, recentFires = 0;
  let latestQualityLevel = null;
  let latestTimestamp = '';
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (!VALID_GATES.includes(entry.gate) || !VALID_OUTCOMES.includes(entry.outcome)) continue;

    totalFires++;
    if (entry.outcome === 'warned') warnCount++;
    if (entry.outcome === 'blocked') blockedCount++;
    if (entry.timestamp && entry.timestamp > oneDayAgo) recentFires++;
    if (entry.timestamp && entry.timestamp > latestTimestamp) {
      latestTimestamp = entry.timestamp;
      latestQualityLevel = entry.quality_level || null;
    }
  }

  return {
    hasData: totalFires > 0,
    qualityLevel: latestQualityLevel,
    totalFires,
    warnCount,
    warnPct: totalFires > 0 ? Math.round((warnCount / totalFires) * 100) : 0,
    blockedCount,
    recentFires,
  };
}

/**
 * Aggregates gate execution and Context7 call data across all registered projects.
 *
 * Data sources per project:
 *   .planning/observations/gate-executions.jsonl
 *   .planning/observations/context7-calls.jsonl
 *
 * @param {Array<{name: string, path: string}>} registry
 * @returns {object} Aggregated gate health data
 */
function aggregateGateHealth(registry) {
  const VALID_GATES = ['codebase_scan', 'context7_lookup', 'test_baseline', 'test_gate', 'diff_review'];
  const VALID_OUTCOMES = ['passed', 'warned', 'blocked', 'skipped'];

  // Initialize accumulators
  const outcomes = { passed: 0, warned: 0, blocked: 0, skipped: 0 };
  const qualityLevels = { standard: 0, strict: 0, fast: 0 };
  const gates = {};
  for (const gate of VALID_GATES) {
    gates[gate] = { total: 0, passed: 0, warned: 0, blocked: 0, skipped: 0 };
  }
  let totalExecutions = 0;
  let reportingCount = 0;

  // Context7 accumulators
  let c7TotalCalls = 0;
  let c7TotalTokens = 0;
  let c7CapHits = 0;
  let c7UsedCount = 0;

  for (const project of registry) {
    const obsDir = path.join(project.path, '.planning', 'observations');
    let projectHasData = false;

    // --- gate-executions.jsonl ---
    const gateFile = path.join(obsDir, 'gate-executions.jsonl');
    let gateLines;
    try {
      gateLines = fs.readFileSync(gateFile, 'utf-8').trim().split('\n').filter(Boolean);
    } catch {
      gateLines = [];
    }

    for (const line of gateLines) {
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue; // skip malformed lines
      }

      const gate = entry.gate;
      const outcome = entry.outcome;
      const ql = entry.quality_level;

      // Only count valid entries
      if (!VALID_GATES.includes(gate) || !VALID_OUTCOMES.includes(outcome)) continue;

      outcomes[outcome]++;
      if (ql === 'standard' || ql === 'strict') {
        qualityLevels[ql]++;
      }
      gates[gate].total++;
      gates[gate][outcome]++;
      totalExecutions++;
      projectHasData = true;
    }

    // --- context7-calls.jsonl ---
    const c7File = path.join(obsDir, 'context7-calls.jsonl');
    let c7Lines;
    try {
      c7Lines = fs.readFileSync(c7File, 'utf-8').trim().split('\n').filter(Boolean);
    } catch {
      c7Lines = [];
    }

    for (const line of c7Lines) {
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      const tokensRequested = typeof entry.tokens_requested === 'number' ? entry.tokens_requested : 0;
      const tokenCap = typeof entry.token_cap === 'number' ? entry.token_cap : Infinity;

      c7TotalCalls++;
      c7TotalTokens += tokensRequested;
      if (tokensRequested >= tokenCap) c7CapHits++;
      if (entry.used === true) c7UsedCount++;
      projectHasData = true;
    }

    if (projectHasData) reportingCount++;
  }

  const hasData = totalExecutions > 0 || c7TotalCalls > 0;

  return {
    projectCount: registry.length,
    reportingCount,
    totalExecutions,
    outcomes,
    qualityLevels,
    gates,
    context7: {
      totalCalls: c7TotalCalls,
      avgTokensRequested: c7TotalCalls > 0 ? Math.round(c7TotalTokens / c7TotalCalls) : 0,
      capHitRate: c7TotalCalls > 0 ? c7CapHits / c7TotalCalls : 0,
      usedInCodeRate: c7TotalCalls > 0 ? c7UsedCount / c7TotalCalls : 0,
    },
    hasData,
  };
}

// ─── Core data aggregation ────────────────────────────────────────────────────

function parseProjectData(project, tmuxCache) {
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

  // Health score (null for paused projects)
  const tracking = project.tracking !== false; // default true
  const health = tracking ? computeHealthScore({ state, roadmap, debt, milestones }) : null;

  // Tmux data for this project
  const tmuxEntry = tmuxCache && tmuxCache.get(project.name);
  const tmux = tmuxEntry
    ? { available: true, sessions: Array.from(tmuxEntry.sessions), panes: tmuxEntry.panes }
    : { available: false, sessions: [], panes: [] };

  // Session metadata enrichment
  const costLog = readProjectCostLog(project.path);
  const sessionData = getProjectSessions(project.path);

  // Enrich tmux panes with per-session cost/lines from bridge files
  if (tmux.panes && sessionData.length > 0) {
    for (const pane of tmux.panes) {
      if (!pane.isClaude) continue;
      // Match pane to session by CWD
      const match = sessionData.find(s => pane.cwd && (s.cwd === pane.cwd || pane.cwd.startsWith(s.cwd + '/') || s.cwd.startsWith(pane.cwd)));
      if (match) {
        pane.sessionCost = match.cost;
        pane.sessionLinesAdded = match.lines_added;
        pane.sessionLinesRemoved = match.lines_removed;
        pane.sessionDurationMs = match.duration_ms;
      }
    }
  }

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
    health,
    tmux,
    tracking,
    costLog,
    gateHealth: getProjectGateHealth(project.path),
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

// ─── Static file serving ─────────────────────────────────────────────────────

function serveStatic(req, res, dashboardDir) {
  // Path traversal guard: reject any URL containing '..'
  if (req.url && req.url.includes('..')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  let { pathname } = (() => {
    try { return new URL(req.url, 'http://localhost'); } catch { return { pathname: '/' }; }
  })();

  if (pathname === '/') pathname = '/index.html';

  // API routes must not fall through to SPA fallback — return 404 JSON
  if (pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  const resolved = path.resolve(path.join(dashboardDir, pathname));
  const dashboardResolved = path.resolve(dashboardDir);

  // Secondary path traversal guard: resolved path must be inside dashboard dir
  if (!resolved.startsWith(dashboardResolved + path.sep) && resolved !== dashboardResolved) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(resolved);
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(resolved);
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(content);
  } catch {
    // SPA fallback: serve index.html for any missing file
    const indexPath = path.join(dashboardDir, 'index.html');
    try {
      const indexContent = fs.readFileSync(indexPath);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(indexContent);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  }
}

// ─── Terminal WebSocket Bridge (TERM-03) ──────────────────────────────────────

/**
 * Attaches a WebSocket server to the existing HTTP server to bridge browser
 * clients to live tmux sessions. URL pattern: /ws/terminal/<sessionName>
 *
 * @param {http.Server} httpServer
 * @returns {WebSocketServer}
 */
function setupTerminalWebSocket(httpServer) {
  const wss = new WebSocketServer({ noServer: true });
  const activeSessions = new Map(); // sessionName -> { proc, ws, paneId }

  httpServer.on('upgrade', (req, socket, head) => {
    const urlPath = (req.url || '').split('?')[0];
    if (urlPath.startsWith('/ws/terminal/')) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws, req) => {
    const urlPath = (req.url || '').split('?')[0];
    const rawTarget = decodeURIComponent(urlPath.slice('/ws/terminal/'.length));

    if (!rawTarget) {
      ws.close(4000, 'Session name required');
      return;
    }

    // Support "session:window" format to target a specific window
    let sessionName, windowTarget;
    if (rawTarget.includes(':')) {
      [sessionName, windowTarget] = rawTarget.split(':', 2);
    } else {
      sessionName = rawTarget;
      windowTarget = null;
    }

    // Use the full target as the dedup key (so different windows can open simultaneously)
    const dedupKey = rawTarget;

    // Reject duplicate connections to the same target
    if (activeSessions.has(dedupKey)) {
      ws.close(4009, 'Session already attached');
      return;
    }

    // Validate the tmux session exists
    try {
      execSync(`tmux has-session -t "${sessionName}"`, {
        stdio: 'pipe',
        timeout: 2000,
      });
    } catch {
      ws.close(4004, 'Session not found');
      return;
    }

    // Resolve the target pane — either from a specific window or the session's active pane
    const tmuxTarget = windowTarget ? `${sessionName}:${windowTarget}` : sessionName;
    let targetPane;
    try {
      targetPane = execSync(
        `tmux display-message -t "${tmuxTarget}" -p '#{pane_id}'`,
        { encoding: 'utf-8', stdio: 'pipe', timeout: 2000 }
      ).trim();
    } catch {
      targetPane = null;
    }
    const sendTarget = targetPane || tmuxTarget;

    // Use tmux control mode (-C) which works with piped stdio.
    // Control mode streams structured events on stdout and accepts
    // tmux commands on stdin — no PTY allocation needed.
    const proc = spawn('tmux', ['-C', 'attach-session', '-t', sessionName, '-r'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, TERM: 'xterm-256color' },
    });

    activeSessions.set(dedupKey, { proc, ws, paneId: sendTarget });

    // Send initial screen capture so the terminal isn't blank
    try {
      const initialContent = execSync(
        `tmux capture-pane -t "${sendTarget}" -p -e`,
        { encoding: 'utf-8', stdio: 'pipe', timeout: 2000 }
      );
      if (initialContent && ws.readyState === 1) {
        // capture-pane outputs \n-separated lines; xterm.js needs \r\n
        ws.send(initialContent.replace(/\n/g, '\r\n'));
      }
    } catch { /* ignore — control mode output will follow */ }

    // Parse tmux control mode output — forward %output events to WebSocket
    let buffer = '';
    proc.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      let newlineIdx;
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);

        // %output %<pane_id> <escaped-data> — only forward for our target pane
        if (line.startsWith('%output ')) {
          const spaceAfterPane = line.indexOf(' ', 8);
          if (spaceAfterPane !== -1) {
            const paneId = line.slice(8, spaceAfterPane);
            if (targetPane && paneId !== targetPane) continue;
            const rawData = line.slice(spaceAfterPane + 1);
            // Unescape tmux control mode encoding: \033 → ESC, \015 → CR, \012 → LF, \\ → \
            const unescaped = rawData
              .replace(/\\033/g, '\x1b')
              .replace(/\\015/g, '\r')
              .replace(/\\012/g, '\n')
              .replace(/\\007/g, '\x07')
              .replace(/\\010/g, '\b')
              .replace(/\\011/g, '\t')
              .replace(/\\177/g, '\x7f')
              .replace(/\\\\/g, '\\');
            if (ws.readyState === 1) {
              try { ws.send(unescaped); } catch { /* ignore */ }
            }
          }
        }
        // %session-changed, %window-renamed, etc. — ignore for now
      }
    });

    proc.stderr.on('data', () => { /* ignore control mode stderr */ });

    // Tmux prefix key interception — Ctrl+B (0x02) followed by a command key
    // gets translated into tmux control mode commands, since send-keys -H
    // bypasses tmux's key binding system entirely.
    let prefixPending = false;
    let prefixTimer = null;
    const TMUX_PREFIX_COMMANDS = {
      'c':  `new-window -t ${sessionName}`,
      'n':  `next-window -t ${sessionName}`,
      'p':  `previous-window -t ${sessionName}`,
      'l':  `last-window -t ${sessionName}`,
      'd':  null, // detach — close the WebSocket
      'z':  `resize-pane -t ${sendTarget} -Z`,
      '%':  `split-window -h -t ${sendTarget}`,
      '"':  `split-window -v -t ${sendTarget}`,
      'o':  `select-pane -t ${sendTarget} -t :.+`,
      ';':  `last-pane -t ${sessionName}`,
      '{':  `swap-pane -U -t ${sendTarget}`,
      '}':  `swap-pane -D -t ${sendTarget}`,
      'x':  `kill-pane -t ${sendTarget}`,
      '!':  `break-pane -t ${sendTarget}`,
      '&':  `kill-window -t ${sessionName}`,
      ' ':  `next-layout -t ${sessionName}`,
      '[':  `copy-mode -t ${sendTarget}`,
    };
    // Window select: 0-9
    for (let i = 0; i <= 9; i++) {
      TMUX_PREFIX_COMMANDS[String(i)] = `select-window -t ${sessionName}:${i}`;
    }

    ws.on('message', (data) => {
      const str = typeof data === 'string' ? data : data.toString();

      // Try to parse as JSON control message (resize)
      try {
        const msg = JSON.parse(str);
        if (msg.type === 'resize' && msg.cols && msg.rows) {
          const cols = parseInt(msg.cols, 10);
          const rows = parseInt(msg.rows, 10);
          if (cols > 0 && rows > 0 && !proc.stdin.destroyed) {
            proc.stdin.write(`resize-pane -t ${sendTarget} -x ${cols} -y ${rows}\n`);
          }
          return;
        }
      } catch { /* not JSON — fall through to keystroke forward */ }

      // Handle tmux prefix key sequence
      if (prefixPending) {
        clearTimeout(prefixTimer);
        prefixPending = false;

        const key = str;
        const cmd = TMUX_PREFIX_COMMANDS[key];
        if (cmd !== undefined) {
          if (cmd === null) {
            // 'd' = detach — close the connection
            ws.close(1000, 'Detached');
          } else if (!proc.stdin.destroyed) {
            proc.stdin.write(cmd + '\n');
          }
          return;
        }
        // Unknown prefix combo — send both the prefix byte and the key
        // (fall through to send-keys below with the follow-up key)
      }

      // Ctrl+B (0x02) — start prefix sequence
      if (str === '\x02') {
        prefixPending = true;
        // Auto-cancel after 2s if no follow-up key
        prefixTimer = setTimeout(() => { prefixPending = false; }, 2000);
        return;
      }

      // Forward keystrokes via tmux send-keys -H (hex mode)
      if (!proc.stdin.destroyed) {
        const hexBytes = Buffer.from(str, 'utf-8')
          .toString('hex')
          .match(/.{2}/g)
          .join(' ');
        proc.stdin.write(`send-keys -t ${sendTarget} -H ${hexBytes}\n`);
      }
    });

    const cleanup = () => {
      activeSessions.delete(dedupKey);
      if (!proc.killed) {
        try { proc.stdin.end(); } catch { /* ignore */ }
        proc.kill('SIGHUP');
      }
    };

    ws.on('close', cleanup);
    ws.on('error', cleanup);

    proc.on('exit', () => {
      activeSessions.delete(dedupKey);
      if (ws.readyState === 1) ws.close();
    });
  });

  // Clean up all sessions on server shutdown
  process.on('SIGINT', () => {
    for (const { proc } of activeSessions.values()) {
      if (!proc.killed) proc.kill('SIGHUP');
    }
  });

  return wss;
}

// ─── HTTP server ──────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, mcp-session-id',
  'Access-Control-Expose-Headers': 'mcp-session-id',
};

function createHttpServer(port, cache, clients, dashboardDir, tmuxCache) {
  const server = http.createServer((req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    // Add CORS headers to all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');

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

    // PATCH /api/projects/:name/tracking
    if (req.method === 'PATCH' && /^\/api\/projects\/[^/]+\/tracking$/.test(pathname)) {
      const encodedName = pathname.slice('/api/projects/'.length, pathname.lastIndexOf('/tracking'));
      const name = decodeURIComponent(encodedName);

      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { tracking } = JSON.parse(body);
          if (typeof tracking !== 'boolean') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'tracking must be boolean' }));
            return;
          }

          // Update registry
          const { loadRegistry, saveRegistry } = require('./dashboard.cjs');
          const projects = loadRegistry();
          const idx = projects.findIndex(p => p.name === name);
          if (idx === -1) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found' }));
            return;
          }

          if (tracking) {
            delete projects[idx].tracking; // omit means true (backward compat)
          } else {
            projects[idx].tracking = false;
          }
          saveRegistry(projects);

          // Re-parse and update cache
          const updatedProject = { ...projects[idx] };
          const parsed = parseProjectData(updatedProject, tmuxCache);
          cache.set(name, parsed);
          broadcast(clients, 'project-update', parsed);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ name, tracking }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/patterns') {
      const registry = loadRegistry();
      const patterns = aggregatePatterns(registry);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      });
      res.end(JSON.stringify(patterns));
      return;
    }

    if (req.method === 'GET' && pathname === '/api/gate-health') {
      const registry = loadRegistry();
      const gateHealth = aggregateGateHealth(registry);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      });
      res.end(JSON.stringify(gateHealth));
      return;
    }

    if (req.method === 'GET' && pathname === '/api/events') {
      handleSSE(req, res, clients);
      return;
    }

    serveStatic(req, res, dashboardDir || DASHBOARD_DIR);
  });

  return server;
}

// ─── File watching ────────────────────────────────────────────────────────────

function watchProject(project, cache, clients, watchers, debounceTimers, tmuxCache) {
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
        const data = parseProjectData(project, tmuxCache);
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

function watchRegistry(cache, watchers, clients, debounceTimers, opts = {}, tmuxCache) {
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
              const parsed = parseProjectData(p, tmuxCache);
              cache.set(p.name, parsed);
              watchProject(p, cache, clients, watchers, debounceTimers, tmuxCache);
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

function tryTakeoverPort(port, server, cache, clients, watchers, debounceTimers, host) {
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
          server.listen(port, host, () => {
            console.log(`[gsd-server] Dashboard server running at http://${host}:${port}`);
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

  const host = opts.host || 'localhost';

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

  // ─── Tmux polling ─────────────────────────────────────────────────────────────
  const tmuxCache = new Map();
  const tmuxHashMap = new Map(); // projectName -> previous hash string

  function runTmuxPoll() {
    try {
      const panes = pollTmux();
      const projectTmux = mapPanesToProjects(panes, cache);

      for (const [name] of cache) {
        const tmuxEntry = projectTmux.get(name) || null;
        const hash = tmuxStateHash(tmuxEntry);
        if (hash !== (tmuxHashMap.get(name) || '')) {
          tmuxHashMap.set(name, hash);
          tmuxCache.set(name, tmuxEntry);
          // Update the cached project data with fresh tmux
          const project = cache.get(name);
          if (project) {
            const tmuxData = tmuxEntry
              ? { available: true, sessions: Array.from(tmuxEntry.sessions), panes: tmuxEntry.panes }
              : { available: false, sessions: [], panes: [] };
            // Enrich panes with per-session metrics from bridge files
            if (tmuxData.panes && tmuxData.panes.length > 0) {
              const sessionData = getProjectSessions(project.path);
              if (sessionData.length > 0) {
                for (const pane of tmuxData.panes) {
                  if (!pane.isClaude) continue;
                  const match = sessionData.find(s => pane.cwd && (s.cwd === pane.cwd || pane.cwd.startsWith(s.cwd + '/') || s.cwd.startsWith(pane.cwd)));
                  if (match) {
                    pane.sessionCost = match.cost;
                    pane.sessionLinesAdded = match.lines_added;
                    pane.sessionLinesRemoved = match.lines_removed;
                    pane.sessionDurationMs = match.duration_ms;
                  }
                }
              }
            }
            const updated = { ...project, tmux: tmuxData };
            cache.set(name, updated);
            broadcast(clients, 'tmux-update', { name, tmux: updated.tmux });
          }
        }
      }
    } catch (err) {
      // Never crash the poll loop
      if (process.env.GSD_DEBUG) console.warn('[gsd-server] tmux poll error:', err.message);
    }
  }

  const tmuxPollInterval = setInterval(runTmuxPoll, 5000);

  // Parse initial data for each project and set up file watchers
  for (const project of projects) {
    try {
      const data = parseProjectData(project, tmuxCache);
      cache.set(project.name, data);
    } catch (err) {
      console.warn('[gsd-server] Error parsing initial data for ' + project.name + ': ' + err.message);
    }
    watchProject(project, cache, clients, watchers, debounceTimers, tmuxCache);
  }

  // Start registry watcher
  const registryWatcher = watchRegistry(cache, watchers, clients, debounceTimers, opts, tmuxCache);

  // Create and start HTTP server
  const server = createHttpServer(port, cache, clients, opts.dashboardDir || DASHBOARD_DIR, tmuxCache);

  // Attach WebSocket terminal bridge to the HTTP server
  setupTerminalWebSocket(server);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      tryTakeoverPort(port, server, cache, clients, watchers, debounceTimers, host);
    } else {
      console.error('[gsd-server] Fatal error:', err.message);
      process.exit(1);
    }
  });

  server.listen(port, host, () => {
    console.log('[gsd-server] Dashboard server running at http://' + host + ':' + port);
  });

  // SIGINT handler — graceful shutdown
  const sigintHandler = () => {
    const forceExit = setTimeout(() => process.exit(1), 3000);
    forceExit.unref();

    // Stop tmux polling
    clearInterval(tmuxPollInterval);

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

      // Stop tmux polling
      clearInterval(tmuxPollInterval);

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
  aggregatePatterns,
  getProjectGateHealth,
  aggregateGateHealth,
  formatSSE,
  broadcast,
  _parseTmuxOutput: parseTmuxOutput,
  _pollTmux: pollTmux,
  _mapPanesToProjects: mapPanesToProjects,
  _tmuxStateHash: tmuxStateHash,
  _computeHealthScore: computeHealthScore,
  setupTerminalWebSocket,
};
