import { html } from 'htm/preact';
import { fmtPct } from '../utils/format.js';

export function ProgressBar({ value, shimmer, shimmerClass, width = 10 }) {
  const pct = value !== null && value !== undefined ? Math.min(100, Math.max(0, value)) : 0;
  const show = value !== null && value !== undefined;
  const filled = show ? Math.round(pct / 100 * width) : 0;
  const empty = width - filled;
  const bar = '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';

  return html`
    <span
      class=${shimmerClass || (shimmer ? 'shimmer-active' : '')}
      style="font-family:var(--font-data);font-size:13px;color:var(--term-green);white-space:nowrap;letter-spacing:0"
    >${bar} ${show ? fmtPct(pct) : '--'}</span>
  `;
}
