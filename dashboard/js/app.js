import { render } from 'preact';
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { route } from './lib/router.js';
import { projects, loading, fetchError } from './lib/state.js';
import { connectSSE } from './lib/sse.js';
import { fetchProjects } from './lib/api.js';
import { Header } from './components/header.js';
import { Sidebar } from './components/sidebar.js';
import { ProjectCard } from './components/project-card.js';
import { ProjectDetail } from './components/project-detail.js';
import { EmptyState } from './components/empty-state.js';
import { PatternPage } from './components/pattern-page.js';
import { GateHealthPage } from './components/gate-health-page.js';
import { SkillLoadsPage } from './components/skill-loads-page.js';
import { TerminalModal } from './components/terminal-modal.js';
import { fmtCost } from './utils/format.js';

function TotalCost() {
  const ps = projects.value;
  // Sum cost from cost-log (project totals) + live session costs from panes
  let total = 0;
  for (const p of ps) {
    if (p.costLog?.total) total += p.costLog.total;
    // Add live session costs from panes not yet in cost-log
    if (p.tmux?.panes) {
      for (const pane of p.tmux.panes) {
        if (pane.sessionCost) total += pane.sessionCost;
      }
    }
  }
  if (total <= 0) return null;
  const costColor = total < 5 ? 'var(--signal-success)' : total < 20 ? 'var(--signal-warning)' : 'var(--signal-error)';
  return html`<span style="margin-left:auto; font-family:var(--font-data); font-size:15px; color:${costColor}">est. ${fmtCost(total)}</span>`;
}


function Overview({ onOpenTerminal }) {
  const ps = projects.value;
  const isLoading = loading.value;
  const err = fetchError.value;

  if (isLoading) {
    return html`
      <div style="display:flex;align-items:center;justify-content:center;min-height:60vh;color:var(--text-muted)">
        Loading projects...
      </div>
    `;
  }

  if (err) {
    return html`
      <div style="padding:32px;color:var(--signal-error)">
        Failed to load projects: ${err}
      </div>
    `;
  }

  if (ps.length === 0) {
    return html`<${EmptyState} />`;
  }

  return html`
    <div class="card-grid">
      ${ps.map(p => html`<${ProjectCard} key=${p.name} project=${p} onOpenTerminal=${onOpenTerminal} />`)}
    </div>
  `;
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openTerminalSession, setOpenTerminalSession] = useState(null);
  const r = route.value;

  return html`
    <${Header} onToggleSidebar=${() => setSidebarOpen(!sidebarOpen)} />
    <nav class="subnav">
      <a href="#/" style="color:var(--text-muted); text-decoration:none; margin-right:16px;">Overview</a>
      <a href="#/patterns" style="color:var(--text-muted); text-decoration:none; margin-right:16px;">Patterns</a>
      <a href="#/gate-health" style="color:var(--text-muted); text-decoration:none; margin-right:16px;">Gate Health</a>
      <a href="#/skill-loads" style="color:var(--text-muted); text-decoration:none; margin-right:16px;">Skills</a>
      <${TotalCost} />
    </nav>
    <div class="page-layout">
      <${Sidebar} class=${sidebarOpen ? 'open' : ''} onClose=${() => setSidebarOpen(false)} onOpenTerminal=${setOpenTerminalSession} />
      <main class="main-content">
        ${r.page === 'gate-health'
          ? html`<${GateHealthPage} />`
          : r.page === 'patterns'
            ? html`<${PatternPage} />`
            : r.page === 'skill-loads'
              ? html`<${SkillLoadsPage} />`
              : r.page === 'detail'
                ? html`<${ProjectDetail} name=${r.name} milestone=${r.milestone} />`
                : html`<${Overview} onOpenTerminal=${setOpenTerminalSession} />`
        }
      </main>
    </div>
    ${openTerminalSession && html`
      <${TerminalModal}
        sessionName=${openTerminalSession}
        onClose=${() => setOpenTerminalSession(null)}
      />
    `}
  `;
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function init() {
  try {
    const data = await fetchProjects();
    projects.value = data;
  } catch (err) {
    fetchError.value = err.message;
  } finally {
    loading.value = false;
  }

  connectSSE();
}

// Mount app
render(html`<${App} />`, document.getElementById('app'));

// Fetch initial data
init();
