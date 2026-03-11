---
phase: quick-32
plan: "32"
type: quick
autonomous: true
wave: 1
depends_on: []
requirements: []
files_modified:
  - ~/.claude/hooks/gsd-statusline.js
  - ~/Projects/gsdup/.claude/hooks/gsd-statusline.js
---

# Quick Task 32 — Fix Status Line Showing Same +/-, Cost, Duration Across All Panes

## Problem

Lines 120-173 of `gsd-statusline.js` read `data.cost.total_lines_added`,
`data.cost.total_lines_removed`, `data.cost.total_cost_usd`, and
`data.cost.total_duration_ms` directly from the Claude Code stdin payload.
These are **project-level cumulative values**, not per-session values.
Every tmux pane running Claude Code in the same project therefore shows
identical +/-, $, and time values. Context window % differs across panes
because it comes from `data.context_window.remaining_percentage` which IS
per-session.

## Fix

Track per-pane baselines in `/tmp/claude-pane-metrics-{paneId}.json`.
On the first invocation for a pane, record baseline values.
On subsequent invocations, display deltas from baseline.
If a value drops below baseline (e.g. project resets after a commit), reset
the baseline to the new value.

The pane identifier is `process.env.TMUX_PANE` when inside tmux (e.g. `%3`),
falling back to `String(process.ppid)` (parent pid of the node process, which
is the Claude Code shell session).

---

## Task 1 — Implement per-pane metric delta tracking

**Files to modify:**
- `/Users/tmac/.claude/hooks/gsd-statusline.js`
- `/Users/tmac/Projects/gsdup/.claude/hooks/gsd-statusline.js`

**Action:**

Both files are identical. Apply the same patch to both.

### Step 1 — Add `getPaneMetrics` helper function

Insert this function after the closing brace of `getCumulativeCost` (around
line 266), before the `getGsdStatus` function:

```js
/**
 * Track per-pane baselines for lines added/removed and duration so that
 * each tmux pane shows its OWN delta rather than the shared project total.
 *
 * Baseline file: /tmp/claude-pane-metrics-{paneId}.json
 * Schema: { addedBaseline, removedBaseline, costBaseline, startTime, lastAdded, lastRemoved, lastCost }
 *
 * Returns { added, removed } as display values.
 * Also returns { costBaseline, startTime } so the caller can compute cost/duration deltas.
 */
function getPaneMetrics(currentAdded, currentRemoved) {
  const paneId = process.env.TMUX_PANE
    ? process.env.TMUX_PANE.replace(/[^a-zA-Z0-9_-]/g, '')
    : String(process.ppid);

  const filePath = path.join(os.tmpdir(), `claude-pane-metrics-${paneId}.json`);

  try {
    let stored = {};
    if (fs.existsSync(filePath)) {
      stored = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    const addedBaseline  = stored.addedBaseline  != null ? stored.addedBaseline  : currentAdded;
    const removedBaseline = stored.removedBaseline != null ? stored.removedBaseline : currentRemoved;
    const startTime      = stored.startTime       != null ? stored.startTime      : Date.now();

    // If counters went backwards (e.g. project reset), reset baselines forward
    const effectiveAddedBaseline  = currentAdded  < addedBaseline  ? currentAdded  : addedBaseline;
    const effectiveRemovedBaseline = currentRemoved < removedBaseline ? currentRemoved : removedBaseline;

    const displayAdded   = currentAdded   - effectiveAddedBaseline;
    const displayRemoved = currentRemoved - effectiveRemovedBaseline;

    fs.writeFileSync(filePath, JSON.stringify({
      addedBaseline:   effectiveAddedBaseline,
      removedBaseline: effectiveRemovedBaseline,
      startTime
    }));

    return { added: displayAdded, removed: displayRemoved, startTime };
  } catch (e) {
    // Fallback: show raw project values
    return { added: currentAdded, removed: currentRemoved, startTime: Date.now() };
  }
}
```

### Step 2 — Replace lines-changed block (lines 119-124)

Find this block:

```js
    // --- Lines changed ---
    const added = data.cost?.total_lines_added || 0;
    const removed = data.cost?.total_lines_removed || 0;
    if (added > 0 || removed > 0) {
      segments.push(`\x1b[32m+${added}\x1b[0m/\x1b[31m-${removed}\x1b[0m`);
    }
```

Replace with:

```js
    // --- Lines changed (per-pane delta) ---
    const rawAdded = data.cost?.total_lines_added || 0;
    const rawRemoved = data.cost?.total_lines_removed || 0;
    const { added, removed, startTime: paneStartTime } = getPaneMetrics(rawAdded, rawRemoved);
    if (added > 0 || removed > 0) {
      segments.push(`\x1b[32m+${added}\x1b[0m/\x1b[31m-${removed}\x1b[0m`);
    }
```

### Step 3 — Replace session duration block (lines 161-173)

Find this block:

```js
    // --- Session duration ---
    const durationMs = data.cost?.total_duration_ms;
    if (durationMs != null && durationMs >= 60000) {
      const totalMin = Math.floor(durationMs / 60000);
      let durStr;
      if (totalMin < 60) {
        durStr = `${totalMin}m`;
      } else {
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        durStr = m > 0 ? `${h}h${m}m` : `${h}h`;
      }
      segments.push(`\x1b[2m${durStr}\x1b[0m`);
    }
```

Replace with:

```js
    // --- Session duration (per-pane wall clock from first invocation) ---
    // paneStartTime is set by getPaneMetrics above
    const paneElapsedMs = Date.now() - paneStartTime;
    if (paneElapsedMs >= 60000) {
      const totalMin = Math.floor(paneElapsedMs / 60000);
      let durStr;
      if (totalMin < 60) {
        durStr = `${totalMin}m`;
      } else {
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        durStr = m > 0 ? `${h}h${m}m` : `${h}h`;
      }
      segments.push(`\x1b[2m${durStr}\x1b[0m`);
    }
```

**Note on cost:** The `getCumulativeCost` function already uses a per-pane
temp file keyed by `sessionId`. The `sessionId` comes from `data.session_id`,
which Claude Code sets per conversation. If multiple panes share the same
`session_id` (unlikely but possible), cost would still merge. However, since
the problem statement says context% differs across panes (confirming separate
sessions), `getCumulativeCost` should already be per-pane. Do NOT change the
cost logic — only lines +/- and duration need the new approach.

**Verify:**

1. Open two tmux panes both running Claude Code in the same project.
2. Do some work in pane A (modify a file via Claude). Pane A shows +N lines.
3. Pane B should show +0/-0 until work is done there, confirming per-pane isolation.
4. Check that duration in pane A reflects time since Claude started in THAT pane,
   not a shared project counter.
5. Verify the global copy was also updated:
   ```
   diff ~/.claude/hooks/gsd-statusline.js ~/Projects/gsdup/.claude/hooks/gsd-statusline.js
   ```
   Should show no diff.

**Done criteria:**

- `getPaneMetrics` function exists in both copies of the file
- Lines-changed block references `getPaneMetrics(rawAdded, rawRemoved)`
- Duration block uses `paneElapsedMs` (wall clock from pane's first invocation)
- Both file copies are identical
- No syntax errors: `node --check ~/.claude/hooks/gsd-statusline.js` exits 0
