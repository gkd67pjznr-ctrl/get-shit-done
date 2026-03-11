#!/usr/bin/env node
// Claude Code Statusline - GSD Edition v3 (global)
// Shows: [update] model [vim] [agent] [skill] [team] │ [GSD status] │ task │ dir (branch) │ +N/-N │ $X.XX │ Xm │ context bar

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

// Read JSON from stdin
let input = '';
// Timeout guard: if stdin doesn't close within 3s (e.g. pipe issues on
// Windows/Git Bash), exit silently instead of hanging. See #775.
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const homeDir = os.homedir();
    const segments = [];

    // --- GSD update notification (prefix, not a segment) ---
    let prefix = '';
    const cacheFile = path.join(homeDir, '.claude', 'cache', 'gsd-update-check.json');
    if (fs.existsSync(cacheFile)) {
      try {
        const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        if (cache.update_available) {
          prefix = '\x1b[33m\u2b06 /gsd:update\x1b[0m \u2502 ';
        }
      } catch (e) {}
    }

    // --- Model + optional vim mode ---
    const model = data.model?.display_name || 'Claude';
    let modelParts = [`\x1b[2m${model}\x1b[0m`];

    if (data.vim?.mode) {
      const isInsert = data.vim.mode === 'INSERT';
      const modeChar = isInsert ? 'I' : 'N';
      const modeColor = isInsert ? '32' : '36';
      modelParts.push(`\x1b[${modeColor}m[${modeChar}]\x1b[0m`);
    }

    segments.push(modelParts.join(' '));

    // --- Active context badges (agent, skill, team) ---
    const badges = [];

    // Agent badge (magenta gear)
    const agentName = data.agent?.name || data.agent?.id;
    if (agentName) {
      badges.push(`\x1b[35m\u2699 ${agentName}\x1b[0m`);
    }

    // Skill badge (cyan diamond)
    const skillName = data.skill?.name || data.skill?.id || data.active_skill;
    if (skillName) {
      badges.push(`\x1b[36m\u25c6 ${skillName}\x1b[0m`);
    }

    // Team badge (blue trigram)
    const teamName = data.team?.name || data.team?.id || data.organization?.name;
    if (teamName) {
      badges.push(`\x1b[34m\u2261 ${teamName}\x1b[0m`);
    }

    if (badges.length > 0) {
      segments.push(badges.join(' '));
    }

    // --- GSD project status from STATE.md ---
    const dir = data.workspace?.current_dir || data.cwd || process.cwd();
    const session = data.session_id || '';
    const { status: gsdStatus, projectRoot } = getGsdStatus(dir);
    if (gsdStatus) {
      segments.push(gsdStatus);
    }

    // --- Current task from todos ---
    const todosDir = path.join(homeDir, '.claude', 'todos');
    if (session && fs.existsSync(todosDir)) {
      try {
        const files = fs.readdirSync(todosDir)
          .filter(f => f.startsWith(session) && f.includes('-agent-') && f.endsWith('.json'))
          .map(f => ({ name: f, mtime: fs.statSync(path.join(todosDir, f)).mtime }))
          .sort((a, b) => b.mtime - a.mtime);

        if (files.length > 0) {
          const todos = JSON.parse(fs.readFileSync(path.join(todosDir, files[0].name), 'utf8'));
          const inProgress = todos.find(t => t.status === 'in_progress');
          if (inProgress && inProgress.activeForm) {
            segments.push(`\x1b[1m${inProgress.activeForm}\x1b[0m`);
          }
        }
      } catch (e) {}
    }

    // --- Directory + Git branch ---
    const dirname = path.basename(dir);
    let dirSegment = `\x1b[2m${dirname}\x1b[0m`;

    try {
      const branch = execFileSync('git', ['branch', '--show-current'], {
        cwd: dir,
        encoding: 'utf8',
        timeout: 500,
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      if (branch) {
        dirSegment += ` \x1b[36m(${branch})\x1b[0m`;
      }
    } catch (e) {}

    segments.push(dirSegment);

    // --- Lines changed (per-pane delta) ---
    const rawAdded = data.cost?.total_lines_added || 0;
    const rawRemoved = data.cost?.total_lines_removed || 0;
    const { added, removed, startTime: paneStartTime } = getPaneMetrics(rawAdded, rawRemoved);
    if (added > 0 || removed > 0) {
      segments.push(`\x1b[32m+${added}\x1b[0m/\x1b[31m-${removed}\x1b[0m`);
    }

    // --- Session cost (cumulative across /clear resets) ---
    const currentCost = data.cost?.total_cost_usd;
    if (currentCost != null) {
      const { cumulativeCost, delta } = getCumulativeCost(session, currentCost);

      // Append to per-project cost log when delta is meaningful and we have a project root
      if (projectRoot && delta > 0.001) {
        try {
          const costLogPath = path.join(projectRoot, '.planning', 'cost-log.jsonl');
          const entry = JSON.stringify({
            ts: new Date().toISOString(),
            session: session,
            delta: Math.round(delta * 10000) / 10000,
            cumulative: Math.round(cumulativeCost * 10000) / 10000
          });
          fs.appendFileSync(costLogPath, entry + '\n');
        } catch (e) {
          // Silent fail — never let cost logging break the statusline
        }
      }

      // Display: show cumulative with '+' suffix if it exceeds current session cost
      const displayCost = cumulativeCost != null ? cumulativeCost : currentCost;
      const showPlus = cumulativeCost != null && cumulativeCost > currentCost + 0.001;
      const costStr = '$' + displayCost.toFixed(2) + (showPlus ? '+' : '');

      let costColor;
      if (displayCost < 1) costColor = '32';
      else if (displayCost < 5) costColor = '33';
      else if (displayCost < 10) costColor = '38;5;208';
      else costColor = '31';
      segments.push(`\x1b[${costColor}m${costStr}\x1b[0m`);
    }

    // --- Session duration (per-pane wall clock) ---
    const paneElapsedMs = Date.now() - paneStartTime;
    if (paneElapsedMs >= 60000) {
      const totalMin = Math.floor(paneElapsedMs / 60000);
      let durStr;
      if (totalMin < 60) {
        durStr = `${totalMin}m`;
      } else {
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        durStr = m > 0 ? `${h}h${m}m` : `${h}h`;
      }
      segments.push(`\x1b[2m${durStr}\x1b[0m`);
    }

    // --- Context window bar ---
    // Write context metrics to bridge file for the context-monitor PostToolUse hook.
    const remaining = data.context_window?.remaining_percentage;
    if (remaining != null) {
      if (session) {
        try {
          const bridgePath = path.join(os.tmpdir(), `claude-ctx-${session}.json`);
          const rem = Math.round(remaining);
          const rawUsed = Math.max(0, Math.min(100, 100 - rem));
          const usedForBridge = Math.min(100, Math.round((rawUsed / 80) * 100));
          const bridgeData = JSON.stringify({
            session_id: session,
            remaining_percentage: remaining,
            used_pct: usedForBridge,
            timestamp: Math.floor(Date.now() / 1000),
            cwd: dir,
            cost: data.cost?.total_cost_usd || 0,
            lines_added: data.cost?.total_lines_added || 0,
            lines_removed: data.cost?.total_lines_removed || 0,
            duration_ms: data.cost?.total_duration_ms || 0
          });
          fs.writeFileSync(bridgePath, bridgeData);
        } catch (e) {
          // Silent fail -- bridge is best-effort, don't break statusline
        }
      }

      const rem = Math.round(remaining);
      const rawUsed = Math.max(0, Math.min(100, 100 - rem));
      const used = Math.min(100, Math.round((rawUsed / 80) * 100));

      const filled = Math.floor(used / 10);
      const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);

      let ctxStr;
      if (used < 63) {
        ctxStr = `\x1b[32m${bar} ${used}%\x1b[0m`;
      } else if (used < 81) {
        ctxStr = `\x1b[33m${bar} ${used}%\x1b[0m`;
      } else if (used < 95) {
        ctxStr = `\x1b[38;5;208m${bar} ${used}%\x1b[0m`;
      } else {
        ctxStr = `\x1b[5;31m\uD83D\uDC80 ${bar} ${used}%\x1b[0m`;
      }
      segments.push(ctxStr);
    }

    // --- Output ---
    process.stdout.write(prefix + segments.join(' \u2502 '));
  } catch (e) {
    // Silent fail - don't break statusline on parse errors
  }
});

