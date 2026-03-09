---
phase: "quick-19"
plan: "19"
type: quick
autonomous: true
wave: 1
depends_on: []
requirements: []
files_modified:
  - dashboard/index.html
  - dashboard/css/tokens.css
  - dashboard/css/layout.css
  - dashboard/css/cards.css
  - dashboard/css/detail.css
  - dashboard/css/animations.css
  - dashboard/js/components/progress-bar.js
  - dashboard/js/components/header.js
  - dashboard/js/components/project-card.js
  - dashboard/js/components/sidebar.js

must_haves:
  truths:
    - Every text element must use JetBrains Mono — no Inter anywhere after this change
    - Progress bars are Unicode block characters computed in JS, not CSS width fills
    - Header is a single dense pipe-separated status line matching the Claude Code format
    - Project cards become dense single-line rows with no rounded corners, no box-shadow elevation
    - The only structural CSS values that change are font-family, border-radius, box-shadow, and layout density
    - The existing Preact component logic (SSE, flash, sessions, tracking toggle) stays intact — only visual output changes
  artifacts:
    - dashboard/css/tokens.css — monospace-only font stack, terminal palette, radius:0 everywhere
    - dashboard/css/layout.css — flat header line, dense sidebar rows, no card grid (switch to column list)
    - dashboard/css/cards.css — flat row rows, no card elevation, terminal-style separators
    - dashboard/js/components/progress-bar.js — Unicode block bar renderer (█ ░ ▓)
    - dashboard/js/components/header.js — pipe-separated single-line status output
    - dashboard/js/components/project-card.js — dense row with pipe separators, block progress
    - dashboard/js/components/sidebar.js — plain list rows with monospace metric lines
  key_links:
    - Claude Code status line reference: "Opus 4.6 | GSD • v1.0 milestone | gsdup (main) | +14095/-1120 | $79.80 | 33h26m | [██░░░░░░░░] 20%"
---

# Quick Plan 19 — Restyle Dashboard: Claude Code Terminal Aesthetic

## Objective

Restyle the GSD dashboard from a GitHub-dark card UI to a pure terminal aesthetic matching the Claude Code status line. 100% monospace, pipe-separated data rows, Unicode block progress bars, flat borders, no rounded corners, no shadows, no card elevation.

## Reference Design

```
GSD | 4 projects | 2 active | 1 open debt                    [live]
─────────────────────────────────────────────────────────────────────
gsdup         v5.0 Device-Wide Dashboard | Phase 20 | [████████░░] 80% | healthy | 2 sessions
gymrats2      v3.1 Legacy Strip          | Phase 11 | [██████████] 100% | done    | idle
pyxelate      v2.0 Refactor             | Phase 5  | [███░░░░░░░] 30% | at risk  | 0 sessions
```

## Task 1 — Tokens and Global Typography

**Estimate:** ~8k tokens

**Files:**
- `/Users/tmac/Projects/gsdup/dashboard/css/tokens.css`
- `/Users/tmac/Projects/gsdup/dashboard/index.html`

**Action:**

In `tokens.css`:

1. Remove the Inter Google Fonts import line — keep only JetBrains Mono.
2. Change `--font-ui` to `'JetBrains Mono', 'Fira Code', monospace` (same as `--font-data`). This makes them identical — every element in the UI uses monospace.
3. Set `--radius: 0` and `--radius-sm: 0` — eliminates all rounded corners everywhere without touching HTML.
4. Add terminal-specific color tokens:
   ```css
   --term-green: #3fb950;
   --term-red: #ef4444;
   --term-cyan: #58a6ff;
   --term-dim: #484f58;
   --term-separator: #30363d;
   ```
5. Remove `--accent-muted: rgba(88, 166, 255, 0.15)` — replace with `--accent-muted: transparent`.
6. Add `--font-size-base: 12px` and `--font-size-sm: 11px` — terminal UIs use smaller type.

In `index.html`:

1. Remove the Inter font from the Google Fonts `<link>` — only keep: `family=JetBrains+Mono:wght@400;500;700`.
2. In the inline `<style>`, change `font-family: var(--font-ui)` on body to `font-family: var(--font-data)` and add `font-size: 12px; line-height: 1.5;`.

**Verify:**
Open `dashboard/index.html` in a browser (or inspect source). Confirm:
- No `Inter` string appears anywhere in the loaded CSS
- Body `font-family` resolves to JetBrains Mono
- All border-radius CSS custom property values are `0`

**Done:**
- `tokens.css` has no Inter reference
- `--font-ui` and `--font-data` are both monospace stacks
- `--radius` and `--radius-sm` are both `0`
- Terminal color tokens exist in `:root`

---

