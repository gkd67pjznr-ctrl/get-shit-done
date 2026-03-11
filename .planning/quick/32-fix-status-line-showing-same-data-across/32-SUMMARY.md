# Quick Task 32 — Summary

## What changed

Added `getPaneMetrics()` function to `gsd-statusline.js` that tracks per-pane baselines
for lines added/removed and session duration using `/tmp/claude-pane-metrics-{paneId}.json`.

The pane identifier comes from `$TMUX_PANE` (e.g. `%3`) or falls back to `process.ppid`.

### Lines changed (+/-)
- Previously: displayed raw `data.cost.total_lines_added/removed` (project-level, same across all panes)
- Now: displays delta from per-pane baseline (each pane shows only lines added since IT started)
- Handles counter resets (baseline resets forward if counters drop)

### Duration
- Previously: displayed `data.cost.total_duration_ms` (project-level, same across all panes)
- Now: displays wall-clock time since the pane's first statusline invocation

### Cost
- Unchanged — `getCumulativeCost()` already uses per-session temp files keyed by `session_id`

## Files modified

- `~/.claude/hooks/gsd-statusline.js` (global)
- `~/Projects/gsdup/.claude/hooks/gsd-statusline.js` (project-local)

Both copies are identical (verified with diff).
