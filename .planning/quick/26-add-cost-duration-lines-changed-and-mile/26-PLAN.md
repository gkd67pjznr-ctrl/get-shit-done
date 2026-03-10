---
phase: "26"
plan: "26-01"
type: quick
autonomous: true
wave: 1
depends_on: []
requirements: []
files_modified:
  - get-shit-done/bin/lib/server.cjs
  - dashboard/js/components/project-card.js
  - dashboard/js/utils/format.js
  - dashboard/css/cards.css
  - ~/.claude/hooks/gsd-statusline.js
must_haves:
  truths:
    - cost-log.jsonl is written per-project by gsd-statusline.js to .planning/cost-log.jsonl with fields {ts, session, delta, cumulative}
    - Bridge files live at /tmp/claude-ctx-{sessionId}.json and currently lack a cwd field
    - Per-pane cost files live at /tmp/claude-cost-pane-{sessionId}.json with {lastReportedCost, cumulativeCost}
    - Tmux panes already contain cwd field from the TMUX_FORMAT query string (pane_current_path)
    - Milestone rows use a 5-column CSS grid — indicator | version | phase | progress-bar | empty-tail
    - The desired output per milestone row is: indicator | version | phase | progress-bar | +N/-N $X.XX Xm
  artifacts:
    - /Users/tmac/Projects/gsdup/get-shit-done/bin/lib/server.cjs (parseProjectData, parseAllMilestones)
    - /Users/tmac/Projects/gsdup/dashboard/js/components/project-card.js (milestone row render)
    - /Users/tmac/Projects/gsdup/dashboard/js/utils/format.js (formatters)
    - /Users/tmac/Projects/gsdup/dashboard/css/cards.css (.card-milestone-row grid)
    - /Users/tmac/.claude/hooks/gsd-statusline.js (bridge file writer)
  key_links:
    - cost-log format: {ts, session, delta, cumulative} — cumulative field holds running total
    - bridge file path: /tmp/claude-ctx-{sessionId}.json — must add cwd field
    - pane cost path: /tmp/claude-cost-pane-{sessionId}.json — holds {lastReportedCost, cumulativeCost}
---

# Plan 26 — Add Cost, Duration, Lines-Changed to Dashboard Milestone Rows

## Overview

Three tasks in one logical pipeline:
1. Add `cwd` to the context bridge file so the server can map sessions to projects
2. Enrich the server project data model with cost, git stats, and session duration per milestone
3. Render the new fields in the dashboard milestone rows

---

## Task 26-01 — Add `cwd` to context bridge file in gsd-statusline.js

**Files:**
- `~/.claude/hooks/gsd-statusline.js`

**Action:**

In the bridge file writer block (around line 180-195 where `bridgePath` is written), add `cwd: dir` to the JSON object. The variable `dir` already holds the resolved workspace directory at that point in the code.

Current bridge write:
```js
const bridgeData = JSON.stringify({
  session_id: session,
  remaining_percentage: remaining,
  used_pct: usedForBridge,
  timestamp: Math.floor(Date.now() / 1000)
});
```

Change to:
```js
const bridgeData = JSON.stringify({
  session_id: session,
  remaining_percentage: remaining,
  used_pct: usedForBridge,
  timestamp: Math.floor(Date.now() / 1000),
  cwd: dir
});
```

No other changes to this file.

**Verify:**
Run any Claude Code session with gsd-statusline as the hook, then:
```sh
cat /tmp/claude-ctx-$(ls /tmp/claude-ctx-*.json 2>/dev/null | head -1 | sed 's/.*claude-ctx-//' | sed 's/\.json//').json
```
The output should contain a `cwd` key with the project path.

Or manually check: `ls /tmp/claude-ctx-*.json && cat $(ls -t /tmp/claude-ctx-*.json | head -1)` — look for `"cwd":` key.

**Done:** Bridge file JSON contains `cwd` field pointing to the workspace directory.

---

## Task 26-02 — Enrich server project data with cost, git stats, and session duration

**Files:**
- `get-shit-done/bin/lib/server.cjs`

**Action:**

Add three new helper functions and call them from `parseProjectData`. All changes are additive — do not remove existing fields.

### 2a. Add `readProjectCostLog(projectPath)` helper function

Add after the `scanPhasesSummary` function (around line 156):

