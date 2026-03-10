import { html } from 'htm/preact';
import { projects } from '../lib/state.js';
import { navigate } from '../lib/router.js';
import { getActiveMilestone, healthLabel, healthClass, statusClass, parseProgress } from '../utils/format.js';

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

export function Sidebar({ onClose }) {
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
      <${SidebarMetrics} projects=${ps} />
    </nav>
  `;
}
