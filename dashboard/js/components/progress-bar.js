import { html } from 'htm/preact';
import { fmtPct } from '../utils/format.js';

export function ProgressBar({ value, shimmer, shimmerClass }) {
  // value: 0-100 number or null
  const pct = value !== null && value !== undefined ? Math.min(100, Math.max(0, value)) : 0;
  const show = value !== null && value !== undefined;

  return html`
    <div class="progress-bar ${shimmerClass || (shimmer ? 'shimmer-active' : '')}" style="
      background: var(--bg-elevated);
      border-radius: 3px;
      height: 4px;
      overflow: hidden;
      flex: 1;
    ">
      <div class="progress-fill" style="
        height: 100%;
        width: ${show ? pct : 0}%;
        background: var(--accent);
        border-radius: 3px;
      "></div>
    </div>
  `;
}
