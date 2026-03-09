---
phase: 19-dashboard-ui
plan: "03"
subsystem: ui
tags: [preact, htm, signals, spa, sse, routing]

# Dependency graph
requires:
  - phase: 19-02
    provides: directory scaffold, CSS design system, index.html with import map
provides:
  - router.js: hash-based SPA router (route signal, navigate())
  - api.js: fetchProjects() and fetchProject(name) REST wrappers
  - sse.js: sseStatus signal and connectSSE() with exponential backoff
  - state.js: projects, loading, fetchError global signals
  - format.js: parseProgress, fmtPct, inferWorkflowStep, fmtQuality, statusClass, getActiveMilestone, countCompletedMilestones
  - header.js: sticky aggregate header with project stats and SSE indicator
  - sidebar.js: project list with active milestone navigation
  - progress-bar.js: animated progress bar with shimmer support
  - empty-state.js: onboarding guide component
  - project-card.js: project overview card with milestone rows and flash animation
affects:
  - 19-04 (app.js main entry point wires all components; project-detail.js uses router and api)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - preact/htm CDN import map pattern (no build step)
    - signal-based global state (projects, loading, fetchError as @preact/signals)
    - SSE exponential backoff (1000ms start, doubles, caps at 30000ms)
    - useRef/useEffect flash animation via DOM class manipulation with forced reflow
    - hash router parses #/project/<name>/<milestone> with decodeURIComponent

key-files:
  created:
    - dashboard/js/lib/router.js
    - dashboard/js/lib/api.js
    - dashboard/js/lib/sse.js
    - dashboard/js/lib/state.js
    - dashboard/js/utils/format.js
    - dashboard/js/components/header.js
    - dashboard/js/components/sidebar.js
    - dashboard/js/components/progress-bar.js
    - dashboard/js/components/empty-state.js
    - dashboard/js/components/project-card.js
  modified: []

key-decisions:
  - "sse.js imports projects from state.js to avoid circular deps -- state.js has no imports"
  - "project-card milestonesToShow: active milestones + last completed, capped at 3"
  - "Flash animation uses void el.offsetWidth to force reflow before re-adding card-flash class"

patterns-established:
  - "Signal access pattern: read .value inside render functions, never outside"
  - "HTM template syntax: html`...` with ${expr} for interpolation and ${() => ...} for event handlers"
  - "Import specifiers match importmap exactly: 'htm/preact', '@preact/signals', 'preact/hooks'"

requirements-completed:
  - UI-01
  - UI-02

# Metrics
duration: 25min
completed: 2026-03-09
---

# Phase 19-03: Frontend SPA Lib Utilities and Shared Components Summary

**Hash router, SSE client with backoff, global signal state, 7 format helpers, and 5 Preact components including flash-animated ProjectCard**

## Performance

- **Duration:** 25 min
- **Started:** 2026-03-09T06:00:00Z
- **Completed:** 2026-03-09T06:25:00Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- 5 lib/utility modules with correct @preact/signals imports and all required exports
- 4 shared Preact components (Header, Sidebar, ProgressBar, EmptyState) using HTM template syntax
- ProjectCard with useRef/useEffect flash animation triggered by project._flash field changes
- All 16 dashboard-server tests pass throughout

## Task Commits

1. **Task 19-03-01: Write lib utilities** - `563601c` (feat)
2. **Task 19-03-02: Write shared Preact components** - `3215c7c` (feat)
3. **Task 19-03-03: Write ProjectCard component** - `57eed12` (feat)

## Files Created/Modified
- `dashboard/js/lib/router.js` - Hash router with route signal and navigate()
- `dashboard/js/lib/api.js` - fetchProjects() and fetchProject(name) REST wrappers
- `dashboard/js/lib/sse.js` - EventSource with exponential backoff reconnection
- `dashboard/js/lib/state.js` - Global signals: projects, loading, fetchError
- `dashboard/js/utils/format.js` - 7 formatting/parsing helper functions
- `dashboard/js/components/header.js` - Sticky header with SSE dot and aggregate stats
- `dashboard/js/components/sidebar.js` - Project list with milestone navigation links
- `dashboard/js/components/progress-bar.js` - Animated progress bar with shimmer mode
- `dashboard/js/components/empty-state.js` - Onboarding guide for zero-project state
- `dashboard/js/components/project-card.js` - Project card with milestone rows and flash animation

## Decisions Made
- sse.js imports `projects` from state.js directly to mutate it on SSE events; state.js has no imports to keep dependency direction clean
- ProjectCard shows active milestones + last completed, sliced to max 3 rows to keep cards compact
- Flash animation: remove class, force reflow with `void el.offsetWidth`, re-add class — standard DOM trick to restart CSS animation

## Deviations from Plan

### Auto-fixed Issues

**1. [Prerequisite gap] CSS files from 19-02-02 were empty placeholder files**
- **Found during:** Plan startup check
- **Issue:** 19-02 was only partially executed -- scaffold (19-02-01) was committed but CSS content (19-02-02) was already committed in a separate session (commit 84673b9). On inspection the CSS files had full content already.
- **Fix:** Verified CSS was already committed, proceeded with 19-03 tasks immediately
- **Impact:** No action needed -- prerequisite was satisfied

---

**Total deviations:** 0 blocking (1 informational check, resolved immediately)
**Impact on plan:** None -- all 19-02 prerequisites were already in place

## Quality Gates

**Quality Level:** standard

| Task | Gate | Outcome | Detail |
|------|------|---------|--------|
| 1 | codebase_scan | passed | consulted server.cjs SSE event types, format.js regex validated against real STATE.md |
| 1 | test_baseline | passed | 16 tests passing |
| 1 | test_gate | passed | 16 tests passing after implementation |
| 2 | codebase_scan | passed | CSS class names verified against layout.css and cards.css |
| 2 | test_gate | passed | 16 tests passing |
| 3 | codebase_scan | passed | animations.css card-flash verified before implementing useEffect |
| 3 | test_gate | passed | 16 tests passing |

**Summary:** 7 gates ran, 7 passed, 0 warned, 0 skipped, 0 blocked

## Issues Encountered
None.

## Next Phase Readiness
- All 10 component/lib files have correct exports and HTM syntax
- Plan 19-04 can now wire everything together in app.js and write project-detail.js
- No blockers

---
*Phase: 19-dashboard-ui*
*Completed: 2026-03-09*
