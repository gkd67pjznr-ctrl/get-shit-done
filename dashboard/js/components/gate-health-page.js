import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';

/**
 * Dedicated Gate Health page — cross-project aggregate of gate execution metrics.
 * Fetches /api/gate-health and visualizes:
 *   - Quality level usage distribution (DASH-03)
 *   - Gate outcome distribution per gate (DASH-02, DASH-04)
 *   - Per-gate firing rate table (DASH-04)
 *   - Context7 utilization stats (DASH-05)
 *
 * DASH-01, DASH-02, DASH-03, DASH-04, DASH-05
 */
export function GateHealthPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/gate-health')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const ct = r.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
          throw new Error('Server returned non-JSON response');
        }
        return r.json();
      })
      .then((d) => {
        setData(d);
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
        Loading gate data...
      </div>
    `;
  }

  if (error) {
    return html`
      <div style="padding:32px; color:var(--signal-error)">
        Failed to load gate data: ${error}
      </div>
    `;
  }

  if (!data || !data.hasData) {
    return html`
      <div style="padding:32px; color:var(--text-muted); max-width:640px;">
        <h2 style="margin-bottom:12px;">Gate Health</h2>
        <p style="margin-bottom:8px;">No gate execution data found.</p>
        <p style="margin-bottom:8px;">Gate data is collected when running in <code>standard</code> or <code>strict</code> quality mode.
        Fast mode skips gate enforcement and produces no data.</p>
        <p style="margin-bottom:8px;">To start collecting gate data, run: <code>/gsd:set-quality standard</code></p>
        <p style="font-size:14px; margin-top:16px;">Data files:
          <code>.planning/observations/gate-executions.jsonl</code>,
          <code>.planning/observations/context7-calls.jsonl</code>
        </p>
      </div>
    `;
  }

  const GATE_LABELS = {
    codebase_scan:   'Codebase Scan',
    context7_lookup: 'Context7 Lookup',
    test_baseline:   'Test Baseline',
    test_gate:       'Test Gate',
    diff_review:     'Diff Review',
  };

  const OUTCOME_COLORS = {
    passed:  'var(--signal-success)',
    warned:  'var(--signal-warning)',
    blocked: 'var(--signal-error)',
    skipped: 'var(--text-muted)',
  };

  const QUALITY_COLORS = {
    standard: 'var(--signal-success)',
    strict:   'var(--signal-warning)',
    fast:     'var(--text-muted)',
  };

  // --- Quality level bar (DASH-03) ---
  const qlTotal = (data.qualityLevels.standard || 0) + (data.qualityLevels.strict || 0) + (data.qualityLevels.fast || 0);
  function qlPct(level) {
    return qlTotal > 0 ? ((data.qualityLevels[level] || 0) / qlTotal * 100).toFixed(1) : 0;
  }

  // --- Gate outcome totals for global bar (DASH-02) ---
  const outcomeTotal = data.totalExecutions || 0;
  function outcomePct(key) {
    return outcomeTotal > 0 ? ((data.outcomes[key] || 0) / outcomeTotal * 100).toFixed(1) : 0;
  }

  // --- Per-gate bars (DASH-04) ---
  const gateNames = ['codebase_scan', 'context7_lookup', 'test_baseline', 'test_gate', 'diff_review'];

  function gatePct(gateName, outcome) {
    const g = data.gates[gateName];
    if (!g || g.total === 0) return 0;
    return ((g[outcome] || 0) / g.total * 100).toFixed(1);
  }

  // --- Context7 stats (DASH-05) ---
  const c7 = data.context7 || {};

  const reportingNote = data.projectCount > 1
    ? html`<span style="font-size:14px; color:var(--text-muted); margin-left:12px;">${data.reportingCount} of ${data.projectCount} projects reporting</span>`
    : null;

  return html`
    <div style="padding:24px; max-width:960px;">
      <h2 style="margin-bottom:4px; font-size:22px;">Gate Health ${reportingNote}</h2>
      <p style="font-size:15px; color:var(--text-muted); margin-bottom:24px;">
        Aggregated from all registered projects · ${data.totalExecutions} gate executions total
      </p>

      <!-- Section 1: Quality Level Distribution (DASH-03) -->
      <section style="margin-bottom:32px;">
        <h3 style="font-size:16px; font-weight:600; margin-bottom:8px;">Quality Level Usage</h3>
        <div style="display:flex; height:12px; border-radius:6px; overflow:hidden; background:var(--bg-card, #1a1a1a); margin-bottom:8px;">
          <div style="width:${qlPct('standard')}%; background:${QUALITY_COLORS.standard};" title="Standard: ${qlPct('standard')}%" />
          <div style="width:${qlPct('strict')}%; background:${QUALITY_COLORS.strict};" title="Strict: ${qlPct('strict')}%" />
          <div style="width:${qlPct('fast')}%; background:${QUALITY_COLORS.fast};" title="Fast: ${qlPct('fast')}%" />
        </div>
        <div style="display:flex; gap:20px; font-size:14px; color:var(--text-secondary);">
          <span><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${QUALITY_COLORS.standard}; margin-right:4px;"></span>Standard ${qlPct('standard')}%</span>
          <span><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${QUALITY_COLORS.strict}; margin-right:4px;"></span>Strict ${qlPct('strict')}%</span>
          <span style="color:var(--text-muted); font-size:13px;">Fast mode sessions skip gate enforcement and are not tracked.</span>
        </div>
        ${data.configQualityLevels ? html`
          <div style="font-size:13px; color:var(--text-muted); margin-top:6px;">
            Current config: ${Object.entries(data.configQualityLevels).map(([level, count]) =>
              html`<span style="color:${QUALITY_COLORS[level] || 'var(--text-secondary)'}; margin-right:8px;">${count} project${count !== 1 ? 's' : ''} → ${level}</span>`
            )}
          </div>
        ` : null}
      </section>

      <!-- Section 2a: Global Outcome Distribution (DASH-02) -->
      <section style="margin-bottom:32px;">
        <h3 style="font-size:16px; font-weight:600; margin-bottom:8px;">Overall Outcome Distribution</h3>
        <div style="display:flex; height:12px; border-radius:6px; overflow:hidden; background:var(--bg-card, #1a1a1a); margin-bottom:8px;">
          <div style="width:${outcomePct('passed')}%; background:${OUTCOME_COLORS.passed};" title="Passed: ${outcomePct('passed')}%" />
          <div style="width:${outcomePct('warned')}%; background:${OUTCOME_COLORS.warned};" title="Warned: ${outcomePct('warned')}%" />
          <div style="width:${outcomePct('blocked')}%; background:${OUTCOME_COLORS.blocked};" title="Blocked: ${outcomePct('blocked')}%" />
          <div style="width:${outcomePct('skipped')}%; background:${OUTCOME_COLORS.skipped};" title="Skipped: ${outcomePct('skipped')}%" />
        </div>
        <div style="display:flex; gap:20px; font-size:14px; color:var(--text-secondary);">
          <span><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${OUTCOME_COLORS.passed}; margin-right:4px;"></span>Passed ${outcomePct('passed')}%</span>
          <span><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${OUTCOME_COLORS.warned}; margin-right:4px;"></span>Warned ${outcomePct('warned')}%</span>
          <span><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${OUTCOME_COLORS.blocked}; margin-right:4px;"></span>Blocked ${outcomePct('blocked')}%</span>
          <span><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${OUTCOME_COLORS.skipped}; margin-right:4px;"></span>Skipped ${outcomePct('skipped')}%</span>
        </div>
      </section>

      <!-- Section 2b: Per-Gate Outcome Bars (DASH-04) -->
      <section style="margin-bottom:32px;">
        <h3 style="font-size:16px; font-weight:600; margin-bottom:12px;">Per-Gate Outcome Breakdown</h3>
        ${gateNames.map((gateName) => {
          const g = data.gates[gateName];
          const gTotal = g ? g.total : 0;
          return html`
            <div key=${gateName} style="margin-bottom:16px;">
              <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px;">
                <span style="font-size:14px; color:var(--text-primary); font-family:var(--font-data);">${GATE_LABELS[gateName]}</span>
                <span style="font-size:13px; color:var(--text-muted);">${gTotal} fires</span>
              </div>
              ${gTotal === 0
                ? html`<div style="height:8px; border-radius:4px; background:var(--bg-card, #1a1a1a); opacity:0.4;"></div>`
                : html`
                  <div style="display:flex; height:8px; border-radius:4px; overflow:hidden; background:var(--bg-card, #1a1a1a);">
                    <div style="width:${gatePct(gateName, 'passed')}%; background:${OUTCOME_COLORS.passed};" title="Passed: ${gatePct(gateName, 'passed')}%" />
                    <div style="width:${gatePct(gateName, 'warned')}%; background:${OUTCOME_COLORS.warned};" title="Warned: ${gatePct(gateName, 'warned')}%" />
                    <div style="width:${gatePct(gateName, 'blocked')}%; background:${OUTCOME_COLORS.blocked};" title="Blocked: ${gatePct(gateName, 'blocked')}%" />
                    <div style="width:${gatePct(gateName, 'skipped')}%; background:${OUTCOME_COLORS.skipped};" title="Skipped: ${gatePct(gateName, 'skipped')}%" />
                  </div>
                `
              }
            </div>
          `;
        })}
        <div style="display:flex; gap:16px; font-size:13px; color:var(--text-secondary); margin-top:8px;">
          <span><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${OUTCOME_COLORS.passed}; margin-right:4px;"></span>Passed</span>
          <span><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${OUTCOME_COLORS.warned}; margin-right:4px;"></span>Warned</span>
          <span><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${OUTCOME_COLORS.blocked}; margin-right:4px;"></span>Blocked</span>
          <span><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${OUTCOME_COLORS.skipped}; margin-right:4px;"></span>Skipped</span>
        </div>
      </section>

      <!-- Section 3: Per-gate firing rates table (DASH-04) -->
      <section style="margin-bottom:32px;">
        <h3 style="font-size:16px; font-weight:600; margin-bottom:12px;">Per-Gate Firing Rates</h3>
        <table style="width:100%; border-collapse:collapse; font-size:14px;">
          <thead>
            <tr style="border-bottom:1px solid var(--border-color);">
              <th style="text-align:left; padding:8px 12px; color:var(--text-muted); font-weight:500;">Gate</th>
              <th style="text-align:right; padding:8px 12px; color:var(--text-muted); font-weight:500;">Fires</th>
              <th style="text-align:right; padding:8px 12px; color:var(--text-muted); font-weight:500;">Passed</th>
              <th style="text-align:right; padding:8px 12px; color:var(--text-muted); font-weight:500;">Warned</th>
              <th style="text-align:right; padding:8px 12px; color:var(--text-muted); font-weight:500;">Blocked</th>
              <th style="text-align:right; padding:8px 12px; color:var(--text-muted); font-weight:500;">Skipped</th>
              <th style="text-align:right; padding:8px 12px; color:var(--text-muted); font-weight:500;">Warn Rate</th>
            </tr>
          </thead>
          <tbody>
            ${gateNames.map((gateName) => {
              const g = data.gates[gateName] || { total: 0, passed: 0, warned: 0, blocked: 0, skipped: 0 };
              const warnRate = g.total > 0 ? ((g.warned / g.total) * 100).toFixed(0) + '%' : '—';
              return html`
                <tr key=${gateName} style="border-bottom:1px solid var(--border-subtle, #2a2a2a);">
                  <td style="padding:8px 12px; font-family:var(--font-data); color:var(--text-primary);">${GATE_LABELS[gateName]}</td>
                  <td style="padding:8px 12px; text-align:right; color:var(--text-secondary);">${g.total}</td>
                  <td style="padding:8px 12px; text-align:right; color:var(--signal-success);">${g.passed || 0}</td>
                  <td style="padding:8px 12px; text-align:right; color:var(--signal-warning);">${g.warned || 0}</td>
                  <td style="padding:8px 12px; text-align:right; color:var(--signal-error);">${g.blocked || 0}</td>
                  <td style="padding:8px 12px; text-align:right; color:var(--text-muted);">${g.skipped || 0}</td>
                  <td style="padding:8px 12px; text-align:right; color:var(--text-secondary);">${warnRate}</td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      </section>

      <!-- Section 4: Context7 utilization stats (DASH-05) -->
      <section style="margin-bottom:32px;">
        <h3 style="font-size:16px; font-weight:600; margin-bottom:12px;">Context7 Utilization</h3>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:16px;">
          <div style="background:var(--bg-card, #1a1a1a); border-radius:8px; padding:16px;">
            <div style="font-size:28px; font-weight:700; font-family:var(--font-data); color:var(--text-primary);">${c7.totalCalls || 0}</div>
            <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">Total Calls</div>
          </div>
          <div style="background:var(--bg-card, #1a1a1a); border-radius:8px; padding:16px;">
            <div style="font-size:28px; font-weight:700; font-family:var(--font-data); color:var(--text-primary);">${c7.avgTokensRequested || 0}</div>
            <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">Avg Tokens Requested</div>
          </div>
          <div style="background:var(--bg-card, #1a1a1a); border-radius:8px; padding:16px;">
            <div style="font-size:28px; font-weight:700; font-family:var(--font-data); color:${(c7.capHitRate || 0) > 0.2 ? 'var(--signal-warning)' : 'var(--text-primary)'};">
              ${c7.totalCalls > 0 ? ((c7.capHitRate || 0) * 100).toFixed(0) + '%' : '—'}
            </div>
            <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">Cap Hit Rate</div>
          </div>
          <div style="background:var(--bg-card, #1a1a1a); border-radius:8px; padding:16px;">
            <div style="font-size:28px; font-weight:700; font-family:var(--font-data); color:var(--signal-success);">
              ${c7.totalCalls > 0 ? ((c7.usedInCodeRate || 0) * 100).toFixed(0) + '%' : '—'}
            </div>
            <div style="font-size:13px; color:var(--text-muted); margin-top:4px;">Used in Code</div>
          </div>
        </div>
      </section>
    </div>
  `;
}