## Task 2 — Flat Layout: Header, Sidebar, Card Grid to Row List

**Estimate:** ~14k tokens

**Files:**
- `/Users/tmac/Projects/gsdup/dashboard/css/layout.css`
- `/Users/tmac/Projects/gsdup/dashboard/css/cards.css`
- `/Users/tmac/Projects/gsdup/dashboard/css/animations.css`
- `/Users/tmac/Projects/gsdup/dashboard/js/components/header.js`
- `/Users/tmac/Projects/gsdup/dashboard/js/components/sidebar.js`

**Action:**

### layout.css changes

Replace the `.site-header` block:
```css
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  height: var(--header-height);
  background: var(--bg-base);
  border-bottom: 1px solid var(--term-separator);
  display: flex;
  align-items: center;
  padding: 0 var(--space-lg);
  gap: 0;
  font-family: var(--font-data);
  font-size: 12px;
}
```

Replace `.header-brand`:
```css
.header-brand {
  font-family: var(--font-data);
  font-size: 13px;
  font-weight: 700;
  color: var(--term-green);
  white-space: nowrap;
  margin-right: 4px;
}
```

Replace `.header-stats`:
```css
.header-stats {
  display: flex;
  align-items: center;
  gap: 0;
  flex: 1;
  font-size: 12px;
  color: var(--text-secondary);
}

.header-stat {
  color: var(--text-secondary);
}

.header-stat::before {
  content: ' | ';
  color: var(--term-dim);
}

.header-stat strong {
  color: var(--text-primary);
  font-weight: 600;
}
```

Replace `.sse-indicator`:
```css
.sse-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted);
  margin-left: auto;
  font-family: var(--font-data);
}

.sse-indicator::before {
  content: '| ';
  color: var(--term-dim);
}
```

Remove the `.sse-dot` circle dot entirely — replace with a text indicator in the JS component.

Replace `.sidebar`:
```css
.sidebar {
  width: var(--sidebar-width);
  flex-shrink: 0;
  background: var(--bg-base);
  border-right: 1px solid var(--term-separator);
  overflow-y: auto;
  padding: var(--space-sm) 0;
}
```

Replace `.sidebar-project`:
```css
.sidebar-project {
  padding: 3px var(--space-md);
  cursor: pointer;
  border-left: 2px solid transparent;
}

.sidebar-project:hover {
  background: var(--bg-elevated);
  border-left-color: var(--term-green);
}
```

Replace `.sidebar-project-name`:
```css
.sidebar-project-name {
  font-family: var(--font-data);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

Replace `.sidebar-milestone`:
```css
.sidebar-milestone {
  font-size: 11px;
  color: var(--term-dim);
  padding: 0 0 0 var(--space-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.sidebar-milestone:hover { color: var(--term-cyan); }
```

Replace `.card-grid` with a flat column list:
```css
.card-grid {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-top: 1px solid var(--term-separator);
}
```

Remove the `@media` grid breakpoints for `.card-grid` column changes (they no longer apply to a grid).

Replace `.main-content`:
```css
.main-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg);
}
```

Replace `.sidebar-metrics`:
```css
.sidebar-metrics {
  border-top: 1px solid var(--term-separator);
  padding: var(--space-sm) var(--space-md);
  margin-top: var(--space-sm);
}
```

Replace `.sidebar-metrics-title`:
```css
.sidebar-metrics-title {
  font-family: var(--font-data);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--term-dim);
  margin-bottom: 4px;
}
```

Replace `.sidebar-health-chip`:
```css
.sidebar-health-chip {
  font-family: var(--font-data);
  font-size: 10px;
  padding: 0;
  border: none;
}
```

### cards.css changes

Replace `.project-card`:
```css
.project-card {
  background: var(--bg-base);
  border: none;
  border-bottom: 1px solid var(--bg-elevated);
  padding: var(--space-sm) var(--space-md);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: background 150ms ease;
}

.project-card:hover {
  background: var(--bg-elevated);
  border-color: var(--bg-elevated);
  box-shadow: none;
}
```

Replace `.project-card.stale`:
```css
.project-card.stale {
  opacity: 0.4;
  cursor: default;
}
```

Replace `.project-card.paused`:
```css
.project-card.paused {
  opacity: 0.35;
}