/**
 * Accumulate session cost across /clear resets using a per-pane temp file.
 * Returns { cumulativeCost, delta } — both numbers.
 * On error, returns { cumulativeCost: currentCost, delta: 0 } as fallback.
 */
function getCumulativeCost(sessionId, currentCost) {
  if (currentCost == null) return { cumulativeCost: null, delta: 0 };
  if (!sessionId) return { cumulativeCost: currentCost, delta: 0 };

  const filePath = path.join(os.tmpdir(), `claude-cost-pane-${sessionId}.json`);
  try {
    let lastReportedCost = 0;
    let cumulativeCost = 0;

    if (fs.existsSync(filePath)) {
      const stored = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      lastReportedCost = stored.lastReportedCost || 0;
      cumulativeCost = stored.cumulativeCost || 0;
    }

    let delta;
    if (currentCost < lastReportedCost - 0.001) {
      // Cost dropped — /clear happened. Don't add noise; just record new baseline.
      delta = 0;
      lastReportedCost = currentCost;
    } else {
      delta = currentCost - lastReportedCost;
      cumulativeCost += delta;
      lastReportedCost = currentCost;
    }

    fs.writeFileSync(filePath, JSON.stringify({ lastReportedCost, cumulativeCost }));
    return { cumulativeCost, delta };
  } catch (e) {
    // Graceful fallback — just report what the session says
    return { cumulativeCost: currentCost, delta: 0 };
  }
}

