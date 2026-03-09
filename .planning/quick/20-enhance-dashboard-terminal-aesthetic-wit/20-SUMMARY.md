---
quick_task: "20"
status: complete
commit: 17966b0
date: 2026-03-09
files_modified:
  - dashboard/css/layout.css
  - dashboard/js/components/project-card.js
  - dashboard/js/components/sidebar.js
---

# Quick Task 20 — Summary: Enhance Dashboard Terminal Aesthetic

## What Was Done

Four targeted cosmetic enhancements to the dashboard terminal aesthetic, all completed in a single commit.

### Task 1: Color-code project names by health status

**project-card.js** (line 93): Applied `healthClass(health)` to `.card-project-name` span, with `status-not-started` fallback for paused projects. Project names now render green for healthy, amber for attention, red for blocked, gray for paused/unknown.

**sidebar.js**: Updated imports to include `statusClass` and `parseProgress`. Sidebar project name `div` now has `healthClass(p.health)` applied (or `status-not-started` for paused projects).

### Task 2: Sidebar — all active milestones with phase counts

Replaced the single-milestone `getActiveMilestone` display with a loop over all active milestones (`p.milestones.filter(m => m.active)`). Each milestone row shows:
- Milestone name colored by `statusClass(ms.state.status)`
- `[done/total]` phase count in dim 10px text when roadmap phases exist

### Task 3: Progress bar background on sidebar project rows

**layout.css**: Added `.sidebar-project-bar` utility class with an absolutely-positioned `::before` pseudo-element that fills proportionally to `--bar-pct` CSS variable. Uses `rgba(63, 185, 80, 0.08)` — same green as terminal aesthetic, 8% opacity. Content sits at `z-index: 1` above the fill at `z-index: 0`. No layout shifts.

**sidebar.js**: Added `sidebar-project-bar` class to project divs and computed `--bar-pct` from the primary active milestone's progress percentage.

### Task 4: Larger cross-project metric values

**layout.css**: Added `font-size: 13px` to `.sidebar-metric-value` (previously inherited 11px from parent). Values are now visibly larger than the 10px labels.

## Deviations

- `tokens.css` was listed in the plan's `files_modified` but no changes were needed there — all CSS additions fit cleanly into `layout.css`.
- `healthLabel` was an unused import in sidebar.js before this task and remains so. Left in place to avoid scope creep in a cosmetic-only task.

## Verification

- Commit `17966b0` contains exactly 3 files changed (layout.css, project-card.js, sidebar.js)
- All changes are purely cosmetic — no data model changes, no new API calls
- `healthClass` and `statusClass` already existed in format.js, no new utilities needed
