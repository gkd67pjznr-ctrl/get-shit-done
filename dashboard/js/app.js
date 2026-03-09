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

function Overview() {
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
      ${ps.map(p => html`<${ProjectCard} key=${p.name} project=${p} />`)}
    </div>
  `;
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const r = route.value;

  return html`
    <${Header} onToggleSidebar=${() => setSidebarOpen(!sidebarOpen)} />
    <div class="page-layout">
      <${Sidebar} class=${sidebarOpen ? 'open' : ''} onClose=${() => setSidebarOpen(false)} />
      <main class="main-content">
        ${r.page === 'detail'
          ? html`<${ProjectDetail} name=${r.name} milestone=${r.milestone} />`
          : html`<${Overview} />`
        }
      </main>
    </div>
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
