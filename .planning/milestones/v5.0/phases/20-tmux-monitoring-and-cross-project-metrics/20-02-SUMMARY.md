---
phase: 20
plan: "02"
status: complete
completed: "2026-03-09"
commit: a79a2b5
---

# Plan 20-02 Summary: Tmux Poll Loop, PATCH Endpoint, and dashboard.cjs Tracking Support

## Outcome

All three tasks completed. The tmux poll loop is wired into `startDashboardServer`, the `PATCH /api/projects/:name/tracking` endpoint is live, and `setTracking` is exported from `dashboard.cjs`. All 16 dashboard-server tests pass; 1 pre-existing config-get failure unrelated to this plan.

## Tasks Completed

### 20-02-01: Tmux poll loop in startDashboardServer

Added `tmuxCache` (Map) and `tmuxHashMap` (Map) inside `startDashboardServer`. Added `runTmuxPoll()` function that calls `pollTmux()`, maps panes to projects, computes per-project state hashes, and broadcasts `tmux-update` SSE only when hash changes. `setInterval(runTmuxPoll, 5000)` starts after initial load. `clearInterval(tmuxPollInterval)` added to both SIGINT handler and `close()`.

Threaded `tmuxCache` through all internal call sites:
- `parseProjectData(project, tmuxCache)` in startup loop
- `watchProject(..., tmuxCache)` in startup loop and `watchRegistry` additions
- `watchRegistry(..., tmuxCache)` signature extended
- `createHttpServer(..., tmuxCache)` signature extended

### 20-02-02: PATCH /api/projects/:name/tracking endpoint

Extended `CORS_HEADERS` and inline `res.setHeader` calls to include `PATCH`. Added route handler using regex `/^\/api\/projects\/[^/]+\/tracking$/`. Handler reads request body, validates `tracking` is boolean, loads registry, updates or deletes the `tracking` field, saves, re-parses with `parseProjectData`, updates cache, broadcasts `project-update` SSE, returns 200.

### 20-02-03: setTracking in dashboard.cjs

Added `setTracking(name, tracking)` function that loads registry, finds project by name (throws if not found), sets or deletes the `tracking` field (omit = true for backward compat), saves registry, returns updated entry. Exported in `module.exports`.

## Verification

- `node --test tests/dashboard-server.test.cjs`: 16/16 pass, 0 fail
- `node --test tests/dashboard-registry.test.cjs`: 14/14 pass, 0 fail (combined run shows 30 pass)
- `npm test`: 913/914 pass -- 1 pre-existing failure (config-get command, unrelated)
- Route regex verified for correct match/non-match behavior
- `setTracking` export confirmed via node -e check

## Deviations

None. Implementation followed the plan exactly. The plan's suggestion to pass `tmuxCache` via closure/parameter was implemented as an explicit parameter to `createHttpServer`, `watchProject`, and `watchRegistry` -- cleaner than closure capture and consistent with the existing function signatures.

## Must-Have Truth Check

- GET /api/projects response includes `tmux` field: yes (`parseProjectData` sets `tmux` from `tmuxCache`)
- GET /api/projects response includes `health` field per project (null for paused): yes (`tracking: false` yields `health: null`)
- PATCH /api/projects/:name/tracking returns 200 and broadcasts project-update SSE: yes
- Tmux poll loop runs on 5-second interval and only broadcasts on hash change: yes
- `node --test tests/dashboard-server.test.cjs` passes with no new failures: yes (16/16)
- `setTracking` exported from dashboard.cjs: yes