```js
/**
 * Read .planning/cost-log.jsonl and return the latest cumulative total across all sessions.
 * Returns { total: number } or null if file doesn't exist.
 */
function readProjectCostLog(projectPath) {
  try {
    const logPath = path.join(projectPath, '.planning', 'cost-log.jsonl');
    const content = fs.readFileSync(logPath, 'utf-8').trim();
    if (!content) return null;
    const lines = content.split('\n').filter(Boolean);
    // Sum unique session cumulatives — use last entry per session
    const sessionMax = new Map();
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.session && entry.cumulative != null) {
          const prev = sessionMax.get(entry.session) || 0;
          if (entry.cumulative > prev) sessionMax.set(entry.session, entry.cumulative);
        }
      } catch { /* skip malformed */ }
    }
    if (sessionMax.size === 0) return null;
    const total = Array.from(sessionMax.values()).reduce((sum, v) => sum + v, 0);
    return { total: Math.round(total * 10000) / 10000 };
  } catch {
    return null;
  }
}
```

### 2b. Add `readProjectGitStats(projectPath)` helper function

Add immediately after `readProjectCostLog`:

```js
/**
 * Run git diff --shortstat HEAD to get lines added/removed for the working tree.
 * Returns { added: number, removed: number } or null on error.
 */
function readProjectGitStats(projectPath) {
  try {
    const raw = execSync('git diff --shortstat HEAD', {
      cwd: projectPath,
      encoding: 'utf-8',
      timeout: 2000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // "3 files changed, 639 insertions(+), 67 deletions(-)"
    const addedMatch = raw.match(/(\d+)\s+insertion/);
    const removedMatch = raw.match(/(\d+)\s+deletion/);
    const added = addedMatch ? parseInt(addedMatch[1], 10) : 0;
    const removed = removedMatch ? parseInt(removedMatch[1], 10) : 0;
    if (added === 0 && removed === 0) return null;
    return { added, removed };
  } catch {
    return null;
  }
}
```

### 2c. Add `readSessionDuration(projectPath)` helper function

Add immediately after `readProjectGitStats`:

```js
/**
 * Find the most recent bridge file (/tmp/claude-ctx-*.json) whose cwd matches
 * this project path, then look up the corresponding cost-pane file for duration.
 * Returns duration in milliseconds from cost-log timestamps, or null.
 */
function readSessionDuration(projectPath) {
  try {
    const tmpDir = os.tmpdir();
    const bridgeFiles = fs.readdirSync(tmpDir).filter(f => f.startsWith('claude-ctx-') && f.endsWith('.json'));
    let bestSession = null;
    let bestTs = 0;
    for (const fname of bridgeFiles) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(tmpDir, fname), 'utf-8'));
        if (data.cwd && projectPath && data.cwd.startsWith(projectPath) && data.timestamp > bestTs) {
          bestTs = data.timestamp;
          bestSession = data.session_id;
        }
      } catch { /* skip */ }
    }
    if (!bestSession) return null;

    // Read the cost-log.jsonl for this project — find earliest and latest entry for the session
    const logPath = path.join(projectPath, '.planning', 'cost-log.jsonl');
    const lines = fs.readFileSync(logPath, 'utf-8').trim().split('\n').filter(Boolean);
    let firstTs = null;
    let lastTs = null;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.session === bestSession && entry.ts) {
          const t = new Date(entry.ts).getTime();
          if (!firstTs || t < firstTs) firstTs = t;
          if (!lastTs || t > lastTs) lastTs = t;
        }
      } catch { /* skip */ }
    }
    if (firstTs && lastTs && lastTs > firstTs) {
      return lastTs - firstTs;
    }
    return null;
  } catch {
    return null;
  }
}
```

### 2d. Call the helpers in `parseProjectData`

In `parseProjectData` (around line 446), after the `const tracking = ...` line and before the `return {` block, add:

```js
  // Session metadata enrichment
  const costLog = readProjectCostLog(project.path);
  const gitStats = readProjectGitStats(project.path);
  const sessionDurationMs = readSessionDuration(project.path);
```

Then include these fields in the return object:

```js
  return {
    name: project.name,
    display_name: project.display_name,
    path: project.path,
    added: project.added,
    state,
    roadmap,
    requirements,
    config,
    debt,
    phases_summary,
    milestones,
    parsed_at: new Date().toISOString(),
    health,
    tmux,
    tracking,
    costLog,        // { total: number } | null
    gitStats,       // { added: number, removed: number } | null
    sessionDurationMs, // number | null
  };
```

**Verify:**
```sh
curl -s http://localhost:3333/api/projects | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const ps=JSON.parse(d); const p=ps[0]; console.log('costLog:', p.costLog, 'gitStats:', p.gitStats, 'sessionDurationMs:', p.sessionDurationMs);"
```
Fields should be present (may be null if no cost-log exists yet — that is valid).

**Done:** `/api/projects` response objects include `costLog`, `gitStats`, and `sessionDurationMs` fields (null-safe).

---

## Task 26-03 — Render cost/lines/duration in dashboard milestone rows

**Files:**
- `dashboard/js/utils/format.js`
- `dashboard/js/components/project-card.js`
- `dashboard/css/cards.css`

**Action:**

