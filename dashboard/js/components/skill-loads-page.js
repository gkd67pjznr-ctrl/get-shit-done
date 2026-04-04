import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';

/**
 * Cross-project skill loads dashboard page.
 * Fetches /api/skill-loads and displays load frequency per skill.
 */
export function SkillLoadsPage() {
  const [skills, setSkills] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/skill-loads')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setSkills(data);
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
        Loading skill load data...
      </div>
    `;
  }

  if (error) {
    return html`
      <div style="padding:32px; color:var(--signal-error)">
        Failed to load skill data: ${error}
      </div>
    `;
  }

  if (!skills || skills.length === 0) {
    return html`
      <div style="padding:32px; color:var(--text-muted)">
        <h2 style="margin-bottom:12px;">Skill Loads</h2>
        <p>No skill load data yet. The tracking hook logs each skill activation to
        <code>.planning/patterns/skill-loads.jsonl</code>.</p>
        <p style="margin-top:8px;">Use any skill (e.g. <code>/commit</code>, <code>/code-review</code>) to start tracking.</p>
      </div>
    `;
  }

  const maxCount = skills[0]?.count ?? 1;
  const totalLoads = skills.reduce((sum, s) => sum + s.count, 0);

  return html`
    <div style="padding:24px; max-width:960px;">
      <h2 style="margin-bottom:4px; font-size:22px;">Skill Loads</h2>
      <p style="font-size:16px; color:var(--text-muted); margin-bottom:20px;">
        ${totalLoads} total load${totalLoads !== 1 ? 's' : ''} across ${skills.length} skill${skills.length !== 1 ? 's' : ''}.
        Aggregated from all registered projects.
      </p>

      <table style="width:100%; border-collapse:collapse; font-size:17px;">
        <thead>
          <tr style="border-bottom:1px solid var(--border-color);">
            <th style="text-align:left; padding:8px 12px; color:var(--text-muted); font-weight:500;">Skill</th>
            <th style="text-align:left; padding:8px 12px; color:var(--text-muted); font-weight:500;">Frequency</th>
            <th style="text-align:right; padding:8px 12px; color:var(--text-muted); font-weight:500;">Loads</th>
            <th style="text-align:right; padding:8px 12px; color:var(--text-muted); font-weight:500;">Projects</th>
            <th style="text-align:right; padding:8px 12px; color:var(--text-muted); font-weight:500;">Last Seen</th>
          </tr>
        </thead>
        <tbody>
          ${skills.map((s) => {
            const barWidth = Math.round((s.count / maxCount) * 120);
            const lastSeen = s.lastSeen
              ? formatRelativeTime(s.lastSeen)
              : '—';

            return html`
              <tr key=${s.skill} style="border-bottom:1px solid var(--border-subtle, #2a2a2a);">
                <td style="padding:8px 12px; font-family:var(--font-data); color:var(--text-primary);">
                  ${s.skill}
                </td>
                <td style="padding:8px 12px;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <div style="
                      width:${barWidth}px;
                      height:6px;
                      background:var(--color-observation, #39d2c0);
                      border-radius:3px;
                      min-width:2px;
                    "/>
                  </div>
                </td>
                <td style="padding:8px 12px; text-align:right; font-family:var(--font-data); color:var(--text-secondary);">
                  ${s.count}
                </td>
                <td style="padding:8px 12px; text-align:right;">
                  <span title=${s.projects.join(', ')} style="cursor:default; color:var(--text-secondary);">
                    ${s.projectCount} ${s.projectCount === 1 ? 'project' : 'projects'}
                  </span>
                </td>
                <td style="padding:8px 12px; text-align:right; color:var(--text-muted); font-size:16px;">
                  ${lastSeen}
                </td>
              </tr>
            `;
          })}
        </tbody>
      </table>
    </div>
  `;
}

function formatRelativeTime(isoString) {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
