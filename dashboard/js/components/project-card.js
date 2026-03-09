import { html } from 'htm/preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { navigate } from '../lib/router.js';
import { ProgressBar } from './progress-bar.js';
import {
  parseProgress, fmtPct, fmtQuality, statusClass,
  getActiveMilestone, countCompletedMilestones, inferWorkflowStep,
  healthLabel, healthClass, computeShimmerClass, fmtIdleDuration
} from '../utils/format.js';

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

  const [sessionExpanded, setSessionExpanded] = useState(false);
  const tmux = project.tmux || { available: false, sessions: [], panes: [] };
  const sessionCount = tmux.sessions ? tmux.sessions.length : 0;
  const claudePanes = tmux.panes ? tmux.panes.filter(p => p.isClaude) : [];
  const activePanes = claudePanes.filter(p => {
    if (!p.lastActivity) return false;
    return (Date.now() - p.lastActivity) < 5 * 60 * 1000; // active within 5m
  });

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
          <span style="color:var(--signal-warning);font-size:13px;flex-shrink:0">${debtOpen} debt</span>
        ` : null}

        ${!isStale ? html`
          <${Sep} />
          <span
            class="session-badge ${sessionCount === 0 ? 'no-sessions' : ''}"
            onClick=${(e) => { e.stopPropagation(); if (sessionCount > 0) setSessionExpanded(!sessionExpanded); }}
            title=${sessionCount > 0 ? 'Click to show session details' : ''}
          >
            ${sessionCount === 0
              ? html`<span>no sessions</span>`
              : html`<span>${sessionCount} session${sessionCount !== 1 ? 's' : ''}</span><span style="color:var(--text-muted)">(${activePanes.length} active)</span>`
            }
          </span>
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
          <span style="color:var(--text-muted);font-size:12px;font-family:var(--font-data);white-space:nowrap;flex-shrink:0">${project.path.replace(/^\/Users\/[^/]+/, '~')}</span>
        ` : null}
      </div>

      <!-- Milestone list — columnized grid for aligned progress bars -->
      ${milestonesToShow.length > 0 ? html`
        <div class="card-milestone-grid">
          ${milestonesToShow.map(ms => {
            const state = ms.state || {};
            const pct = parseProgress(state.progress);
            const shimClass = ms.active ? computeShimmerClass(project) : '';
            return html`
              <div class="card-milestone-row" key=${ms.name}>
                <span class="card-ms-indicator">${ms.active ? '▸' : '·'}</span>
                <span class="card-ms-name" style="color:var(--term-cyan)">${ms.name}</span>
                <span class="card-ms-phase" style="color:var(--text-secondary)">${state.current_phase || ''}</span>
                <span class="card-ms-bar"><${ProgressBar} value=${pct} shimmerClass=${shimClass} /></span>
                <span class="card-ms-pct">${pct !== null ? html`${pct}%` : ''}</span>
              </div>
            `;
          })}
        </div>
      ` : null}

      ${isStale ? html`
        <div class="stale-warning">⚠ Path not found</div>
      ` : null}

      <!-- Session expand panel -->
      ${sessionExpanded && sessionCount > 0 ? html`
        <div class="session-metadata" onClick=${(e) => e.stopPropagation()}>
          <table>
            <thead>
              <tr>
                <th>Window</th>
                <th>Status</th>
                <th>Idle</th>
              </tr>
            </thead>
            <tbody>
              ${[...tmux.panes].sort((a, b) => b.isClaude - a.isClaude || (a.windowName || '').localeCompare(b.windowName || '')).map((pane, i) => {
                const now = Date.now();
                const idleSecs = pane.lastActivity ? (now - pane.lastActivity) / 1000 : null;
                let status = 'idle';
                let statusColor = 'var(--signal-error)';
                if (pane.isClaude && idleSecs !== null) {
                  if (idleSecs < 10) { status = 'working'; statusColor = 'var(--signal-success)'; }
                  else if (idleSecs < 300) { status = 'waiting'; statusColor = 'var(--signal-warning)'; }
                }
                const termTarget = pane.sessionName + ':' + (pane.windowName || pane.sessionName);
                return html`
                  <tr key=${i} class="${pane.isClaude ? 'claude-pane' : ''}">
                    <td><button class="tmux-session-link" onClick=${(e) => {
                      e.stopPropagation();
                      onOpenTerminal(termTarget);
                    }}>${pane.windowName || pane.sessionName}</button></td>
                    <td style="color:${statusColor}">${status}</td>
                    <td>${fmtIdleDuration(pane.lastActivity)}</td>
                  </tr>
                `;
              })}
            </tbody>
          </table>
        </div>
      ` : null}
    </div>
  `;
}
