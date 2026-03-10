import { html } from 'htm/preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { navigate } from '../lib/router.js';
import { fetchProject } from '../lib/api.js';
import { ProgressBar } from './progress-bar.js';
import { parseProgress, fmtPct, statusClass } from '../utils/format.js';

function MilestoneAccordion({ milestone, openByDefault, id }) {
  const [open, setOpen] = useState(openByDefault);
  const ref = useRef(null);

  const state = milestone.state || {};
  const roadmap = milestone.roadmap || {};
  const requirements = milestone.requirements || {};
  const phases = roadmap.phases || [];
  const pct = parseProgress(state.progress);

  const completedPhases = phases.filter(p => p.status === 'complete').length;
  const totalPhases = phases.length;
  // Use STATE.md progress if available, otherwise compute from phase completion
  const effectivePct = pct !== null ? pct : (totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : null);
  const pctClass = effectivePct === null ? '' : effectivePct >= 75 ? 'pct-green' : effectivePct >= 25 ? 'pct-amber' : 'pct-red';
  const stateStatus = (state.status || '').toLowerCase();
  const isWorking = milestone.active && (
    stateStatus.includes('execut') ||
    stateStatus.includes('in-progress') ||
    stateStatus.includes('building') ||
    stateStatus.includes('in progress')
  );

  return html`
    <div class="milestone-accordion" id=${id} ref=${ref}>
      <div class="milestone-accordion-header" onClick=${() => setOpen(!open)}>
        <span class="accordion-chevron ${open ? 'open' : ''}">▶</span>
        <span class="accordion-milestone-name">${milestone.name}</span>
        <span class="accordion-milestone-status ${milestone.active ? 'status-active' : 'status-complete'}">
          ${milestone.active ? 'active' : 'completed'}
        </span>
        ${isWorking ? html`<span class="accordion-inprogress-badge">in progress</span>` : null}
        <span class="accordion-milestone-right">
          ${totalPhases > 0 ? html`<span class="accordion-phase-count">${completedPhases}/${totalPhases}</span>` : null}
          ${effectivePct !== null ? html`
            <span class="accordion-pct-bar ${pctClass}">
              <${ProgressBar} value=${effectivePct} />
            </span>
          ` : null}
        </span>
      </div>

      ${open ? html`
        <div class="milestone-accordion-body">

          ${requirements.total > 0 ? html`
            <div>
              <div class="accordion-section-title">Requirements</div>
              <div class="req-stats">
                <div>
                  <span class="req-stat-value">${requirements.complete || 0}</span>
                  <span class="req-stat-label">complete</span>
                </div>
                <div>
                  <span class="req-stat-value">${requirements.pending || 0}</span>
                  <span class="req-stat-label">pending</span>
                </div>
                <div>
                  <span class="req-stat-value">${requirements.total || 0}</span>
                  <span class="req-stat-label">total</span>
                </div>
              </div>
            </div>
          ` : null}

          ${phases.length > 0 ? html`
            <div>
              <div class="accordion-section-title">Roadmap — ${phases.filter(p => p.status === 'complete').length}/${phases.length} phases</div>
              <div class="phase-list">
                ${phases.map((p, i) => {
                  const dashIdx = p.name ? p.name.indexOf(' - ') : -1;
                  const title = dashIdx >= 0 ? p.name.slice(0, dashIdx) : p.name;
                  const desc = dashIdx >= 0 ? p.name.slice(dashIdx + 3) : null;
                  return html`
                  <div class="phase-item ${p.status}" key=${i}>
                    ${p.number ? html`<span style="font-family:var(--font-data);font-size:15px;color:var(--text-muted);width:28px;flex-shrink:0">${p.number}</span>` : null}
                    <span><span style="color:var(--term-green)">${title}</span>${desc ? html` <span style="color:var(--term-dim)">—</span> <span>${desc}</span>` : null}</span>
                  </div>
                `})}
              </div>
            </div>
          ` : null}

          ${(state.current_phase || state.last_activity) ? html`
            <div>
              <div class="accordion-section-title">State</div>
              <div style="display:flex;flex-direction:column;gap:6px;font-size:17px;color:var(--text-secondary)">
                ${state.current_phase ? html`<div>Current phase: <strong style="color:var(--text-primary)">${state.current_phase}</strong></div>` : null}
                ${state.status ? html`<div>Status: <span class="${statusClass(state.status)}">${state.status}</span></div>` : null}
                ${state.last_activity ? html`<div>Last activity: <span style="color:var(--text-muted)">${state.last_activity}</span></div>` : null}
                ${pct !== null ? html`
                  <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
                    <${ProgressBar} value=${pct} />
                    <span style="font-family:var(--font-data);font-size:16px;color:var(--text-secondary)">${fmtPct(pct)}</span>
                  </div>
                ` : null}
              </div>
            </div>
          ` : null}

        </div>
      ` : null}
    </div>
  `;
}

export function ProjectDetail({ name, milestone: deepLinkMilestone }) {
  const [project, setProject] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchProject(name)
      .then(data => { setProject(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [name]);

  // Scroll to deep-linked milestone after render
  useEffect(() => {
    if (deepLinkMilestone && project) {
      const el = document.getElementById('ms-' + deepLinkMilestone);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [deepLinkMilestone, project]);

  if (loading) {
    return html`
      <div class="detail-view" style="padding-top:48px;text-align:center;color:var(--text-muted)">
        Loading...
      </div>
    `;
  }

  if (error) {
    return html`
      <div class="detail-view" style="padding-top:48px">
        <div class="detail-back" onClick=${() => navigate('/')}>← Overview</div>
        <div style="color:var(--signal-error);margin-top:24px">Error: ${error}</div>
      </div>
    `;
  }

  const milestones = project.milestones || [];
  // Numeric version comparison (v9.0 < v10.0)
  const versionNum = (name) => {
    const parts = name.replace(/^v/, '').split('.').map(Number);
    return parts[0] * 1000 + (parts[1] || 0);
  };
  // Active milestones first, then completed, sorted by version desc
  const sorted = [...milestones].sort((a, b) => {
    if (a.active && !b.active) return -1;
    if (!a.active && b.active) return 1;
    return versionNum(b.name) - versionNum(a.name);
  });

  return html`
    <div class="detail-view">
      <div class="detail-back" onClick=${() => navigate('/')}>← Overview</div>

      <div class="detail-header">
        <h1 class="detail-project-name">${project.display_name || project.name}</h1>
        <div class="detail-project-path">${project.path}</div>
        ${project.config && project.config.core_value ? html`
          <div class="detail-project-value">${project.config.core_value}</div>
        ` : null}
      </div>

      ${sorted.length === 0 ? html`
        <div style="color:var(--text-muted);font-size:18px">No milestone data available.</div>
      ` : null}

      <div style="display:flex;flex-direction:column;gap:12px">
        ${sorted.map(ms => html`
          <${MilestoneAccordion}
            key=${ms.name}
            id=${'ms-' + ms.name}
            milestone=${ms}
            openByDefault=${ms.active}
          />
        `)}
      </div>
    </div>
  `;
}