/**
 * Track per-pane baselines for lines added/removed so that each tmux pane
 * shows its OWN delta rather than the shared project total.
 *
 * Baseline file: /tmp/claude-pane-metrics-{paneId}.json
 * Returns { added, removed, startTime } as display values.
 */
function getPaneMetrics(currentAdded, currentRemoved) {
  const paneId = process.env.TMUX_PANE
    ? process.env.TMUX_PANE.replace(/[^a-zA-Z0-9_-]/g, '')
    : String(process.ppid);

  const filePath = path.join(os.tmpdir(), `claude-pane-metrics-${paneId}.json`);

  try {
    let stored = {};
    if (fs.existsSync(filePath)) {
      stored = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    const addedBaseline   = stored.addedBaseline   != null ? stored.addedBaseline   : currentAdded;
    const removedBaseline = stored.removedBaseline != null ? stored.removedBaseline : currentRemoved;
    const startTime       = stored.startTime       != null ? stored.startTime       : Date.now();

    // If counters went backwards (e.g. project reset), reset baselines forward
    const effectiveAddedBaseline   = currentAdded   < addedBaseline   ? currentAdded   : addedBaseline;
    const effectiveRemovedBaseline = currentRemoved < removedBaseline ? currentRemoved : removedBaseline;

    const displayAdded   = currentAdded   - effectiveAddedBaseline;
    const displayRemoved = currentRemoved - effectiveRemovedBaseline;

    fs.writeFileSync(filePath, JSON.stringify({
      addedBaseline:   effectiveAddedBaseline,
      removedBaseline: effectiveRemovedBaseline,
      startTime
    }));

    return { added: displayAdded, removed: displayRemoved, startTime };
  } catch (e) {
    return { added: currentAdded, removed: currentRemoved, startTime: Date.now() };
  }
}

/**
 * Parse GSD project status from .planning/STATE.md
 * Walks up from startDir to find the nearest .planning/STATE.md
 * Returns { status, projectRoot } where status is a formatted ANSI string or null,
 * and projectRoot is the directory containing .planning/ or null.
 */
function getGsdStatus(startDir) {
  try {
    let dir = startDir;
    let stateFile = null;
    let projectRoot = null;

    // Walk up to find .planning/STATE.md (max 5 levels)
    for (let i = 0; i < 5; i++) {
      const candidate = path.join(dir, '.planning', 'STATE.md');
      if (fs.existsSync(candidate)) {
        stateFile = candidate;
        projectRoot = dir;
        break;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    if (!stateFile) return { status: null, projectRoot: null };

    const content = fs.readFileSync(stateFile, 'utf8');

    // Parse "Phase: [X] of [Y] ([Name])" or "Phase: X of Y (Name)"
    let phaseNum = '', phaseTotal = '', phaseName = '';
    const phaseMatch = content.match(/Phase:\s*\[?(\d+(?:\.\d+)?)\]?\s*of\s*\[?(\d+)\]?\s*(?:\(([^)]+)\))?/i);
    if (phaseMatch) {
      phaseNum = phaseMatch[1];
      phaseTotal = phaseMatch[2];
      phaseName = (phaseMatch[3] || '').trim();
    }

    // Parse "Status: ..." line
    let status = '';
    const statusMatch = content.match(/^Status:\s*(.+)/im);
    if (statusMatch) {
      status = statusMatch[1].trim();
    }

    // Parse progress percentage from "Progress: [...] XX%"
    let progress = '';
    const progressMatch = content.match(/Progress:.*?(\d+)%/i);
    if (progressMatch) {
      progress = progressMatch[1];
    }

    // Parse "Plan: [A] of [B]" for current plan within phase
    let planNum = '', planTotal = '';
    const planMatch = content.match(/Plan:\s*\[?(\d+)\]?\s*of\s*\[?(\d+)\]?/i);
    if (planMatch) {
      planNum = planMatch[1];
      planTotal = planMatch[2];
    }

    // --- Milestone detection (v3 improved) ---
    // Priority 1: Active Milestones table — find first non-completed row
    let version = '';
    let milestoneName = '';

    const activeMilestonesSection = content.match(/##\s+Active Milestones\s*\n([\s\S]*?)(?=\n##|\n---|\z)/i);
    if (activeMilestonesSection) {
      const section = activeMilestonesSection[1];
      // Match table rows: | vX.Y Some Name | Status | ... |
      const rowRegex = /^\|\s*(v[\d.]+)([^|]*)\|([^|]*)\|/gm;
      let rowMatch;
      while ((rowMatch = rowRegex.exec(section)) !== null) {
        const rowVersion = rowMatch[1].trim();
        const rowNameRest = rowMatch[2].trim();
        const rowStatus = rowMatch[3].trim().toLowerCase();
        if (rowStatus.includes('complete') || rowStatus === '---' || rowStatus === '') {
          continue;
        }
        version = rowVersion;
        milestoneName = rowNameRest.trim();
        break;
      }
      // Match list items: - vX.Y Name — Status
      if (!version) {
        const listRegex = /^[-*]\s*(v[\d.]+)\s+([^—–\n]+?)(?:\s*[—–]\s*(.*))?$/gm;
        let listMatch;
        while ((listMatch = listRegex.exec(section)) !== null) {
          const rowVersion = listMatch[1].trim();
          const rowName = listMatch[2].trim();
          const rowStatus = (listMatch[3] || '').trim().toLowerCase();
          if (rowStatus.includes('shipped') || rowStatus.includes('complete')) {
            continue;
          }
          version = rowVersion;
          milestoneName = rowName;
          break;
        }
      }
    }

    // Priority 2: last_activity line contains version hint
    if (!version) {
      const lastActivityMatch = content.match(/last_activity:.*?(v[\d.]+)/i);
      if (lastActivityMatch) {
        version = lastActivityMatch[1];
      }
    }

    // Priority 3: frontmatter milestone: field (may be stale but better than nothing)
    if (!version) {
      const versionMatch = content.match(/^milestone:\s*(v[\d.]+)/m);
      if (versionMatch) {
        version = versionMatch[1];
      }
    }

    // Milestone name: if not found from table, try frontmatter milestone_name:
    if (!milestoneName) {
      const mnMatch = content.match(/^milestone_name:\s*(?:—\s*)?(.+)/m);
      if (mnMatch) {
        milestoneName = mnMatch[1].trim();
      }
    }

    if (!phaseNum && !status && !progress && !version) return { status: null, projectRoot };

    // --- Build colorful GSD status string ---
    const RST = '\x1b[0m';
    const statusColor = getStatusColor(status);
    const parts = [];

    // "GSD" label — bold + status color
    parts.push(`\x1b[1;${statusColor}mGSD${RST}`);

    // Phase counter: "P359/366" — bright cyan
    if (phaseNum) {
      let phaseStr = `P${phaseNum}`;
      if (phaseTotal) phaseStr += `/${phaseTotal}`;
      parts.push(`\x1b[1;36m${phaseStr}${RST}`);
    }

    // Plan counter: "p941/957" — dim cyan
    if (planNum) {
      let planStr = `p${planNum}`;
      if (planTotal) planStr += `/${planTotal}`;
      parts.push(`\x1b[2;36m${planStr}${RST}`);
    }

    // Status icon — colored by status
    if (status) {
      parts.push(`\x1b[${statusColor}m${getStatusIcon(status)}${RST}`);
    }

    // Progress percentage — colored by completion level
    if (progress) {
      const pct = parseInt(progress, 10);
      const pctColor = pct >= 75 ? '1;32' : pct >= 40 ? '33' : pct > 0 ? '38;5;208' : '2';
      parts.push(`\x1b[${pctColor}m${progress}%${RST}`);
    }

    // Version — bold bright white
    if (version) {
      parts.push(`\x1b[1;97m${version}${RST}`);
    }

    // Milestone name — from table (preferred) or frontmatter or phase name fallback
    const displayName = milestoneName || stripVersionPrefix(phaseName);
    if (displayName) {
      const shortName = displayName.length > 40 ? displayName.slice(0, 39) + '\u2026' : displayName;
      parts.push(`\x1b[3;37m${shortName}${RST}`);
    }

    if (parts.length <= 1) return { status: null, projectRoot };

    return { status: parts.join(' '), projectRoot };
  } catch (e) {
    return { status: null, projectRoot: null };
  }
}

/**
 * Strip version prefix like "v1.37 — " or "v1.37 - " from a name string,
 * since version is now displayed separately
 */
function stripVersionPrefix(name) {
  if (!name) return '';
  return name.replace(/^v[\d.]+\s*[—–-]\s*/i, '').trim();
}

/** Map GSD status text to a compact icon */
function getStatusIcon(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('complete')) return '\u2714';        // ✔ heavy check
  if (s.includes('in progress')) return '\u25B8';     // ▸ right pointer
  if (s.includes('ready to execute')) return '\u25B6'; // ▶ play
  if (s.includes('planning')) return '\u270E';        // ✎ pencil
  if (s.includes('ready to plan')) return '\u2026';   // … ellipsis
  if (s.includes('blocked')) return '\u26A0';         // ⚠ warning
  return '\u2022';                                    // • bullet
}

/** Map GSD status text to ANSI color code */
function getStatusColor(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('complete')) return '32';           // green
  if (s.includes('in progress')) return '33';        // yellow
  if (s.includes('ready to execute')) return '36';   // cyan
  if (s.includes('planning')) return '35';           // magenta
  if (s.includes('blocked')) return '31';            // red
  return '37';                                       // white (not dim)
}
