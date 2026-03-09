import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';

/**
 * Cross-project pattern dashboard page.
 * Fetches /api/patterns and displays frequency, recency, and project spread.
 *
 * PAT-04
 */
export function PatternPage() {
  const [patterns, setPatterns] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/patterns')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setPatterns(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return html`
      <div style="padding:32px; color:var(--text-muted)">
        Loading pattern data...
      </div>
    `;
  }

  if (error) {
    return html`
      <div style="padding:32px; color:var(--signal-error)">
        Failed to load patterns: ${error}
      </div>
    `;
  }

  if (!patterns || patterns.length === 0) {
    return html`
      <div style="padding:32px; color:var(--text-muted)">
        <h2 style="margin-bottom:12px;">Cross-Project Patterns</h2>
        <p>No pattern data found. Patterns are captured from
        <code>.planning/patterns/sessions.jsonl</code> in registered projects.</p>
      </div>
    `;
  }

  const maxCount = patterns[0]?.count ?? 1;

  return html`
    <div style="padding:24px; max-width:960px;">
      <h2 style="margin-bottom:4px; font-size:18px;">Cross-Project Patterns</h2>
      <p style="font-size:12px; color:var(--text-muted); margin-bottom:20px;">
        Aggregated from all registered projects' session data.
      </p>

      <table style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead>
          <tr style="border-bottom:1px solid var(--border-color);">
            <th style="text-align:left; padding:8px 12px; color:var(--text-muted); font-weight:500;">Type</th>
            <th style="text-align:left; padding:8px 12px; color:var(--text-muted); font-weight:500;">Frequency</th>
            <th style="text-align:right; padding:8px 12px; color:var(--text-muted); font-weight:500;">Count</th>
            <th style="text-align:right; padding:8px 12px; color:var(--text-muted); font-weight:500;">Projects</th>
            <th style="text-align:right; padding:8px 12px; color:var(--text-muted); font-weight:500;">Last Seen</th>
          </tr>
        </thead>
        <tbody>
          ${patterns.map((p) => {
            const barWidth = Math.round((p.count / maxCount) * 120);
            const lastSeen = p.lastSeen
              ? new Date(p.lastSeen).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              : '—';

            return html`
              <tr key=${p.type} style="border-bottom:1px solid var(--border-subtle, #2a2a2a);">
                <td style="padding:8px 12px; font-family:var(--font-data); color:var(--text-primary);">
                  ${p.type}
                </td>
                <td style="padding:8px 12px;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <div style="
                      width:${barWidth}px;
                      height:6px;
                      background:var(--signal-info, #64b5f6);
                      border-radius:3px;
                      min-width:2px;
                    "/>
                  </div>
                </td>
                <td style="padding:8px 12px; text-align:right; font-family:var(--font-data); color:var(--text-secondary);">
                  ${p.count}
                </td>
                <td style="padding:8px 12px; text-align:right;">
                  <span title=${p.projects.join(', ')} style="cursor:default; color:var(--text-secondary);">
                    ${p.projectCount} ${p.projectCount === 1 ? 'project' : 'projects'}
                  </span>
                </td>
                <td style="padding:8px 12px; text-align:right; color:var(--text-muted); font-size:12px;">
                  ${lastSeen}
                </td>
              </tr>
            `;
          })}
        </tbody>
      </table>

      <p style="font-size:11px; color:var(--text-muted); margin-top:16px;">
        ${patterns.length} distinct pattern${patterns.length !== 1 ? 's' : ''} detected.
        Run <code>/gsd:digest</code> to get a full analysis.
      </p>
    </div>
  `;
}
