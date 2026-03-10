import { html } from 'htm/preact';
import { projects } from '../lib/state.js';
import { navigate } from '../lib/router.js';
import { getActiveMilestone, healthLabel, healthClass, statusClass, parseProgress, fmtIdleDuration, fmtSessionDuration, fmtCost } from '../utils/format.js';

const SHELL_CMDS_SB = new Set(['zsh', 'bash', 'sh', 'fish', 'dash']);

function SidebarUntaggedSessions({ projects: ps, onOpenTerminal }) {
  const rows = [];
  for (const project of ps) {
    const tmux = project.tmux || { panes: [] };
    const panes = tmux.panes || [];
    const activeMilestones = project.milestones ? project.milestones.filter(m => m.active).reverse() : [];
    const completedMilestones = project.milestones ? project.milestones.filter(m => !m.active).reverse() : [];
    const milestones = activeMilestones.concat(completedMilestones.slice(0, 1)).slice(0, 6);
    const matchedPaneNames = new Set();
    if (panes.length > 0 && milestones.length > 0) {
      for (const pane of panes) {
        if (!pane.isClaude) continue;
        const m = (pane.windowName || '').match(/(\d+)$/);
        if (!m) continue;
        const num = m[1];
        const ms = milestones.find(ms => {
          const vm = ms.name.match(/^v(\d+)/);
          return vm && vm[1] === num;
        });
        if (ms) matchedPaneNames.add(pane.windowName);
      }
    }
    for (const pane of panes) {
      if (!matchedPaneNames.has(pane.windowName)) {
        rows.push({ project, pane });
      }
    }
  }

  if (rows.length === 0) return null;

  // Group by project, preserving order
  const byProject = new Map();
  for (const { project, pane } of rows) {
    if (!byProject.has(project.name)) byProject.set(project.name, { project, panes: [] });
    byProject.get(project.name).panes.push(pane);
  }

  return html`
    <div class="sidebar-untagged">
      <div class="sidebar-untagged-header">untagged</div>
      ${Array.from(byProject.values()).map(({ project, panes }) => html`
        <div key=${project.name}>
          <div class="sidebar-untagged-project">${project.display_name || project.name}</div>
          ${panes.map(pane => {
            const now = Date.now();
            const idleSecs = pane.lastActivity ? (now - pane.lastActivity) / 1000 : null;
            const isClaudeProcess = pane.command && !SHELL_CMDS_SB.has(pane.command);
            let status = 'idle';
            let statusColor = 'var(--signal-error)';
            if (idleSecs !== null) {
              if (isClaudeProcess && idleSecs < 10) { status = 'working'; statusColor = 'var(--signal-success)'; }
              else if (idleSecs < 300) { status = 'waiting'; statusColor = 'var(--signal-warning)'; }
            }
            const termTarget = pane.sessionName + ':' + (pane.windowName || pane.sessionName);
            const hasSessionData = pane.sessionCost || pane.sessionLinesAdded || pane.sessionLinesRemoved || pane.sessionDurationMs;
            return html`
              <div class="sidebar-untagged-row" key=${pane.windowName + '-' + project.name}>
                <button class="tmux-session-link sidebar-untagged-link" onClick=${(e) => {
                  e.stopPropagation();
                  onOpenTerminal && onOpenTerminal(termTarget);
                }}>${pane.windowName || pane.sessionName}</button>
                <span class="sidebar-untagged-status">
                  <span class=${status === 'waiting' ? 'shimmer-red' : ''} style="color:${statusColor};font-size:11px">${status}</span>
                  <span style="color:var(--color-testing);font-size:11px">${fmtIdleDuration(pane.lastActivity)}</span>
                </span>
                ${hasSessionData ? html`
                  <span class="sidebar-untagged-metrics">
                    ${pane.sessionLinesAdded || pane.sessionLinesRemoved ? html`<span style="color:var(--signal-success)">+${pane.sessionLinesAdded || 0}</span><span>/</span><span style="color:var(--signal-error)">-${pane.sessionLinesRemoved || 0}</span>` : ''}
                    ${pane.sessionCost ? html`<span style="color:${pane.sessionCost < 1 ? 'var(--signal-success)' : pane.sessionCost < 5 ? 'var(--signal-warning)' : 'var(--signal-error)'}">$${pane.sessionCost.toFixed(2)}</span>` : ''}
                    ${pane.sessionDurationMs ? html`<span style="color:var(--color-testing)">${fmtSessionDuration(pane.sessionDurationMs)}</span>` : ''}
                  </span>
                ` : ''}
              </div>
            `;
          })}
        </div>
      `)}
    </div>
  `;
}