.project-card.paused:hover {
  background: var(--bg-base);
  cursor: default;
}
```

Replace `.card-header`:
```css
.card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-data);
}
```

Replace `.card-project-name`:
```css
.card-project-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  flex-shrink: 0;
  min-width: 120px;
}
```

Replace `.health-label`:
```css
.health-label {
  font-family: var(--font-data);
  font-size: 11px;
  font-weight: 400;
  padding: 0;
  border: none;
  background: none;
  text-transform: none;
  letter-spacing: 0;
  flex-shrink: 0;
}
```

Replace `.quality-badge`:
```css
.quality-badge {
  font-family: var(--font-data);
  font-size: 11px;
  padding: 0;
  border: none;
  background: none;
  text-transform: none;
  letter-spacing: 0;
  flex-shrink: 0;
  color: var(--term-dim);
}
```

Replace `.milestone-row`:
```css
.milestone-row {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 2px 0 2px var(--space-md);
  background: none;
  border: none;
  border-left: 1px solid var(--bg-elevated);
}
```

Replace `.milestone-name`:
```css
.milestone-name {
  font-family: var(--font-data);
  font-size: 11px;
  color: var(--term-cyan);
  flex-shrink: 0;
  min-width: 80px;
}
```

Replace `.milestone-status-badge`:
```css
.milestone-status-badge {
  font-size: 11px;
  padding: 0;
  border: none;
  background: none;
  flex-shrink: 0;
}
```

Replace `.workflow-badge`:
```css
.workflow-badge {
  font-size: 11px;
  padding: 0;
  border: none;
  background: none;
  color: var(--term-dim);
  flex-shrink: 0;
}
```

Replace `.session-badge`:
```css
.session-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-data);
  font-size: 11px;
  color: var(--term-dim);
  cursor: pointer;
  padding: 0;
  border: none;
  background: none;
  user-select: none;
}

.session-badge:hover { color: var(--text-secondary); }

.session-badge.no-sessions {
  opacity: 0.4;
  cursor: default;
}

