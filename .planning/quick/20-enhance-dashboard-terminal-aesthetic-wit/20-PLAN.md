---
phase: "20"
plan: "20-01"
type: quick
autonomous: true
wave: 1
depends_on: []
requirements: []
files_modified:
  - dashboard/css/tokens.css
  - dashboard/css/layout.css
  - dashboard/js/components/sidebar.js
  - dashboard/js/components/project-card.js

must_haves:
  truths:
    - statusClass() already maps status strings to .status-* CSS classes (format.js:32-40)
    - healthClass() already maps health level to .status-* CSS classes (format.js:62-71)
    - ".status-active, .status-complete, .status-blocked, .status-attention, .status-not-started defined in tokens.css"
    - Sidebar shows only project name (text-primary) + one active milestone name (term-dim) — no color-coding by status
    - sidebar.js getActiveMilestone returns first active or last milestone — status field not used for coloring
    - SidebarMetrics font-size for values inherits 11px — no explicit size set on .sidebar-metric-value
    - No progress background on sidebar project/milestone rows anywhere
    - project-card.js card-project-name always color text-primary — statusClass never applied there
    - Cross-project metrics section exists in SidebarMetrics but values are small (11px inherited)
  artifacts:
    - dashboard/css/tokens.css
    - dashboard/css/layout.css
    - dashboard/js/components/sidebar.js
    - dashboard/js/components/project-card.js
  key_links:
    - ".planning/quick/19-restyle-dashboard-to-match-claude-code-t/ (prior terminal restyle reference)"
---

# Plan 20: Enhance Dashboard Terminal Aesthetic

## Overview

Four targeted enhancements to the dashboard terminal aesthetic:
1. Color-code project name in cards by project health status
2. Sidebar: show ALL active milestones per project with phase counts; color milestone names by status
3. Sidebar progress bar backgrounds behind project rows (subtle, terminal-style)
4. Cross-project metrics section: larger metric values (13px)

All changes are purely cosmetic — no data model changes, no new API calls.

---

## Task 1: Color-code project names and sidebar project/milestone rows by status

**Estimate:** ~400 tokens

**Files:**
- `dashboard/js/components/project-card.js`
- `dashboard/js/components/sidebar.js`

**Action:**

### project-card.js

At line 93, `.card-project-name` currently has no dynamic class. Add `statusClass` applied to the project-level status.

The project health maps to status via `healthClass(health)` which already returns a `.status-*` class. Use this to color the project name.

Change line 93 from:
```js
<span class="card-project-name">${project.display_name || project.name}</span>
```
to:
```js
<span class="card-project-name ${isPaused ? 'status-not-started' : healthClass(health)}">${project.display_name || project.name}</span>
```

### sidebar.js

The `Sidebar` component maps projects. For each project, the project name row (`sidebar-project-name`) should be color-coded by health. The active milestone row (`sidebar-milestone`) should be color-coded by the milestone's status field.

1. Import `statusClass, healthClass` from format.js (they are already partially imported — check current imports on line 4 and add `statusClass, healthClass`).

2. In the project map (lines 84-98), change the `sidebar-project-name` span to use `healthClass(p.health)` as an additional class:
```js
<div class="sidebar-project-name ${p.tracking === false ? 'status-not-started' : healthClass(p.health)}" onClick=...>
```

3. For milestones in sidebar: currently shows ONE active milestone. Change to show ALL active milestones (loop over `p.milestones.filter(m => m.active)` instead of `getActiveMilestone`). For each milestone, derive a color class from the milestone's state status via `statusClass(ms.state && ms.state.status)`.