function SidebarMetrics({ projects }) {
  const tracked = projects.filter(p => p.tracking !== false);
  if (tracked.length === 0) return null;

  // Aggregate phase and plan counts
  let totalPhases = 0, completedPhases = 0;
  let totalDebt = 0;
  const healthCounts = { healthy: 0, attention: 0, risk: 0 };
  const qualityCounts = { fast: 0, standard: 0, strict: 0 };

  for (const p of tracked) {
    // Quality level distribution (from project config or milestone config)
    const quality = p.quality || (p.milestones && p.milestones[0] && p.milestones[0].quality) || null;
    if (quality === 'fast') qualityCounts.fast++;
    else if (quality === 'strict') qualityCounts.strict++;
    else qualityCounts.standard++;

    for (const ms of (p.milestones || [])) {
      if (!ms.active) continue;
      const phases = ms.roadmap ? ms.roadmap.phases || [] : [];
      totalPhases += phases.length;
      completedPhases += phases.filter(ph => ph.status === 'complete').length;
    }
    if (p.debt) totalDebt += p.debt.open || 0;
    if (p.health) {
      if (p.health.level === 'success') healthCounts.healthy++;
      else if (p.health.level === 'warning') healthCounts.attention++;
      else if (p.health.level === 'error') healthCounts.risk++;
    }
  }

  const paused = projects.filter(p => p.tracking === false).length;

  return html`
    <div class="sidebar-metrics">
      <div class="sidebar-metrics-title">Cross-Project</div>
      <div class="sidebar-metric-row">
        <span class="sidebar-metric-label">Tracked</span>
        <span class="sidebar-metric-value">${tracked.length}${paused > 0 ? html` <span style="color:var(--text-muted);font-weight:normal">(${paused} paused)</span>` : null}</span>
      </div>
      ${totalPhases > 0 ? html`
        <div class="sidebar-metric-row">
          <span class="sidebar-metric-label">Phases</span>
          <span class="sidebar-metric-value">${completedPhases}/${totalPhases}</span>
        </div>
      ` : null}
      ${totalDebt > 0 ? html`
        <div class="sidebar-metric-row">
          <span class="sidebar-metric-label">Open debt</span>
          <span class="sidebar-metric-value" style="${totalDebt > 10 ? 'color:var(--signal-error)' : totalDebt > 5 ? 'color:var(--signal-warning)' : ''}">${totalDebt}</span>
        </div>
      ` : null}
      <div class="sidebar-metric-row">
        <span class="sidebar-metric-label">Quality</span>
        <span class="sidebar-metric-value" style="font-size:14px;color:var(--text-secondary)">
          ${qualityCounts.fast > 0 ? html`<span>${qualityCounts.fast}F </span>` : null}
          ${qualityCounts.standard > 0 ? html`<span>${qualityCounts.standard}S </span>` : null}
          ${qualityCounts.strict > 0 ? html`<span>${qualityCounts.strict}X</span>` : null}
        </span>
      </div>
      <div class="sidebar-health-summary">
        ${healthCounts.healthy > 0 ? html`<span style="color:var(--term-green);font-family:var(--font-data);font-size:14px">${healthCounts.healthy} healthy</span>` : null}
        ${healthCounts.attention > 0 ? html`<span style="color:var(--signal-warning);font-family:var(--font-data);font-size:14px">${healthCounts.attention} attention</span>` : null}
        ${healthCounts.risk > 0 ? html`<span style="color:var(--term-red);font-family:var(--font-data);font-size:14px">${healthCounts.risk} at risk</span>` : null}
      </div>
    </div>
  `;
}

export function Sidebar({ onClose, onOpenTerminal }) {
  const ps = projects.value;

  if (ps.length === 0) {
    return html`<nav class="sidebar"><div style="padding:16px;font-size:16px;color:var(--text-muted)">No projects</div></nav>`;
  }

  return html`
    <nav class="sidebar">
      ${ps.map(p => {
        const active = getActiveMilestone(p.milestones);
        const pct = active && active.state ? parseProgress(active.state.progress) : null;
        const activeMilestones = (p.milestones || []).filter(m => m.active).reverse();
        return html`
          <div class="sidebar-project sidebar-project-bar"
            style=${pct !== null ? `--bar-pct:${pct}%` : ''}
            key=${p.name}>
            <div class="sidebar-project-name ${p.tracking === false ? 'status-not-started' : healthClass(p.health)}"
              onClick=${() => { navigate(`/project/${encodeURIComponent(p.name)}`); onClose && onClose(); }}>
              ${p.display_name || p.name}
            </div>
            ${activeMilestones.map(ms => {
              const phases = ms.roadmap ? (ms.roadmap.phases || []) : [];
              const total = phases.length;
              const done = phases.filter(ph => ph.status === 'complete').length;
              const msStatus = ms.state && ms.state.status;
              return html`
                <div class="sidebar-milestone ${statusClass(msStatus)}" key=${ms.name}
                  onClick=${() => { navigate(`/project/${encodeURIComponent(p.name)}/${encodeURIComponent(ms.name)}`); onClose && onClose(); }}>
                  ${ms.name}${total > 0 ? html` <span style="color:var(--term-dim);font-size:14px">[${done}/${total}]</span>` : null}
                </div>
              `;
            })}
          </div>
        `;
      })}
      <${SidebarUntaggedSessions} projects=${ps} onOpenTerminal=${onOpenTerminal} />
      <${SidebarMetrics} projects=${ps} />
    </nav>
  `;
}
