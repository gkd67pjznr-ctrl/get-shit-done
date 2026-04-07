import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';

/**
 * Skills dashboard page — skill loads, observation stats, and refinement suggestions.
 * Fetches /api/skills (combined endpoint) for skill loads + observation data.
 */
export function SkillLoadsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/skills')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        // Fallback: try legacy endpoint if /api/skills not available (server restart needed)
        fetch('/api/skill-loads')
          .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
          .then((skills) => {
            setData({ skillLoads: skills, observations: {} });
            setLoading(false);
          })
          .catch((err) => {
            setError(err.message + ' — restart dashboard server to enable full Skills view');
            setLoading(false);
          });
      });
  }, []);

  if (loading) {
    return html`<div style="padding:32px; color:var(--text-muted)">Loading skills data...</div>`;
  }

  if (error) {
    return html`<div style="padding:32px; color:var(--signal-error)">Failed to load skills data: ${error}</div>`;
  }

  const skills = data?.skillLoads || [];
  const obs = data?.observations || {};
  const totals = obs.totals || {};
  const suggestions = obs.suggestions || {};
  const categories = obs.correctionsByCategory || [];
  const projects = obs.projects || [];
  const preferences = obs.preferences || [];
  const refinedItems = suggestions.refinedItems || [];

  const maxCount = skills[0]?.count ?? 1;
  const totalLoads = skills.reduce((sum, s) => sum + s.count, 0);

  return html`
    <div style="padding:24px; max-width:1060px;">
      <h2 style="margin-bottom:4px; font-size:22px;">Skills</h2>

      <!-- Stats row -->
      <div style="display:flex; gap:24px; margin-bottom:24px; flex-wrap:wrap;">
        <${StatCard} label="Skill Loads" value=${totalLoads} sub=${`${skills.length} skills`} color="var(--color-observation, #39d2c0)" />
        <${StatCard} label="Corrections" value=${totals.corrections || 0} sub=${`${categories.length} categories`} color="var(--signal-warning)" />
        <${StatCard} label="Sessions" value=${totals.sessions || 0} sub=${`${projects.length} projects`} color="var(--term-cyan)" />
        <${StatCard} label="Gate Fires" value=${totals.gateExecutions || 0} color="var(--text-muted)" />
        <${StatCard} label="Preferences" value=${totals.preferences || 0} sub="learned" color="var(--signal-success)" />
        ${suggestions.pending > 0 ? html`
          <${StatCard}
            label="Refinements"
            value=${suggestions.pending}
            sub="pending"
            color="var(--signal-error)"
            highlight=${true}
          />
        ` : html`
          <${StatCard} label="Refinements" value=${suggestions.refined || 0} sub="applied" color="var(--signal-success)" />
        `}
      </div>

      <!-- Refinement suggestions banner -->
      ${suggestions.pending > 0 ? html`
        <div style="
          background:rgba(255,107,107,0.08);
          border:1px solid rgba(255,107,107,0.25);
          border-radius:8px;
          padding:16px 20px;
          margin-bottom:24px;
        ">
          <div style="font-size:17px; color:var(--signal-error); margin-bottom:8px; font-weight:600;">
            ${suggestions.pending} skill refinement${suggestions.pending !== 1 ? 's' : ''} available
          </div>
          <div style="font-size:15px; color:var(--text-secondary); margin-bottom:12px;">
            Pattern analysis found recurring corrections that could improve skill instructions.
          </div>
          ${suggestions.items?.map(s => html`
            <div key=${s.id} style="
              display:flex; align-items:center; gap:12px;
              padding:6px 0;
              font-size:15px;
              border-bottom:1px solid rgba(255,255,255,0.05);
            ">
              <span style="color:var(--text-primary); font-family:var(--font-data);">${s.targetSkill}</span>
              <span style="color:var(--text-muted);">${s.category}</span>
              <span style="color:var(--signal-warning); font-size:14px;">${s.correctionCount} corrections</span>
              <span style="color:var(--text-muted); font-size:14px;">${s.project}</span>
            </div>
          `)}
          <div style="margin-top:14px; font-size:14px; color:var(--text-muted); font-family:var(--font-data);">
            Run: <code style="color:var(--term-cyan);">/gsd:suggest</code> to review and accept/dismiss
            <span style="margin:0 8px; color:var(--term-dim);">|</span>
            <code style="color:var(--term-cyan);">/gsd:digest</code> for full pattern analysis
          </div>
        </div>
      ` : null}

      <!-- Preferences learned -->
      ${preferences.length > 0 ? html`
        <div style="margin-bottom:24px;">
          <h3 style="font-size:17px; color:var(--text-muted); margin-bottom:12px;">Preferences Learned</h3>
          <p style="font-size:14px; color:var(--text-muted); margin-bottom:12px;">
            Patterns promoted from repeated corrections. These shape how Claude behaves in future sessions.
          </p>
          ${preferences.map((p, i) => html`
            <div key=${i} style="
              background:rgba(255,255,255,0.03);
              border:1px solid var(--border-subtle, #2a2a2a);
              border-radius:8px;
              padding:14px 18px;
              margin-bottom:10px;
            ">
              <div style="display:flex; align-items:baseline; gap:12px; margin-bottom:6px;">
                <span style="
                  font-size:12px;
                  padding:2px 8px;
                  border-radius:4px;
                  background:rgba(57,210,192,0.12);
                  color:var(--color-observation, #39d2c0);
                  font-family:var(--font-data);
                ">${p.category}</span>
                <span style="font-size:13px; color:var(--text-muted);">${p.scope} scope</span>
                <span style="font-size:13px; color:var(--text-muted);">${p.sourceCount} correction${p.sourceCount !== 1 ? 's' : ''}</span>
                <span style="font-size:13px; color:var(--signal-success);">${Math.round((p.confidence || 0) * 100)}% confidence</span>
              </div>
              <div style="font-size:15px; color:var(--text-primary); line-height:1.5;">
                ${p.text}
              </div>
              <div style="font-size:13px; color:var(--text-muted); margin-top:6px;">
                ${p.project} · learned ${p.createdAt ? formatRelativeTime(p.createdAt) : '—'}${p.updatedAt && p.updatedAt !== p.createdAt ? html` · updated ${formatRelativeTime(p.updatedAt)}` : ''}
              </div>
            </div>
          `)}
        </div>
      ` : null}

      <!-- Refinements applied -->
      ${refinedItems.length > 0 ? html`
        <div style="margin-bottom:24px;">
          <h3 style="font-size:17px; color:var(--text-muted); margin-bottom:12px;">Refinements Applied</h3>
          <p style="font-size:14px; color:var(--text-muted); margin-bottom:12px;">
            Skill instructions that were modified based on pattern analysis of recurring corrections.
          </p>
          ${refinedItems.map((r, i) => html`
            <div key=${r.id || i} style="
              background:rgba(255,255,255,0.03);
              border:1px solid var(--border-subtle, #2a2a2a);
              border-radius:8px;
              padding:14px 18px;
              margin-bottom:10px;
            ">
              <div style="display:flex; align-items:baseline; gap:12px; margin-bottom:6px;">
                <span style="
                  font-size:14px;
                  font-family:var(--font-data);
                  color:var(--text-primary);
                  font-weight:600;
                ">${r.targetSkill}</span>
                <span style="
                  font-size:12px;
                  padding:2px 8px;
                  border-radius:4px;
                  background:rgba(255,179,71,0.12);
                  color:var(--signal-warning);
                  font-family:var(--font-data);
                ">${r.category}</span>
                <span style="font-size:13px; color:var(--signal-warning);">${r.correctionCount} corrections triggered this</span>
              </div>
              ${r.sampleCorrections && r.sampleCorrections.length > 0 ? html`
                <div style="font-size:14px; color:var(--text-secondary); margin-top:4px; line-height:1.5;">
                  ${[...new Set(r.sampleCorrections)].map((s, j) => html`
                    <div key=${j} style="padding:2px 0;">
                      <span style="color:var(--text-muted); margin-right:6px;">·</span>${s}
                    </div>
                  `)}
                </div>
              ` : null}
              <div style="font-size:13px; color:var(--text-muted); margin-top:6px;">
                ${r.project} · refined ${r.refinedAt ? formatRelativeTime(r.refinedAt) : '—'}
              </div>
            </div>
          `)}
        </div>
      ` : null}

      <!-- Two-column layout: skill loads + correction categories -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:24px;">

        <!-- Skill loads table -->
        <div>
          <h3 style="font-size:17px; color:var(--text-muted); margin-bottom:12px;">Skill Activations</h3>
          ${skills.length === 0 ? html`
            <p style="color:var(--text-muted); font-size:15px;">
              No skill load data yet. Use any skill to start tracking.
            </p>
          ` : html`
            <table style="width:100%; border-collapse:collapse; font-size:15px;">
              <thead>
                <tr style="border-bottom:1px solid var(--border-color);">
                  <th style="text-align:left; padding:6px 8px; color:var(--text-muted); font-weight:500;">Skill</th>
                  <th style="text-align:left; padding:6px 8px; color:var(--text-muted); font-weight:500; width:140px;"></th>
                  <th style="text-align:right; padding:6px 8px; color:var(--text-muted); font-weight:500;">Loads</th>
                  <th style="text-align:right; padding:6px 8px; color:var(--text-muted); font-weight:500;">Last</th>
                </tr>
              </thead>
              <tbody>
                ${skills.map((s) => html`
                  <tr key=${s.skill} style="border-bottom:1px solid var(--border-subtle, #2a2a2a);">
                    <td style="padding:6px 8px; font-family:var(--font-data); color:var(--text-primary);">${s.skill}</td>
                    <td style="padding:6px 8px;">
                      <div style="width:${Math.round((s.count / maxCount) * 120)}px; height:5px; background:var(--color-observation, #39d2c0); border-radius:3px; min-width:2px;" />
                    </td>
                    <td style="padding:6px 8px; text-align:right; font-family:var(--font-data); color:var(--text-secondary);">${s.count}</td>
                    <td style="padding:6px 8px; text-align:right; color:var(--text-muted); font-size:14px;">${s.lastSeen ? formatRelativeTime(s.lastSeen) : '—'}</td>
                  </tr>
                `)}
              </tbody>
            </table>
          `}
        </div>

        <!-- Correction categories -->
        <div>
          <h3 style="font-size:17px; color:var(--text-muted); margin-bottom:12px;">Correction Categories</h3>
          ${categories.length === 0 ? html`
            <p style="color:var(--text-muted); font-size:15px;">No corrections recorded yet.</p>
          ` : html`
            <table style="width:100%; border-collapse:collapse; font-size:15px;">
              <thead>
                <tr style="border-bottom:1px solid var(--border-color);">
                  <th style="text-align:left; padding:6px 8px; color:var(--text-muted); font-weight:500;">Category</th>
                  <th style="text-align:left; padding:6px 8px; color:var(--text-muted); font-weight:500; width:140px;"></th>
                  <th style="text-align:right; padding:6px 8px; color:var(--text-muted); font-weight:500;">Count</th>
                </tr>
              </thead>
              <tbody>
                ${categories.map((c) => {
                  const maxCat = categories[0]?.count ?? 1;
                  return html`
                    <tr key=${c.category} style="border-bottom:1px solid var(--border-subtle, #2a2a2a);">
                      <td style="padding:6px 8px; font-family:var(--font-data); color:var(--text-primary);">${c.category}</td>
                      <td style="padding:6px 8px;">
                        <div style="width:${Math.round((c.count / maxCat) * 120)}px; height:5px; background:var(--signal-warning); border-radius:3px; min-width:2px;" />
                      </td>
                      <td style="padding:6px 8px; text-align:right; font-family:var(--font-data); color:var(--text-secondary);">${c.count}</td>
                    </tr>
                  `;
                })}
              </tbody>
            </table>
          `}
        </div>
      </div>

      <!-- Per-project breakdown -->
      ${projects.length > 0 ? html`
        <h3 style="font-size:17px; color:var(--text-muted); margin-bottom:12px;">Per-Project Activity</h3>
        <table style="width:100%; border-collapse:collapse; font-size:15px; margin-bottom:24px;">
          <thead>
            <tr style="border-bottom:1px solid var(--border-color);">
              <th style="text-align:left; padding:6px 8px; color:var(--text-muted); font-weight:500;">Project</th>
              <th style="text-align:right; padding:6px 8px; color:var(--text-muted); font-weight:500;">Corrections</th>
              <th style="text-align:right; padding:6px 8px; color:var(--text-muted); font-weight:500;">Sessions</th>
              <th style="text-align:right; padding:6px 8px; color:var(--text-muted); font-weight:500;">Preferences</th>
              <th style="text-align:right; padding:6px 8px; color:var(--text-muted); font-weight:500;">Gates</th>
            </tr>
          </thead>
          <tbody>
            ${projects.map(p => html`
              <tr key=${p.name} style="border-bottom:1px solid var(--border-subtle, #2a2a2a);">
                <td style="padding:6px 8px; font-family:var(--font-data); color:var(--text-primary);">${p.name}</td>
                <td style="padding:6px 8px; text-align:right; font-family:var(--font-data); color:${p.corrections > 10 ? 'var(--signal-warning)' : 'var(--text-secondary)'};">${p.corrections}</td>
                <td style="padding:6px 8px; text-align:right; font-family:var(--font-data); color:var(--text-secondary);">${p.sessions}</td>
                <td style="padding:6px 8px; text-align:right; font-family:var(--font-data); color:var(--signal-success);">${p.preferences}</td>
                <td style="padding:6px 8px; text-align:right; font-family:var(--font-data); color:var(--text-secondary);">${p.gates}</td>
              </tr>
            `)}
          </tbody>
        </table>
      ` : null}
    </div>
  `;
}

function StatCard({ label, value, sub, color, highlight }) {
  return html`
    <div style="
      background:${highlight ? 'rgba(255,107,107,0.08)' : 'rgba(255,255,255,0.03)'};
      border:1px solid ${highlight ? 'rgba(255,107,107,0.25)' : 'var(--border-subtle, #2a2a2a)'};
      border-radius:8px;
      padding:14px 18px;
      min-width:120px;
    ">
      <div style="font-size:28px; font-family:var(--font-data); color:${color}; font-weight:600; line-height:1.1;">
        ${value}
      </div>
      <div style="font-size:14px; color:var(--text-muted); margin-top:4px;">${label}</div>
      ${sub ? html`<div style="font-size:13px; color:var(--text-muted); opacity:0.7;">${sub}</div>` : null}
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