Replace the current single `${active ? html`...` : null}` block with:
```js
${(p.milestones || []).filter(m => m.active).map(ms => {
  const phases = ms.roadmap ? (ms.roadmap.phases || []) : [];
  const total = phases.length;
  const done = phases.filter(ph => ph.status === 'complete').length;
  const msStatus = ms.state && ms.state.status;
  return html`
    <div class="sidebar-milestone ${statusClass(msStatus)}" key=${ms.name}
      onClick=${() => { navigate(\`/project/\${encodeURIComponent(p.name)}/\${encodeURIComponent(ms.name)}\`); onClose && onClose(); }}>
      ${ms.name}${total > 0 ? html` <span style="color:var(--term-dim);font-size:10px">[${done}/${total}]</span>` : null}
    </div>
  `;
})}
```

**Verify:**
```
open dashboard/index.html
# Projects with active milestones should show green/cyan/amber/red project names
# Sidebar should list all active milestones per project with [done/total] phase counts
# Paused projects should show dim/gray name
```

**Done:**
- Project name in card header is green for healthy, amber for attention, red for blocked, gray for paused/unknown
- Sidebar project names are colored by health
- Sidebar shows ALL active milestones per project (not just one)
- Each sidebar milestone shows [done/total] phase count in dim text
- Each sidebar milestone name is colored by its status

---

## Task 2: Sidebar progress backgrounds and larger metrics

**Estimate:** ~300 tokens

**Files:**
- `dashboard/css/layout.css`
- `dashboard/css/tokens.css`
- `dashboard/js/components/sidebar.js`

**Action:**

### layout.css — progress background on sidebar rows

Add a CSS variable for a subtle progress background, then a utility class. Insert after the `.sidebar-metrics` block (after line 195):

```css
/* Progress background on sidebar rows */
.sidebar-project-bar {
  position: relative;
  overflow: hidden;
}

.sidebar-project-bar::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: var(--bar-pct, 0%);
  background: rgba(63, 185, 80, 0.08);
  pointer-events: none;
  z-index: 0;
}

.sidebar-project-bar > * {
  position: relative;
  z-index: 1;
}
```

### sidebar.js — apply progress background to project rows

1. Import `parseProgress, getActiveMilestone` — `getActiveMilestone` is already imported (line 4). Add `parseProgress` to the import.

2. In the project map, compute the progress percentage for the primary active milestone:
```js
const active = getActiveMilestone(p.milestones);
const pct = active && active.state ? parseProgress(active.state.progress) : null;
```

3. Add `sidebar-project-bar` class to the `.sidebar-project` div and set the CSS variable inline:
```js
<div class="sidebar-project sidebar-project-bar"
  style=${pct !== null ? `--bar-pct:${pct}%` : ''}
  key=${p.name}>
```

### layout.css / sidebar-metric-value — larger metrics

Change `.sidebar-metric-value` to explicit font-size 13px (currently inherits 11px):

Find the `.sidebar-metric-value` rule (line 171) and add `font-size: 13px;`:
```css
.sidebar-metric-value {
  font-family: var(--font-data);
  font-weight: 600;
  color: var(--text-primary);
  font-size: 13px;
}
```

Also increase `.sidebar-metrics-title` to remain proportionate — it's fine at 10px (leave as-is).

**Verify:**
```
# Reload dashboard
# Sidebar project rows should have a faint green background that extends proportionally to milestone progress
# Cross-project metric values (tracked count, phase count, debt) should render at 13px (visibly larger than labels)
```

**Done:**
- Each sidebar project row has a subtle green fill behind it proportional to the active milestone progress percentage
- `.sidebar-metric-value` renders at 13px, visibly larger than 10px labels
- No layout shifts — bar is absolutely positioned, content z-index 1 sits above it

---

## Task 3: Commit

**Estimate:** ~50 tokens

**Files:** (all modified files)

**Action:**

Stage and commit all changes:
```
git add dashboard/css/tokens.css dashboard/css/layout.css dashboard/js/components/sidebar.js dashboard/js/components/project-card.js
git commit -m "feat(dashboard): status color-coding, sidebar milestones+progress bars, larger metrics"
```

Include the standard Co-Authored-By trailer:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

**Verify:**
```
git log --oneline -1
# Should show the new commit
git diff HEAD~1 --stat
# Should show changes to 4 files only
```

**Done:**
- Single commit with conventional commit format
- All 4 modified files staged and committed
- No untracked/unstaged changes remain