.session-badge.no-sessions:hover { color: var(--term-dim); }
```

Replace `.tracking-toggle`:
```css
.tracking-toggle {
  background: none;
  border: none;
  color: var(--term-dim);
  font-size: 10px;
  font-family: var(--font-data);
  padding: 0;
  cursor: pointer;
  transition: color 150ms ease;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.tracking-toggle:hover { color: var(--text-secondary); }
```

Replace `.card-meta`:
```css
.card-meta {
  display: flex;
  gap: var(--space-sm);
  font-size: 11px;
  font-family: var(--font-data);
  color: var(--term-dim);
}
```

### animations.css changes

Remove or zero out any `box-shadow` in flash animations — keep the background flash. Find any `box-shadow` in animation keyframes and delete those declarations.

### header.js changes

1. Replace the round `.sse-dot` span with a plain text indicator. The `sse-indicator` div should render:
   ```
   ▸ live
   ```
   when connected (green), or the status text (warning color) when not. No dot element at all.

2. Change the header pipe separators: instead of CSS `::before` pseudo-elements (which require class changes), render them as literal text nodes between stats:
   ```jsx
   <span class="header-stat"> | <strong>{totalProjects}</strong> projects</span>
   <span class="header-stat"> | <strong>{totalActiveMilestones}</strong> active</span>
   ```
   This removes the need for the `.header-stat::before` CSS rule — it's just text. Remove that CSS rule from layout.css if added there, and use this inline approach instead.

3. The brand text: `GSD` in green, followed by a dim version/build tag if desired, then pipe-joined stats. Example output in the DOM:
   ```
   GSD | 4 projects | 2 active | 1 open debt        ▸ live
   ```

### sidebar.js changes

In `SidebarMetrics`, replace `.sidebar-health-chip` badge spans with plain colored text (no border, no background):
```jsx
${healthCounts.healthy > 0 ? html`<span style="color:var(--term-green);font-family:var(--font-data);font-size:10px">${healthCounts.healthy} healthy</span>` : null}
${healthCounts.attention > 0 ? html`<span style="color:var(--signal-warning);font-family:var(--font-data);font-size:10px">${healthCounts.attention} attention</span>` : null}
${healthCounts.risk > 0 ? html`<span style="color:var(--term-red);font-family:var(--font-data);font-size:10px">${healthCounts.risk} at risk</span>` : null}
```

**Verify:**
1. Load the dashboard in a browser — confirm no rounded corners anywhere (inspect any element, border-radius should be 0)
2. Confirm no `box-shadow` on cards (hover a project row, no glow/shadow)
3. Confirm header renders as a single flat line with pipe separators visible as text characters
4. Confirm sidebar project rows have a left-border accent on hover, not background chip styling
5. Confirm health chips in sidebar are plain colored text with no border or background

**Done:**
- Project cards display as flat rows separated by a 1px border-bottom, not raised cards
- Header is a single monospace line: `GSD | N projects | N active [pipe-separated]  ▸ live`
- Sidebar metrics section shows colored text values without badge borders
- No `border-radius` > 0 is visible anywhere in the rendered UI
- No `box-shadow` is visible anywhere in the rendered UI

---

## Task 3 — Block-Character Progress Bars and Dense Card Row Layout

**Estimate:** ~12k tokens

**Files:**
- `/Users/tmac/Projects/gsdup/dashboard/js/components/progress-bar.js`
- `/Users/tmac/Projects/gsdup/dashboard/js/components/project-card.js`

**Action:**

### progress-bar.js — full rewrite

Replace the entire CSS-width-based progress bar with a Unicode block character renderer. The component signature stays the same (`{ value, shimmer, shimmerClass }`).

Logic:
- `width` = 10 characters total (configurable via a `width` prop defaulting to 10)
- `filled` = `Math.round(pct / 100 * width)` filled blocks
- `empty` = `width - filled` empty blocks
- Filled character: `█` (U+2588)
- Empty character: `░` (U+2591)
- Output: `[` + `█`.repeat(filled) + `░`.repeat(empty) + `]`
- Color the block string green (`var(--term-green)`) always (no accent blue)
- Append the percentage: ` 20%` after the bracket block

Full replacement for the component:

```js
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
      style="font-family:var(--font-data);font-size:11px;color:var(--term-green);white-space:nowrap;letter-spacing:0"
    >${bar} ${show ? fmtPct(pct) : '--'}</span>
  `;
}
```

The `shimmer-active` class in animations.css should animate `opacity` or `color` (a text-safe animation), not width or background. Update `animations.css`: find any `.shimmer-active` keyframe that animates `background-position` or transforms — replace with:
```css
@keyframes shimmer-text {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.shimmer-active {
  animation: shimmer-text 1.8s ease-in-out infinite;
}
```

### project-card.js — dense single-line row format

Restructure the JSX so the card renders the project info on a single dense line. The format for each project row:

```
gsdup   v5.0 Device-Wide Dashboard | Phase 20 | [████████░░] 80% | healthy | 2 sessions (1 active)   [pause]
```

Restructure the returned JSX:

1. **Top line (primary row):** `card-header` div contains — in order with pipe separators as text nodes:
   - Project name (`card-project-name`) — bold, white
   - ` | ` dim separator text
   - Active milestone name (from `milestonesToShow[0]` if any) — cyan
   - ` | ` dim separator
   - Current phase (from `state.current_phase`) — plain text
   - ` | ` dim separator
   - ProgressBar component (Unicode blocks)
   - ` | ` dim separator
   - Health label (colored text, no border)
   - ` | ` dim separator
   - Session badge (session count + active count)

2. **Remove** the separate `card-meta` div (debt and completed milestone counts). Move `debtOpen` as an additional pipe-separated segment on the primary row if > 0: ` | N debt`.

3. **Remove** the separate `milestone-rows` section below the header. The milestone block already appears inline in step 1. Only show additional milestone rows (beyond the first/active) if there are multiple active milestones — collapse to a single secondary row with less detail.

4. **Keep** the `sessionExpanded` table panel — render it below the primary row when expanded, same as before.

5. **Keep** the `stale-warning` and `tracking-toggle` but inline the toggle button after the session badge:
   ```
   ... | 2 sessions (1 active) [pause]
   ```

6. Add `card-session-row` as a sub-section only if sessionExpanded — remove the standalone `card-session-row` div wrapper from the current code and fold its content into the header row.

The separator character between sections: use `<span style="color:var(--term-dim)"> | </span>` as a reusable inline fragment. Define a local helper at the top of the component: `const Sep = () => html\`<span style="color:var(--term-dim);user-select:none"> | </span>\``.

Full milestone inline display (replacing `milestone-rows`):

For the primary active milestone: render its version tag (cyan), phase name (plain), and the block progress bar inline with the project name row.

If there are additional active milestones (beyond 1), render each as a separate sub-row below the primary, indented with 2 spaces and `▸ ` prefix:
```
  ▸ v5.1 Next     | Phase 3  | [███░░░░░░░] 30%
```

**Verify:**
1. Load the dashboard — each project appears as 1-2 lines, not as a tall card
2. Progress bars show Unicode characters: `[████████░░] 80%` — not a CSS bar
3. No CSS width-based `.progress-fill` div is rendered in the DOM
4. Shimmer animation (on active milestones) animates opacity/text, not background gradient
5. Clicking a session count still expands the session table below the row
6. Tracking toggle (pause/resume) is still functional

**Done:**
- `ProgressBar` renders `[█░]`-style output with green color — confirmed in DOM inspection
- Each project card is 1-3 lines tall maximum (not a tall card box)
- Session expand/collapse still works
- Tracking toggle still works
- All milestone data (name, phase, progress) visible inline on the primary row
