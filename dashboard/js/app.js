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
import { fmtCost, fmtIdleDuration, fmtSessionDuration } from './utils/format.js';

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

const SHELL_CMDS_OV = new Set(['zsh', 'bash', 'sh', 'fish', 'dash']);

function UntaggedSessions({ projects: ps, onOpenTerminal }) {
  // Collect untagged panes: all panes across all projects that are NOT
  // matched to a milestone. Replicates the dropdownPanes logic from ProjectCard.
  const rows = [];
  for (const project of ps) {
    const tmux = project.tmux || { panes: [] };
    const panes = tmux.panes || [];
    const milestones = project.milestones ? project.milestones.filter(m => m.active).reverse() : [];
    // Build matchedPaneNames set (same logic as ProjectCard)
    const matchedPaneNames = new Set();
    if (panes.length > 0 && milestones.length > 0) {
      for (const pane of panes) {
        if (!pane.isClaude) continue;
        const m = (pane.windowName || '').match(/(\d+)$/);
        if (!m) continue;
        const num = m[1];
        const ms = milestones.find(ms => {
          const vm = ms.name.match(/^v(\d+)/);
          return vm && vm[1] === num;
        });
        if (ms) matchedPaneNames.add(pane.windowName);
      }
    }
    for (const pane of panes) {
      if (!matchedPaneNames.has(pane.windowName)) {
        rows.push({ project, pane });
      }
    }
  }

  if (rows.length === 0) return null;

  return html`
    <div class="untagged-sessions">
      <div class="untagged-sessions-header">untagged sessions</div>
      <div class="card-milestone-grid" style="padding-left:var(--space-md)">
        ${rows.map(({ project, pane }) => {
          const now = Date.now();
          const idleSecs = pane.lastActivity ? (now - pane.lastActivity) / 1000 : null;
          const isClaudeProcess = pane.command && !SHELL_CMDS_OV.has(pane.command);
          let status = 'idle';
          let statusColor = 'var(--signal-error)';
          if (idleSecs !== null) {
            if (isClaudeProcess && idleSecs < 10) { status = 'working'; statusColor = 'var(--signal-success)'; }
            else if (idleSecs < 300) { status = 'waiting'; statusColor = 'var(--signal-warning)'; }
          }
          const termTarget = pane.sessionName + ':' + (pane.windowName || pane.sessionName);
          const hasSessionData = pane.sessionCost || pane.sessionLinesAdded || pane.sessionLinesRemoved || pane.sessionDurationMs;
          return html`
            <div class="card-milestone-row card-ms-pane-row" key=${pane.windowName + '-' + project.name}>
              <span class="card-ms-indicator" style="color:var(--text-muted);font-size:13px" title=${project.display_name || project.name}>${(project.display_name || project.name).slice(0, 3)}</span>
              <button class="tmux-session-link card-ms-pane-link" onClick=${(e) => {
                e.stopPropagation();
                onOpenTerminal(termTarget);
              }}>${pane.windowName || pane.sessionName}</button>
              <span class=${status === 'waiting' ? 'shimmer-red' : ''} style="color:${statusColor};font-size:14px">${status}</span>
              <span style="color:var(--text-muted);font-size:14px">${fmtIdleDuration(pane.lastActivity)}</span>
              <span class="card-ms-meta">${hasSessionData ? html`
                ${pane.sessionLinesAdded || pane.sessionLinesRemoved ? html`<span style="color:var(--signal-success)">+${pane.sessionLinesAdded || 0}</span>/<span style="color:var(--signal-error)">-${pane.sessionLinesRemoved || 0}</span> ` : ''}${pane.sessionCost ? html`<span style="color:${pane.sessionCost < 1 ? 'var(--signal-success)' : pane.sessionCost < 5 ? 'var(--signal-warning)' : 'var(--signal-error)'}">$${pane.sessionCost.toFixed(2)}</span> ` : ''}${fmtSessionDuration(pane.sessionDurationMs) || ''}
              ` : ''}</span>
            </div>
          `;
        })}
      </div>
    </div>
  `;
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
    <${UntaggedSessions} projects=${ps} onOpenTerminal=${onOpenTerminal} />
    <div style="text-align:center; font-size:14px; color:var(--text-muted); padding: 8px; font-family:var(--font-data);">
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
    <nav style="position:sticky; top:var(--header-height); z-index:99; background:var(--bg-base); padding:4px 16px; border-bottom:1px solid var(--border-subtle,#2a2a2a); font-size:16px; display:flex; align-items:center;">
      <a href="#/" style="color:var(--text-muted); text-decoration:none; margin-right:16px;">Overview</a>
      <a href="#/patterns" style="color:var(--text-muted); text-decoration:none;">Patterns</a>
      <${TotalCost} />
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
