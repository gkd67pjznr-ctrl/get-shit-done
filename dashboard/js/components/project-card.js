import { html } from 'htm/preact';
import { useRef, useEffect, useState } from 'preact/hooks';
import { navigate } from '../lib/router.js';
import { ProgressBar } from './progress-bar.js';
import {
  parseProgress, fmtPct, fmtQuality, statusClass,
  getActiveMilestone, countCompletedMilestones, inferWorkflowStep,
  healthLabel, healthClass, computeShimmerClass, fmtIdleDuration,
  fmtCost, fmtSessionDuration, fmtLinesChanged
} from '../utils/format.js';

// Shell commands that indicate no Claude process is running in the pane
const SHELL_CMDS = new Set(['zsh', 'bash', 'sh', 'fish', 'dash']);

// Reusable pipe separator — dim, non-selectable
const Sep = () => html`<span style="color:var(--term-dim);user-select:none"> | </span>`;

export function ProjectCard({ project, onOpenTerminal = () => {} }) {
  const cardRef = useRef(null);
  const prevFlash = useRef(null);
  const [expandedMs, setExpandedMs] = useState(new Set());

  // Trigger flash animation on SSE update
  useEffect(() => {
    if (project._flash && project._flash !== prevFlash.current && cardRef.current) {
      prevFlash.current = project._flash;
      const el = cardRef.current;
      el.classList.remove('card-flash');
      void el.offsetWidth;
      el.classList.add('card-flash');
      setTimeout(() => el.classList.remove('card-flash'), 650);
    }
  }, [project._flash]);

  const isStale = !project.state && (!project.milestones || project.milestones.length === 0);
  const health = project.health || null;
  const isPaused = project.tracking === false;
  const quality = fmtQuality(project.config);
  const debtOpen = project.debt ? project.debt.open : 0;

  // Compute per-project estimated cost
  let projectCost = 0;
  if (project.costLog?.total) projectCost += project.costLog.total;
  if (project.tmux?.panes) {
    for (const pane of project.tmux.panes) {
      if (pane.sessionCost) projectCost += pane.sessionCost;
    }
  }

  // Milestones: all active + last 2 completed
  const activeMilestones = project.milestones ? project.milestones.filter(m => m.active).reverse() : [];
  const completedMilestones_ = project.milestones ? project.milestones.filter(m => !m.active).reverse() : [];
  const milestonesToShow = project.milestones && project.milestones.length > 0
    ? activeMilestones.concat(completedMilestones_.slice(0, 2)).slice(0, 8)
    : [];

  const tmux = project.tmux || { available: false, sessions: [], panes: [] };

  // Match cc panes to milestones
  const milestonePane = new Map();
  const matchedPaneNames = new Set();
  if (tmux.panes && milestonesToShow.length > 0) {
    for (const pane of tmux.panes) {
      if (!pane.isClaude) continue;
      const m = (pane.windowName || '').match(/(\d+)$/);
      if (!m) continue;
      const num = m[1];
      const ms = milestonesToShow.find(ms => {
        const vm = ms.name.match(/^v(\d+)/);
        return vm && vm[1] === num;
      });
      if (ms) {
        if (!milestonePane.has(ms.name)) milestonePane.set(ms.name, []);
        milestonePane.get(ms.name).push(pane);
        matchedPaneNames.add(pane.windowName);
      }
    }
  }

  function handleTrackingToggle() {
    const newTracking = isPaused ? true : false;
    fetch(`/api/projects/${encodeURIComponent(project.name)}/tracking`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracking: newTracking }),
    }).catch(() => {});
  }

  function handleClick() {
    if (!isStale) {
      navigate('/project/' + encodeURIComponent(project.name));
    }
  }

  function toggleExpand(msName, e) {
    e.stopPropagation();
    setExpandedMs(prev => {
      const next = new Set(prev);
      if (next.has(msName)) next.delete(msName);
      else next.add(msName);
      return next;
    });
  }

  return html`
    <div
      ref=${cardRef}
      class="project-card ${isStale ? 'stale' : ''} ${isPaused ? 'paused' : ''} ${project._appear ? 'card-appear' : ''}"
      onClick=${handleClick}
    >
      <!-- Header row: name | health | cost | controls -->
      <div class="card-header">
        <span class="card-project-name ${isPaused ? 'status-not-started' : healthClass(health)}">${project.display_name || project.name}</span>

        ${health && !isPaused ? html`
          <${Sep} />
          <span class="health-label ${healthClass(health)}">${healthLabel(health)}</span>
        ` : null}

        ${debtOpen > 0 ? html`
          <${Sep} />
          <span style="color:var(--signal-warning);font-size:15px;flex-shrink:0">${debtOpen} debt</span>
        ` : null}

        ${!isStale ? html`
          <span style="color:var(--term-dim);user-select:none"> </span>
          <button
            class="tracking-toggle"
            onClick=${(e) => { e.stopPropagation(); handleTrackingToggle(); }}
            title=${isPaused ? 'Resume tracking' : 'Pause tracking'}
          >[${isPaused ? 'resume' : 'pause'}]</button>
        ` : null}

        ${(quality || (project.gateHealth && project.gateHealth.qualityLevel)) ? html`
          <${Sep} />
          <span class="quality-badge">${quality || project.gateHealth?.qualityLevel}</span>
        ` : null}

        <span style="flex:1"></span>

        ${projectCost > 0 ? html`
          <span style="color:${projectCost < 5 ? 'var(--signal-success)' : projectCost < 20 ? 'var(--signal-warning)' : 'var(--signal-error)'};font-size:14px;font-family:var(--font-data);flex-shrink:0;margin-right:8px">est. ${fmtCost(projectCost)}</span>
        ` : null}

        ${project.path ? html`
          <span style="color:var(--text-muted);font-size:14px;font-family:var(--font-data);white-space:nowrap;flex-shrink:0">${project.path.replace(/^\/Users\/[^/]+/, '~')}</span>
        ` : null}
      </div>

      <!-- Milestone list -->
      ${milestonesToShow.length > 0 ? html`
        <div class="card-milestone-grid">
          ${milestonesToShow.map((ms, msIdx) => {
            const state = ms.state || {};
            const pct = parseProgress(state.progress);
            const shimClass = ms.active ? computeShimmerClass(project) : '';
            const msPanes = milestonePane.get(ms.name) || [];
            const isLast = msIdx === milestonesToShow.length - 1;
            const isExpanded = expandedMs.has(ms.name);
            const phases = ms.roadmap ? ms.roadmap.phases : [];
            const displayName = ms.milestone_name || (ms.name === 'root' ? '' : ms.name);
            const isRoot = ms.name === 'root';

            return html`
              <div key=${ms.name}>
                <!-- Milestone header row -->
                <div
                  class="card-milestone-row ${isRoot ? 'card-ms-root' : ''}"
                  style="cursor:pointer"
                  onClick=${(e) => toggleExpand(ms.name, e)}
                >
                  <span class="card-ms-indicator" style="font-size:12px">${phases.length > 0 ? (isExpanded ? '▾' : '▸') : (ms.active ? '▸' : '·')}</span>
                  ${!isRoot ? html`<span class="card-ms-name" style="color:var(--term-cyan)">${ms.name}</span>` : null}
                  <span class="card-ms-phase" style="color:var(--text-primary);font-size:15px;${isRoot ? 'grid-column: 2 / 4;' : ''}">${displayName || 'Phases'}</span>
                  <span class="card-ms-bar"><${ProgressBar} value=${pct} shimmerClass=${shimClass} /></span>
                  ${msIdx === 0 && project.gateHealth && project.gateHealth.hasData ? html`
                    <span class="card-ms-meta" style="font-size:13px; color:var(--text-muted)">
                      ${project.gateHealth.totalFires} fires${project.gateHealth.warnPct > 0 ? html`, <span style="color:var(--signal-warning)">${project.gateHealth.warnPct}% warn</span>` : ''}
                    </span>
                  ` : null}
                </div>

                <!-- Tmux panes for this milestone -->
                ${msPanes.map(pane => {
                  const now = Date.now();
                  const idleSecs = pane.lastActivity ? (now - pane.lastActivity) / 1000 : null;
                  const isClaudeProcess = pane.command && !SHELL_CMDS.has(pane.command);
                  let status = 'idle';
                  let statusColor = 'var(--signal-error)';
                  if (idleSecs !== null) {
                    if (isClaudeProcess && idleSecs < 10) { status = 'working'; statusColor = 'var(--signal-success)'; }
                    else if (idleSecs < 300) { status = 'waiting'; statusColor = 'var(--signal-warning)'; }
                  }
                  const termTarget = pane.sessionName + ':' + (pane.windowName || pane.sessionName);
                  const hasSessionData = pane.sessionCost || pane.sessionLinesAdded || pane.sessionLinesRemoved || pane.sessionDurationMs;
                  return html`
                    <div class="card-milestone-row card-ms-pane-row" key=${pane.windowName}>
                      <span class="card-ms-indicator"></span>
                      <button class="tmux-session-link card-ms-pane-link" onClick=${(e) => {
                        e.stopPropagation();
                        onOpenTerminal(termTarget);
                      }}>${pane.windowName}</button>
                      <span class=${status === 'waiting' ? 'shimmer-red' : ''} style="color:${statusColor};font-size:14px">${status}</span>
                      <span style="color:var(--color-testing);font-size:14px">${fmtIdleDuration(pane.lastActivity)}</span>
                      <span class="card-ms-meta">${hasSessionData ? html`
                        ${pane.sessionLinesAdded || pane.sessionLinesRemoved ? html`<span style="color:var(--signal-success)">+${pane.sessionLinesAdded || 0}</span>/<span style="color:var(--signal-error)">-${pane.sessionLinesRemoved || 0}</span> ` : ''}${pane.sessionCost ? html`<span style="color:${pane.sessionCost < 1 ? 'var(--signal-success)' : pane.sessionCost < 5 ? 'var(--signal-warning)' : 'var(--signal-error)'}">$${pane.sessionCost.toFixed(2)}</span> ` : ''}${pane.sessionDurationMs ? html`<span style="color:var(--color-testing)">${fmtSessionDuration(pane.sessionDurationMs)}</span>` : ''}
                      ` : ''}${project.gateHealth && project.gateHealth.recentFires > 0 ? html` <span style="font-size:13px; color:var(--text-secondary); font-family:var(--font-data)">${project.gateHealth.recentFires} gates/24h</span>` : ''}</span>
                    </div>
                  `;
                })}

                <!-- Phase dropdown -->
                ${isExpanded && phases.length > 0 ? html`
                  <div class="card-phase-dropdown">
                    ${phases.map(phase => {
                      const isDone = phase.status === 'complete';
                      const phasePct = isDone ? 100 : 0;
                      return html`
                        <div class="card-phase-row" key=${phase.number || phase.name}>
                          <span class="card-phase-check" style="color:${isDone ? 'var(--signal-success)' : 'var(--term-dim)'}">${isDone ? '✓' : '○'}</span>
                          <span class="card-phase-num" style="color:var(--term-dim)">${phase.number || '—'}</span>
                          <span class="card-phase-name" style="color:${isDone ? 'var(--text-muted)' : 'var(--text-primary)'}">${phase.name}</span>
                          <span class="card-phase-bar"><${ProgressBar} value=${phasePct} width=${6} /></span>
                        </div>
                      `;
                    })}
                  </div>
                ` : null}

                ${!isLast ? html`<div class="rainbow-separator"></div>` : null}
              </div>
            `;
          })}
        </div>
      ` : null}

      ${isStale ? html`
        <div class="stale-warning">⚠ Path not found</div>
      ` : null}

    </div>
  `;
}
