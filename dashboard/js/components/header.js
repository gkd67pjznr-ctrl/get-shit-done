import { html } from 'htm/preact';
import { projects } from '../lib/state.js';
import { sseStatus } from '../lib/sse.js';
import { navigate } from '../lib/router.js';

export function Header({ onToggleSidebar }) {
  const ps = projects.value;
  const totalProjects = ps.length;
  const totalActiveMilestones = ps.filter(p => p.milestones && p.milestones.some(m => m.active)).length;
  const totalDebt = ps.reduce((sum, p) => sum + (p.debt ? p.debt.open : 0), 0);
  const status = sseStatus.value;

  const sseColor = status === 'connected' ? 'var(--term-green)' : status === 'connecting' ? 'var(--signal-warning)' : 'var(--signal-error)';
  const sseText = status === 'connected' ? '▸ live' : status === 'connecting' ? '▸ connecting' : '▸ offline';

  return html`
    <header class="site-header">
      <button class="hamburger" onClick=${onToggleSidebar} aria-label="Toggle sidebar">☰</button>
      <span class="header-brand" style="cursor:pointer" onClick=${() => navigate('/')}>GSD</span>
      <div class="header-stats">
        <span class="header-stat"> | <strong>${totalProjects}</strong> projects</span>
        <span class="header-stat"> | <strong>${totalActiveMilestones}</strong> active</span>
        ${totalDebt > 0 ? html`<span class="header-stat"> | <strong>${totalDebt}</strong> open debt</span>` : null}
      </div>
      <div class="sse-indicator" style="color:${sseColor}">
        <span>${sseText}</span>
      </div>
    </header>
  `;
}
