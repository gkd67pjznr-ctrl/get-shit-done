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
import { TerminalModal } from './components/terminal-modal.js';

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
    <div style="text-align:center; font-size:12px; color:var(--text-muted); padding: 8px; font-family:var(--font-data);">
      Tip: Name Claude Code tmux sessions starting with <code>cc</code> for session tracking
    </div>
  `;
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openTerminalSession, setOpenTerminalSession] = useState(null);
  const r = route.value;

  return html`
    <${Header} onToggleSidebar=${() => setSidebarOpen(!sidebarOpen)} />
    <nav style="padding:4px 16px; border-bottom:1px solid var(--border-subtle,#2a2a2a); font-size:14px;">
      <a href="#/" style="color:var(--text-muted); text-decoration:none; margin-right:16px;">Overview</a>
      <a href="#/patterns" style="color:var(--text-muted); text-decoration:none;">Patterns</a>
    </nav>
    <div class="page-layout">
      <${Sidebar} class=${sidebarOpen ? 'open' : ''} onClose=${() => setSidebarOpen(false)} />
      <main class="main-content">
        ${r.page === 'patterns'
          ? html`<${PatternPage} />`
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
