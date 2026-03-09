import { html } from 'htm/preact';

export function EmptyState() {
  return html`
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      gap: 24px;
      text-align: center;
      padding: 32px;
    ">
      <div style="font-size: 48px; opacity: 0.3">📋</div>
      <div>
        <h2 style="font-size: 20px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px">
          No projects registered
        </h2>
        <p style="color: var(--text-secondary); font-size: 14px; max-width: 420px; line-height: 1.6">
          Register your GSD projects to see live status, progress, and drill-down detail.
        </p>
      </div>
      <div style="
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 16px 24px;
        text-align: left;
        max-width: 480px;
        width: 100%;
      ">
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em">
          Getting started
        </p>
        <ol style="font-size: 13px; color: var(--text-secondary); line-height: 2; padding-left: 20px;">
          <li>Open a terminal in your GSD project directory</li>
          <li>Run: <code style="font-family: var(--font-data); background: var(--bg-base); padding: 2px 6px; border-radius: 3px; color: var(--accent)">gsd dashboard add .</code></li>
          <li>This page updates automatically</li>
        </ol>
      </div>
    </div>
  `;
}
