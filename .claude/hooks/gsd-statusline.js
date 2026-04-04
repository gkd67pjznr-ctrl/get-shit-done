#!/usr/bin/env node
// Claude Code Statusline v4 (clean)
// Layout: model │ cwd (branch) │ [GSD vXX.0] │ context bar │ $cost │ +N/-N │ timer

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const homeDir = os.homedir();
    const segments = [];

    // --- Model (strip "1M context" / "(XM context)" suffix) ---
    let model = data.model?.display_name || 'Claude';
    model = model.replace(/\s*\([\d]+[KMB]?\s*context\)/i, '');
    let modelParts = [`\x1b[2m${model}\x1b[0m`];

    if (data.vim?.mode) {
      const isInsert = data.vim.mode === 'INSERT';
      const modeChar = isInsert ? 'I' : 'N';
      const modeColor = isInsert ? '32' : '36';
      modelParts.push(`\x1b[${modeColor}m[${modeChar}]\x1b[0m`);
    }

    segments.push(modelParts.join(' '));

    // --- Directory + Git branch ---
    const dir = data.workspace?.current_dir || data.cwd || process.cwd();
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

    // --- GSD milestone (only if .planning/STATE.md exists) ---
    const session = data.session_id || '';
    const { milestone, projectRoot } = getGsdMilestone(dir);
    if (milestone) {
      segments.push(`\x1b[1;97mGSD ${milestone}\x1b[0m`);
    }

    // --- Context window bar ---
    const remaining = data.context_window?.remaining_percentage;
    if (remaining != null) {
      // Write bridge file for context-monitor hook
      if (session) {
        try {
          const bridgePath = path.join(os.tmpdir(), `claude-ctx-${session}.json`);
          const rem = Math.round(remaining);
          const rawUsed = Math.max(0, Math.min(100, 100 - rem));
          const usedForBridge = Math.min(100, Math.round((rawUsed / 80) * 100));
          fs.writeFileSync(bridgePath, JSON.stringify({
            session_id: session,
            remaining_percentage: remaining,
            used_pct: usedForBridge,
            timestamp: Math.floor(Date.now() / 1000),
            cwd: dir,
            cost: data.cost?.total_cost_usd || 0,
            lines_added: data.cost?.total_lines_added || 0,
            lines_removed: data.cost?.total_lines_removed || 0,
            duration_ms: data.cost?.total_duration_ms || 0
          }));
        } catch (e) {}

        // Record skill token costs alongside session data (BUDG-02)
        try {
          const contextBudgetLib = require(path.join(__dirname, 'lib', 'context-budget.cjs'));
          const projectRoot = dir;
          const skillCostMap = contextBudgetLib.measureAllSkillTokenCosts(projectRoot);
          if (Object.keys(skillCostMap).length > 0) {
            const sessionsPath = path.join(projectRoot, '.planning', 'patterns', 'sessions.jsonl');
            const entry = JSON.stringify({
              type: 'skill_budget_snapshot',
              timestamp: new Date().toISOString(),
              session_id: session,
              skills_loaded: Object.keys(skillCostMap),
              skill_token_cost: skillCostMap,
            });
            fs.appendFileSync(sessionsPath, entry + '\n', 'utf-8');
          }
        } catch (e) {
          // Silent failure — never block statusline rendering
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

    // --- Session cost ---
    const currentCost = data.cost?.total_cost_usd;
    if (currentCost != null) {
      const { cumulativeCost, delta } = getCumulativeCost(session, currentCost);

      // Append to per-project cost log
      if (projectRoot && delta > 0.001) {
        try {
          const costLogPath = path.join(projectRoot, '.planning', 'cost-log.jsonl');
          fs.appendFileSync(costLogPath, JSON.stringify({
            ts: new Date().toISOString(),
            session: session,
            delta: Math.round(delta * 10000) / 10000,
            cumulative: Math.round(cumulativeCost * 10000) / 10000
          }) + '\n');
        } catch (e) {}
      }

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

    // --- Lines changed ---
    const rawAdded = data.cost?.total_lines_added || 0;
    const rawRemoved = data.cost?.total_lines_removed || 0;
    const { added, removed, startTime: paneStartTime } = getPaneMetrics(rawAdded, rawRemoved);
    if (added > 0 || removed > 0) {
      segments.push(`\x1b[32m+${added}\x1b[0m/\x1b[31m-${removed}\x1b[0m`);
    }

    // --- Pane timer ---
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

    // --- Output ---
    process.stdout.write(segments.join(' \u2502 '));
  } catch (e) {
    // Silent fail
  }
});

/**
 * Find the active milestone version from .planning/STATE.md
 * Returns just the version string like "v21.0" or null
 */
function getGsdMilestone(startDir) {
  try {
    let dir = startDir;
    let stateFile = null;
    let projectRoot = null;

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

    if (!stateFile) return { milestone: null, projectRoot: null };

    const content = fs.readFileSync(stateFile, 'utf8');

    // Find first non-shipped milestone from Active Milestones section
    const activeSec = content.match(/##\s+Active Milestones\s*\n([\s\S]*?)(?=\n##|\n---|\z)/i);
    if (activeSec) {
      // List items: - vX.Y Name — Status
      const listRegex = /^[-*]\s*(v[\d.]+)/gm;
      let match;
      while ((match = listRegex.exec(activeSec[1])) !== null) {
        const line = activeSec[1].substring(match.index, activeSec[1].indexOf('\n', match.index));
        if (!/shipped/i.test(line)) {
          return { milestone: match[1], projectRoot };
        }
      }
    }

    // Fallback: any vX.Y in the file
    const vMatch = content.match(/\b(v[\d]+\.[\d]+)\b/);
    if (vMatch) return { milestone: vMatch[1], projectRoot };

    return { milestone: null, projectRoot };
  } catch (e) {
    return { milestone: null, projectRoot: null };
  }
}

/**
 * Accumulate session cost across /clear resets
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
    return { cumulativeCost: currentCost, delta: 0 };
  }
}

/**
 * Track per-pane baselines for lines added/removed
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
