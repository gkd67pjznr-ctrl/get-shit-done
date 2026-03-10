---
quick: "26"
status: complete
date: "2026-03-10"
commits:
  - 56b7a3a feat(server): enrich project data with cost, git stats, and session duration
  - 734adf9 feat(dashboard): render cost, git stats, and session duration in milestone rows
---

# Quick Task 26 — Summary

## What Was Done

Three tasks completed in one pipeline to show cost, git stats, and session duration in dashboard milestone rows.

### Task 26-01 — Add `cwd` to context bridge file

Updated `~/.claude/hooks/gsd-statusline.js` to include `cwd: dir` in the bridge file JSON written to `/tmp/claude-ctx-{sessionId}.json`. This enables the server to map bridge files back to project directories.

**Deviation:** This file is outside the git repo (`/Users/tmac/.claude/hooks/`) and cannot be committed. The change was applied to disk directly — it will take effect on the next Claude Code session.

### Task 26-02 — Enrich server project data

Added three helper functions to `get-shit-done/bin/lib/server.cjs` (inserted after `scanPhasesSummary`):
- `readProjectCostLog(projectPath)` — reads `.planning/cost-log.jsonl`, sums unique session cumulatives
- `readProjectGitStats(projectPath)` — runs `git diff --shortstat HEAD`, returns `{ added, removed }`
- `readSessionDuration(projectPath)` — matches bridge files by `cwd`, computes session duration from cost-log timestamps

Updated `parseProjectData` return object to include `costLog`, `gitStats`, and `sessionDurationMs` (all null-safe).

### Task 26-03 — Render in dashboard

Added three formatter functions to `dashboard/js/utils/format.js`:
- `fmtCost(total)` — formats as `$X.XX`
- `fmtLinesChanged(added, removed)` — formats as `+N/-N`
- `fmtSessionDuration(ms)` — formats as `Xh Ym` or `Xm`

Updated `project-card.js` to import the new formatters and compute a `metaTail` string before each milestone row render. The milestone row's empty `<span>` was replaced with `<span class="card-ms-meta">${metaTail}</span>`.

Updated `dashboard/css/cards.css`:
- `.card-milestone-row` last grid column changed from `44px` to `minmax(0, 160px)`
- Added `.card-ms-meta` rule with right-aligned, ellipsis-overflow styling

## Verification

- Server builds cleanly (no syntax errors in modified functions)
- Dashboard JS imports are consistent with exported symbols
- Null-safety: all three new fields default to `null`; formatters return `null` for missing/zero data; `metaTail` is empty string when all parts are null — no "null" or "undefined" renders in the UI
- Grid layout preserved: same 5-column structure, last column just wider and flexible
