import { html } from 'htm/preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { navigate } from '../lib/router.js';
import { ProgressBar } from './progress-bar.js';
import {
  parseProgress, fmtPct, fmtQuality, statusClass,
  getActiveMilestone, countCompletedMilestones, inferWorkflowStep,
  healthLabel, healthClass, computeShimmerClass, fmtIdleDuration
} from '../utils/format.js';

export function ProjectCard({ project }) {
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
  const completedMilestones = countCompletedMilestones(project.milestones);

  // Milestones to display: active ones, or all if none active
  const milestonesToShow = project.milestones && project.milestones.length > 0
    ? project.milestones.filter(m => m.active).concat(
        project.milestones.filter(m => !m.active).slice(-1) // most recent completed
      ).slice(0, 3)
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
      <div class="card-header">
        <span class="card-project-name">${project.display_name || project.name}</span>
        ${quality ? html`
          <span class="quality-badge status-not-started">${quality}</span>
        ` : null}
        ${health && !isPaused ? html`
          <span class="health-label ${healthClass(health)}">${healthLabel(health)}</span>
        ` : null}
      </div>

      <div class="card-meta">
        ${debtOpen > 0 ? html`<span class="card-meta-item"><strong>${debtOpen}</strong> open debt</span>` : null}
        ${completedMilestones > 0 ? html`<span class="card-meta-item"><strong>${completedMilestones}</strong> done</span>` : null}
      </div>

      <div class="card-session-row" style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
        ${!isStale ? html`
          <div
            class="session-badge ${sessionCount === 0 ? 'no-sessions' : ''}"
            onClick=${(e) => { e.stopPropagation(); if (sessionCount > 0) setSessionExpanded(!sessionExpanded); }}
            title=${sessionCount > 0 ? 'Click to show session details' : ''}
          >
            ${sessionCount === 0
              ? html`<span>No sessions</span>`
              : html`<span>${sessionCount} session${sessionCount !== 1 ? 's' : ''}</span><span style="color:var(--text-muted)">(${activePanes.length} active)</span>`
            }
          </div>
        ` : null}
        ${!isStale ? html`
          <button
            class="tracking-toggle"
            onClick=${(e) => { e.stopPropagation(); handleTrackingToggle(); }}
            title=${isPaused ? 'Resume tracking' : 'Pause tracking'}
          >${isPaused ? 'Resume' : 'Pause'}</button>
        ` : null}
      </div>

      ${sessionExpanded && sessionCount > 0 ? html`
        <div class="session-metadata" onClick=${(e) => e.stopPropagation()}>
          <table>
            <thead>
              <tr>
                <th>Session</th>
                <th>Win</th>
                <th>Panes</th>
                <th>Status</th>
                <th>Idle</th>
              </tr>
            </thead>
            <tbody>
              ${tmux.panes.map((pane, i) => {
                const now = Date.now();
                const idleSecs = pane.lastActivity ? (now - pane.lastActivity) / 1000 : null;
                let status = 'idle';
                if (pane.isClaude && idleSecs !== null) {
                  if (idleSecs < 10) status = 'working';
                  else if (idleSecs < 300) status = 'waiting';
                }
                return html`
                  <tr key=${i} class="${pane.isClaude ? 'claude-pane' : ''}">
                    <td>${pane.sessionName}</td>
                    <td>${pane.sessionWindows}</td>
                    <td>${pane.windowPanes}</td>
                    <td>${status}</td>
                    <td>${fmtIdleDuration(pane.lastActivity)}</td>
                  </tr>
                `;
              })}
            </tbody>
          </table>
        </div>
      ` : null}

      ${isStale ? html`
        <div class="stale-warning">⚠ Path not found</div>
      ` : null}

      ${milestonesToShow.length > 0 ? html`
        <div class="milestone-rows">
          ${milestonesToShow.map(ms => {
            const state = ms.state || {};
            const pct = parseProgress(state.progress);
            const workflowStep = inferWorkflowStep(state.status);
            const roadmap = ms.roadmap || {};
            const phases = roadmap.phases || [];
            const completedPhases = phases.filter(p => p.status === 'complete').length;

            return html`
              <div class="milestone-row" key=${ms.name}>
                <div class="milestone-row-header">
                  <span class="milestone-name">${ms.name}</span>
                  <span class="milestone-status-badge ${ms.active ? 'status-active' : 'status-complete'}">
                    ${ms.active ? 'active' : 'done'}
                  </span>
                  ${workflowStep ? html`<span class="workflow-badge">${workflowStep}</span>` : null}
                  <span class="milestone-phase-name">${state.current_phase || '—'}</span>
                  <span class="milestone-progress-text">${fmtPct(pct)}</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <${ProgressBar} value=${pct} shimmerClass=${ms.active ? computeShimmerClass(project) : ''} />
                  ${phases.length > 0 ? html`
                    <span style="font-size:11px; color:var(--text-muted); white-space:nowrap; font-family:var(--font-data)">
                      ${completedPhases}/${phases.length}
                    </span>
                  ` : null}
                </div>
              </div>
            `;
          })}
        </div>
      ` : null}
    </div>
  `;
}
