---
quick: 27
status: complete
date: 2026-03-10
commits:
  - b35c369
  - 7f16b24
---

# Quick-27 Summary: Show Untagged Tmux Sessions on Overview

## Goal Achieved

Removed the per-card "sessions(active)" badge and expandable dropdown table from project cards. Replaced with a flat `UntaggedSessions` section at the bottom of the Overview page showing all unmatched panes across all projects.

## Tasks Completed

### Task 1 — Strip badge and dropdown from ProjectCard (commit b35c369)

- Removed `useState` import (was only used by `sessionExpanded`)
- Removed `sessionExpanded`, `sessionCount`, `claudePanes`, `activePanes` state variables (lines 51-58)
- Removed `dropdownPanes` computation (line 83)
- Removed the session-badge block from card header JSX (lines 120-132)
- Removed the session expand panel (lines 213-250)

Verification: `grep -n "sessionExpanded|session-badge|activePanes|sessionCount|session-metadata|dropdownPanes" project-card.js` — zero matches.

### Task 2 — Add UntaggedSessions section to Overview in app.js (commit 7f16b24)

- Updated format.js import to include `fmtIdleDuration` and `fmtSessionDuration`
- Added `SHELL_CMDS_OV` module-level constant
- Defined `UntaggedSessions` component that collects all unmatched panes across all projects using the same milestone-matching logic as ProjectCard
- Each row shows: 3-char project abbreviation, window name (clickable), status (working/waiting/idle), idle duration, session metrics (+/-/cost/duration)
- Inserted `<${UntaggedSessions}>` into Overview return between card-grid and tip div
- Added `.untagged-sessions` and `.untagged-sessions-header` CSS to cards.css

## Verification

- `grep -n "sessionExpanded|session-badge" project-card.js` — zero matches
- `grep -n "UntaggedSessions" app.js` — 2 matches (definition line 37, usage line 134)
- `grep -n "fmtIdleDuration|fmtSessionDuration" app.js` — 3 matches (import + 2 usages in component)
- `grep -n "untagged-sessions" cards.css` — 2 matches (`.untagged-sessions` and `.untagged-sessions-header`)

## No Deviations

All tasks executed exactly as planned.
