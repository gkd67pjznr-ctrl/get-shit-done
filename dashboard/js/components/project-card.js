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

  // Milestones to display: all active ones + most recent completed (cap 6)
  const activeMilestones = project.milestones ? project.milestones.filter(m => m.active) : [];
  const completedMilestones_ = project.milestones ? project.milestones.filter(m => !m.active) : [];
  const milestonesToShow = project.milestones && project.milestones.length > 0
    ? activeMilestones.concat(completedMilestones_.slice(-1)).slice(0, 6)
    : [];

  // Primary milestone for inline display
  const primaryMs = milestonesToShow[0] || null;
  const extraMilestones = milestonesToShow.slice(1);

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

  // Primary milestone info
  let primaryMsName = null, primaryPhase = null, primaryPct = null, primaryShimmerClass = '';
  if (primaryMs) {
    const state = primaryMs.state || {};
    primaryMsName = primaryMs.name;
    primaryPhase = state.current_phase || null;
    primaryPct = parseProgress(state.progress);
    primaryShimmerClass = primaryMs.active ? computeShimmerClass(project) : '';
  }

  return html`
    <div
      ref=${cardRef}
      class="project-card ${isStale ? 'stale' : ''} ${isPaused ? 'paused' : ''} ${project._appear ? 'card-appear' : ''}"
      onClick=${handleClick}
    >
      <!-- Primary row: name | milestone | phase | progress | health | sessions [toggle] -->
      <div class="card-header">
        <span class="card-project-name ${isPaused ? 'status-not-started' : healthClass(health)}">${project.display_name || project.name}</span>

        ${primaryMsName ? html`
          <${Sep} />
          <span style="color:var(--term-cyan);font-size:11px;flex-shrink:0">${primaryMsName}</span>
        ` : null}

        ${primaryPhase ? html`
          <${Sep} />
          <span style="color:var(--text-secondary);font-size:11px;flex-shrink:0">${primaryPhase}</span>
        ` : null}

        ${primaryPct !== null ? html`
          <${Sep} />
          <${ProgressBar} value=${primaryPct} shimmerClass=${primaryShimmerClass} />
        ` : null}

        ${health && !isPaused ? html`
          <${Sep} />
          <span class="health-label ${healthClass(health)}">${healthLabel(health)}</span>
        ` : null}

        ${debtOpen > 0 ? html`
          <${Sep} />
          <span style="color:var(--signal-warning);font-size:11px;flex-shrink:0">${debtOpen} debt</span>
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
      </div>

      <!-- Additional active milestones beyond the first -->
      ${extraMilestones.filter(ms => ms.active).map(ms => {
        const state = ms.state || {};
        const pct = parseProgress(state.progress);
        const shimClass = computeShimmerClass(project);
        return html`
          <div style="padding-left:var(--space-md);font-family:var(--font-data);font-size:11px;color:var(--term-dim);display:flex;align-items:center;gap:6px" key=${ms.name}>
            <span>▸</span>
            <span style="color:var(--term-cyan)">${ms.name}</span>
            ${state.current_phase ? html`<${Sep} /><span style="color:var(--text-secondary)">${state.current_phase}</span>` : null}
            <${Sep} />
            <${ProgressBar} value=${pct} shimmerClass=${shimClass} />
          </div>
        `;
      })}

      ${isStale ? html`
        <div class="stale-warning">⚠ Path not found</div>
      ` : null}

      <!-- Session expand panel -->
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
    </div>
  `;
}
