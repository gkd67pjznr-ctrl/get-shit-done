/**
 * Skill-loads dashboard panel renderer.
 *
 * Renders a compact card showing top skills by load count with
 * last-seen timestamps. Pure render functions, no I/O.
 *
 * @module dashboard/skill-loads-panel
 */

import type { SkillLoadsCollectorResult } from './collectors/types.js';

/** Max skills to display in the panel. */
const MAX_DISPLAY = 15;

/**
 * Format an ISO timestamp to a compact relative or date string.
 */
function formatLastSeen(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

/**
 * Render the skill-loads panel as an HTML string.
 *
 * Shows top MAX_DISPLAY skills by load count in a compact table.
 * Returns an empty-state message when no data is available.
 *
 * @param data - Aggregated skill loads result from the collector.
 * @returns HTML string for the panel (no wrapping card — caller wraps).
 */
export function renderSkillLoadsPanel(data: SkillLoadsCollectorResult): string {
  if (data.skills.length === 0) {
    return `<p class="sl-empty">No skill loads tracked yet</p>`;
  }

  const topSkills = data.skills.slice(0, MAX_DISPLAY);

  const rows = topSkills
    .map(
      (s) => `<tr>
        <td class="sl-name">${s.skill}</td>
        <td class="sl-count">${s.count}</td>
        <td class="sl-date">${formatLastSeen(s.lastSeen)}</td>
      </tr>`,
    )
    .join('\n');

  return `<table class="sl-table">
    <thead>
      <tr>
        <th class="sl-th">Skill</th>
        <th class="sl-th sl-th-num">Loads</th>
        <th class="sl-th">Last Seen</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <p class="sl-total">Total: <span class="sl-total-num">${data.totalLoads}</span> loads</p>`;
}

/**
 * Return CSS styles for the skill-loads panel.
 */
export function renderSkillLoadsPanelStyles(): string {
  return `
/* ── Skill Loads Panel ─────────────────────────────────────────── */
.sl-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
}
.sl-th {
  text-align: left;
  color: var(--text-muted);
  font-weight: 500;
  padding: 0 var(--space-xs) var(--space-xs) 0;
  border-bottom: 1px solid var(--border);
  font-family: var(--font-ui);
}
.sl-th-num {
  text-align: right;
}
.sl-table td {
  padding: var(--space-xs) var(--space-xs) var(--space-xs) 0;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
  vertical-align: middle;
}
.sl-name {
  font-family: var(--font-mono);
  color: var(--color-observation);
  max-width: 12rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sl-count {
  font-family: var(--font-data);
  color: var(--text-primary);
  text-align: right;
  padding-right: var(--space-sm) !important;
  font-variant-numeric: tabular-nums;
}
.sl-date {
  color: var(--text-muted);
  white-space: nowrap;
}
.sl-total {
  margin-top: var(--space-sm);
  font-size: 0.72rem;
  color: var(--text-muted);
}
.sl-total-num {
  font-family: var(--font-data);
  color: var(--text-secondary);
}
.sl-empty {
  color: var(--text-muted);
  font-size: 0.82rem;
  padding: var(--space-sm) 0;
}
`;
}
