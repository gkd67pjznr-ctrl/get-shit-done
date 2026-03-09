import { html } from 'htm/preact';
import { projects } from '../lib/state.js';
import { navigate } from '../lib/router.js';
import { getActiveMilestone } from '../utils/format.js';

export function Sidebar({ onClose }) {
  const ps = projects.value;

  if (ps.length === 0) {
    return html`<nav class="sidebar"><div style="padding:16px;font-size:12px;color:var(--text-muted)">No projects</div></nav>`;
  }

  return html`
    <nav class="sidebar">
      ${ps.map(p => {
        const active = getActiveMilestone(p.milestones);
        return html`
          <div class="sidebar-project" key=${p.name}>
            <div class="sidebar-project-name" onClick=${() => { navigate(`/project/${encodeURIComponent(p.name)}`); onClose && onClose(); }}>
              ${p.display_name || p.name}
            </div>
            ${active ? html`
              <div class="sidebar-milestone" onClick=${() => { navigate(`/project/${encodeURIComponent(p.name)}/${encodeURIComponent(active.name)}`); onClose && onClose(); }}>
                ${active.name}
              </div>
            ` : null}
          </div>
        `;
      })}
    </nav>
  `;
}
