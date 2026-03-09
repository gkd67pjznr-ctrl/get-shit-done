import { html } from 'htm/preact';
import { useRef, useEffect } from 'preact/hooks';
import { navigate } from '../lib/router.js';
import { ProgressBar } from './progress-bar.js';
import {
  parseProgress, fmtPct, fmtQuality, statusClass,
  getActiveMilestone, countCompletedMilestones, inferWorkflowStep
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

  const quality = fmtQuality(project.config);
  const debtOpen = project.debt ? project.debt.open : 0;
  const completedMilestones = countCompletedMilestones(project.milestones);

  // Milestones to display: active ones, or all if none active
  const milestonesToShow = project.milestones && project.milestones.length > 0
    ? project.milestones.filter(m => m.active).concat(
        project.milestones.filter(m => !m.active).slice(-1) // most recent completed
      ).slice(0, 3)
    : [];

  function handleClick() {
    if (!isStale) {
      navigate('/project/' + encodeURIComponent(project.name));
    }
  }

  return html`
    <div
      ref=${cardRef}
      class="project-card ${isStale ? 'stale' : ''} ${project._appear ? 'card-appear' : ''}"
      onClick=${handleClick}
    >
      <div class="card-header">
        <span class="card-project-name">${project.display_name || project.name}</span>
        ${quality ? html`
          <span class="quality-badge status-not-started">${quality}</span>
        ` : null}
      </div>

      <div class="card-meta">
        ${debtOpen > 0 ? html`<span class="card-meta-item"><strong>${debtOpen}</strong> open debt</span>` : null}
        ${completedMilestones > 0 ? html`<span class="card-meta-item"><strong>${completedMilestones}</strong> done</span>` : null}
      </div>

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
                  <${ProgressBar} value=${pct} shimmer=${ms.active && workflowStep === 'execute'} />
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
