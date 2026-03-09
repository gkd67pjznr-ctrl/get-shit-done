---
quick_task: "18"
status: complete
date: "2026-03-09"
commits:
  - d789095
  - b572d3f
---

# Quick Task 18 — Summary

## What Was Done

Three related fixes to the GSD dashboard's multi-milestone display.

### Task 1 — Backend: per-milestone active detection (server.cjs)

Replaced the `resolveActiveMilestone()` single-string comparison approach in `parseAllMilestones()` with per-milestone STATE.md status inspection. The old code compared `dir.name === activeMilestone` (one global active string), meaning only one milestone could ever be `active: true`. The new code:

- Removes the `resolveActiveMilestone()` call entirely from this function
- After parsing `entry.state`, sets `entry.active` using a TERMINAL regex: `completed`, `shipped`, `done` (case-insensitive) → `active: false`; all other statuses → `active: true`; missing STATE.md → `active: false`

**Commit:** d789095

### Task 2A — project-card.js: milestonesToShow cap

Increased the `.slice(0, 3)` cap to `.slice(0, 6)` so all active milestones appear on the card. Used separate `activeMilestones` and `completedMilestones_` variables (trailing underscore avoids shadowing `completedMilestones` from `countCompletedMilestones()` at line 36).

### Task 2B — project-detail.js: enhanced accordion header

Added to the `MilestoneAccordion` collapsed header:
- `completedPhases`/`totalPhases` computed from `roadmap.phases`
- `pctClass` color-coding: green >=75%, amber 25-74%, red <25%
- `isWorking` flag: true when `milestone.active` AND state status includes "execut", "in-progress", "building", or "in progress"
- New `<span class="accordion-inprogress-badge">` shown when `isWorking`
- New `<span class="accordion-milestone-right">` wrapping phase count and pct badge

### Task 2C — detail.css: new accordion header styles

Replaced `.accordion-milestone-progress` (which had `margin-left: auto`) with:
- `.accordion-milestone-right` — flex container with `margin-left: auto`
- `.accordion-phase-count` — 11px muted data font
- `.accordion-pct-badge` + `.pct-green`, `.pct-amber`, `.pct-red` — color-coded badge with background tint
- `.accordion-inprogress-badge` — pulsing accent badge with `accordion-pulse` keyframe animation

**Commit:** b572d3f

## Verification

- `node -e "require('./get-shit-done/bin/lib/server.cjs')"` — no errors on both commits
- No deviations from the plan

## Files Modified

- `get-shit-done/bin/lib/server.cjs` — Task 1
- `dashboard/js/components/project-card.js` — Task 2A
- `dashboard/js/components/project-detail.js` — Task 2B
- `dashboard/css/detail.css` — Task 2C