### 3a. Add formatters to `dashboard/js/utils/format.js`

Append to the end of the file:

```js
// Format cost as $X.XX (returns null if no value)
export function fmtCost(total) {
  if (total == null || total === 0) return null;
  return '$' + total.toFixed(2);
}

// Format lines changed as +N/-N (returns null if no values)
export function fmtLinesChanged(added, removed) {
  if (added == null && removed == null) return null;
  const a = added || 0;
  const r = removed || 0;
  if (a === 0 && r === 0) return null;
  return `+${a}/-${r}`;
}

// Format duration in ms to "Xh Ym" or "Xm" (returns null if under 1 minute)
export function fmtSessionDuration(ms) {
  if (ms == null || ms < 60000) return null;
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}
```

### 3b. Update the import in `dashboard/js/components/project-card.js`

Change the format.js import at the top of the file from:

```js
import {
  parseProgress, fmtPct, fmtQuality, statusClass,
  getActiveMilestone, countCompletedMilestones, inferWorkflowStep,
  healthLabel, healthClass, computeShimmerClass, fmtIdleDuration
} from '../utils/format.js';
```

To:

```js
import {
  parseProgress, fmtPct, fmtQuality, statusClass,
  getActiveMilestone, countCompletedMilestones, inferWorkflowStep,
  healthLabel, healthClass, computeShimmerClass, fmtIdleDuration,
  fmtCost, fmtLinesChanged, fmtSessionDuration
} from '../utils/format.js';
```

### 3c. Build the metadata tail string and render in milestone row

In `project-card.js`, inside the `milestonesToShow.map(ms => { ... })` block (around line 156-174), before the `return html\`` of the milestone row, build the tail string:

```js
// Build metadata tail: +N/-N $X.XX Xm
const tailParts = [];
const lines = fmtLinesChanged(project.gitStats?.added, project.gitStats?.removed);
const cost = fmtCost(project.costLog?.total);
const dur = fmtSessionDuration(project.sessionDurationMs);
if (lines) tailParts.push(lines);
if (cost) tailParts.push(cost);
if (dur) tailParts.push(dur);
const metaTail = tailParts.join(' ');
```

Then in the milestone row JSX, replace the current empty last `<span></span>` with:

```js
<span class="card-ms-meta">${metaTail}</span>
```

The full updated milestone row render (replacing lines 162-174) should look like:

```js
return html`
  <div
    class="card-milestone-row"
    key=${ms.name}
    style="cursor:pointer"
    title="View ${ms.name} details"
    onClick=${(e) => { e.stopPropagation(); navigate('/project/' + encodeURIComponent(project.name) + '/' + encodeURIComponent(ms.name)); }}
  >
    <span class="card-ms-indicator">${ms.active ? '▸' : '·'}</span>
    <span class="card-ms-name" style="color:var(--term-cyan)">${ms.name}</span>
    <span class="card-ms-phase" style="color:var(--text-secondary)">${state.current_phase || ''}</span>
    <span class="card-ms-bar"><${ProgressBar} value=${pct} shimmerClass=${shimClass} /></span>
    <span class="card-ms-meta">${metaTail}</span>
  </div>
  ${msPanes.map(pane => { ... })}
`;
```

Note: the `tailParts`/`metaTail` computation must go before the `return html\`` statement, not inside it.

### 3d. Update CSS grid in `dashboard/css/cards.css`

The `.card-milestone-row` grid currently has 5 columns. The last column is a fixed `44px` empty tail. Update it to be wider to accommodate the metadata:

Find:
```css
.card-milestone-row {
  display: grid;
  grid-template-columns: 14px 72px 1fr minmax(100px, 160px) 44px;
```

Replace with:
```css
.card-milestone-row {
  display: grid;
  grid-template-columns: 14px 72px 1fr minmax(100px, 160px) minmax(0, 160px);
```

Add a new CSS rule for the `.card-ms-meta` class at the end of the file:

```css
.card-ms-meta {
  font-size: 13px;
  color: var(--term-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
  font-family: var(--font-data);
}
```

**Verify:**
1. Open the dashboard in a browser at `http://localhost:3333`
2. Find a project that has a `.planning/cost-log.jsonl` file or has uncommitted git changes
3. The milestone rows should show a tail like `+23/-5 $1.42 3m` in the rightmost column
4. Projects with no data should show an empty tail — no errors, no broken layout
5. Run a quick sanity check: `curl -s http://localhost:3333 | grep -c "card-ms-meta"` — should return >= 1 (the CSS is served)

**Done criteria:**
- Dashboard loads without JS errors in browser console
- Milestone rows show cost/lines/duration when data is available
- Milestone rows show nothing (not "null" or "undefined") when data is absent
- Grid layout is not broken on projects with no metadata
