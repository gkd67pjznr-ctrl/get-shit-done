import { html } from 'htm/preact';
import { useRef, useEffect } from 'preact/hooks';
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

  // Trigger flash animation on SSE update
  useEffect(() => {
    if (project._flash && project._flash !== prevFlash.current && cardRef.current) {
      prevFlash.current = project._flash;
      const el = cardRef.current;
      el.classList.remove('card-flash');
      // Force reflow to restart animation
      void el.offsetWidth;
      el.classList.add('card-flash');
      setTimeout(() => el.classList.remove('card-flash'), 650);
    }
  }, [project._flash]);

  // Check if project path is stale (no state data and no milestones)
  const isStale = !project.state && (!project.milestones || project.milestones.length === 0);

  const health = project.health || null;
  const isPaused = project.tracking === false;

  const quality = fmtQuality(project.config);
  const debtOpen = project.debt ? project.debt.open : 0;

  // Milestones to display: all active ones + most recent completed (cap 6)
  const activeMilestones = project.milestones ? project.milestones.filter(m => m.active).reverse() : [];
  const completedMilestones_ = project.milestones ? project.milestones.filter(m => !m.active).reverse() : [];
  const milestonesToShow = project.milestones && project.milestones.length > 0
    ? activeMilestones.concat(completedMilestones_.slice(0, 1)).slice(0, 6)
    : [];

  const tmux = project.tmux || { available: false, sessions: [], panes: [] };

  // Match cc panes to milestones by extracting trailing number from window name
  // ccgr13 → 13 → v13.x, ccgsdv5 → 5 → v5.x, ccgrdebt → no match
  const milestonePane = new Map(); // milestone name → [pane, ...]
  const matchedPaneNames = new Set();
  if (tmux.panes && milestonesToShow.length > 0) {
    for (const pane of tmux.panes) {
      if (!pane.isClaude) continue;
      const m = (pane.windowName || '').match(/(\d+)$/);
      if (!m) continue;
      const num = m[1];
      // Find milestone whose version starts with this number (v13.0, v13.1, etc.)
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
    }).catch(() => { /* SSE will update state on success; ignore failure silently */ });
  }

  function handleClick() {
    if (!isStale) {
      navigate('/project/' + encodeURIComponent(project.name));
    }
  }

  return html`
    <div
      ref=${cardRef}
      class="project-card ${isStale ? 'stale' : ''} ${isPaused ? 'paused' : ''} ${project._appear ? 'card-appear' : ''}"
      onClick=${handleClick}
    >
      <!-- Header row: name | health | sessions | controls -->
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

        ${quality ? html`
          <${Sep} />
          <span class="quality-badge">${quality}</span>
        ` : null}

        ${project.path ? html`
          <span style="flex:1"></span>
          <span style="color:var(--text-muted);font-size:14px;font-family:var(--font-data);white-space:nowrap;flex-shrink:0">${project.path.replace(/^\/Users\/[^/]+/, '~')}</span>
        ` : null}
      </div>

      <!-- Milestone list — columnized grid for aligned progress bars -->
      ${milestonesToShow.length > 0 ? html`
        <div class="card-milestone-grid">
          ${milestonesToShow.map(ms => {
            const state = ms.state || {};
            const pct = parseProgress(state.progress);
            const shimClass = ms.active ? computeShimmerClass(project) : '';
            const msPanes = milestonePane.get(ms.name) || [];
            return html`
              <div
                class="card-milestone-row"
                key=${ms.name}
                style="cursor:pointer"
                title="View ${ms.name} details"
                onClick=${(e) => { e.stopPropagation(); navigate('/project/' + encodeURIComponent(project.name) + '/' + encodeURIComponent(ms.name)); }}
              >
                <span class="card-ms-indicator">${ms.active ? '▸' : '·'}</span>
                <span class="card-ms-name" style="color:var(--term-cyan)">${ms.name}</span>
                <span class="card-ms-phase" style="color:var(--text-secondary)">${state.current_phase || ''}</span>
                <span class="card-ms-bar"><${ProgressBar} value=${pct} shimmerClass=${shimClass} /></span>
                <span></span>
              </div>
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
                // Per-session metrics from bridge files
                const hasSessionData = pane.sessionCost || pane.sessionLinesAdded || pane.sessionLinesRemoved || pane.sessionDurationMs;
                return html`
                  <div class="card-milestone-row card-ms-pane-row" key=${pane.windowName}>
                    <span class="card-ms-indicator"></span>
                    <button class="tmux-session-link card-ms-pane-link" onClick=${(e) => {
                      e.stopPropagation();
                      onOpenTerminal(termTarget);
                    }}>${pane.windowName}</button>
                    <span class=${status === 'waiting' ? 'shimmer-red' : ''} style="color:${statusColor};font-size:14px">${status}</span>
                    <span style="color:var(--text-muted);font-size:14px">${fmtIdleDuration(pane.lastActivity)}</span>
                    <span class="card-ms-meta">${hasSessionData ? html`
                      ${pane.sessionLinesAdded || pane.sessionLinesRemoved ? html`<span style="color:var(--signal-success)">+${pane.sessionLinesAdded || 0}</span>/<span style="color:var(--signal-error)">-${pane.sessionLinesRemoved || 0}</span> ` : ''}${pane.sessionCost ? html`<span style="color:${pane.sessionCost < 1 ? 'var(--signal-success)' : pane.sessionCost < 5 ? 'var(--signal-warning)' : 'var(--signal-error)'}">$${pane.sessionCost.toFixed(2)}</span> ` : ''}${fmtSessionDuration(pane.sessionDurationMs) || ''}
                    ` : ''}</span>
                  </div>
                `;
              })}
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
