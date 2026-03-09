---
phase: 19-dashboard-ui
plan: "01"
subsystem: ui

# Dependency graph
requires:
  - phase: 18-data-aggregation
    provides: server.cjs with createHttpServer(), parseProjectData(), startDashboardServer()
provides:
  - parseAllMilestones() function for per-milestone data aggregation
  - milestones[] field on every parseProjectData() return value
  - Static file serving with SPA fallback in createHttpServer()
  - Path traversal guard (403 on ../ in raw HTTP requests)
  - dashboardDir opt threaded through startDashboardServer() for test isolation
  - Browser auto-open (darwin/win32/linux) in gsd dashboard serve CLI
affects:
  - 19-02 (frontend SPA depends on /api/projects milestones field and static serving)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - raw-socket traversal testing (dns.lookup + net.Socket to bypass http.get normalization)
    - SPA fallback: serve index.html for any unknown path (non-API, non-asset)
    - MIME_TYPES map with charset for text types

key-files:
  created: []
  modified:
    - get-shit-done/bin/lib/server.cjs
    - get-shit-done/bin/gsd-tools.cjs
    - tests/dashboard-server.test.cjs

key-decisions:
  - "Path traversal guard uses req.url.includes('..') check before URL normalization, since Node http.get() normalizes ../ client-side -- raw HTTP requests (browsers, curl) send the raw path"
  - "SPA fallback returns 200 with index.html for any non-existent asset path (standard SPA routing pattern)"
  - "dashboardDir constant uses path.join(__dirname, '..', '..', '..', 'dashboard') -- three levels up from bin/lib/"
  - "Browser auto-open fires after 300ms setTimeout; failure is non-fatal (logged, not thrown)"

patterns-established:
  - "Test traversal with dns.lookup + net.Socket to avoid http.get URL normalization"
  - "Thread dashboardDir through opts to enable test isolation without touching global state"

requirements-completed:
  - UI-01
  - UI-02

# Metrics
duration: 25min
completed: 2026-03-09
---

# Phase 19, Plan 01: Server Backend Extensions Summary

**Static file serving, multi-milestone data API, and browser auto-open added to server.cjs; 16 tests pass (5 new)**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-09T05:00:00Z
- **Completed:** 2026-03-09T05:25:00Z
- **Tasks:** 4
- **Files modified:** 3

## Accomplishments

- `parseAllMilestones(projectPath)` reads `.planning/milestones/v*/` and returns per-milestone state, roadmap, requirements, and phases_summary; exported from server.cjs
- `parseProjectData()` now includes a `milestones` array field alongside existing fields
- `serveStatic()` added to createHttpServer(); serves dashboard assets by MIME type, SPA fallback for missing files, 403 for path traversal attempts; `dashboardDir` opt threads through `startDashboardServer()`
- Browser auto-open added to `gsd dashboard serve` CLI with platform detection (darwin/win32/linux); failure is non-fatal
- 5 new tests cover milestones array count, flat-layout empty milestones, GET / (200), SPA fallback (200), and path traversal (403 via raw socket)

## Task Commits

1. **Task 19-01-01: parseAllMilestones() and milestones field** - `58804d9` (feat)
2. **Task 19-01-02: static file serving with SPA fallback** - `9c94b2d` (feat)
3. **Task 19-01-03: browser auto-open in CLI** - `d186595` (feat)
4. **Task 19-01-04: multi-milestone and static file serving tests** - `81d1e84` (test)

## Files Created/Modified

- `get-shit-done/bin/lib/server.cjs` - Added parseAllMilestones(), serveStatic(), DASHBOARD_DIR/MIME_TYPES constants, updated createHttpServer() and startDashboardServer()
- `get-shit-done/bin/gsd-tools.cjs` - Added browser auto-open logic to dashboard serve case
- `tests/dashboard-server.test.cjs` - Added createMilestoneProject() helper, httpGetRaw() raw socket helper, and 2 new describe suites (7 suites total, 16 tests)

## Decisions Made

- Path traversal guard checks `req.url.includes('..')` before URL parsing because `new URL()` and Node's `http.get()` normalize `../` -- the raw check is the only way to catch real-world traversal attempts from browsers and curl
- SPA fallback serves `index.html` with 200 for any missing path (standard practice for SPA routing)
- Traversal test uses raw TCP socket (`dns.lookup` + `net.Socket`) to avoid http.get normalization -- this is the pattern for traversal testing in this codebase

## Deviations from Plan

### Auto-fixed Issues

**1. Path traversal guard required `req.url.includes('..')` check**
- **Found during:** Task 19-01-02 (static file serving verify)
- **Issue:** Plan specified `path.resolve() + startsWith()` guard, but Node's `http.get()` normalizes `../` before sending, so `req.url` is already `/etc/passwd` by the time the server sees it. `path.join(dashboardDir, '/etc/passwd')` joins to `dashboardDir/etc/passwd` (inside dashboard dir), so the resolve guard never fires for HTTP client requests.
- **Fix:** Added `if (req.url && req.url.includes('..'))` pre-check. The secondary `path.resolve + startsWith` guard remains as defense-in-depth.
- **Files modified:** get-shit-done/bin/lib/server.cjs
- **Verification:** traversal test using raw net.Socket passes (403), normal requests unaffected
- **Committed in:** 9c94b2d

**2. Traversal test required raw socket instead of httpGet()**
- **Found during:** Task 19-01-04 (writing traversal test)
- **Issue:** httpGet() uses http.get() which normalizes `/../..` to `/etc/passwd` before sending -- the `req.url.includes('..')` guard never fires for http.get() calls
- **Fix:** Added `httpGetRaw()` helper using dns.lookup + net.Socket to send raw HTTP request without client normalization
- **Files modified:** tests/dashboard-server.test.cjs
- **Verification:** traversal test passes with 403 status
- **Committed in:** 81d1e84

---

**Total deviations:** 2 auto-fixed (1 security guard adjustment, 1 test infrastructure)
**Impact on plan:** Both auto-fixes necessary for correct traversal protection and testability. No scope creep.

## Quality Gates

**Quality Level:** standard

| Task | Gate | Outcome | Detail |
|------|------|---------|--------|
| 19-01-01 | codebase_scan | passed | reused scanPhasesSummary pattern, existing parse* functions |
| 19-01-01 | test_baseline | passed | 11 tests passing before change |
| 19-01-01 | test_gate | passed | 11 tests still pass after |
| 19-01-02 | codebase_scan | passed | reused existing request handler pattern |
| 19-01-02 | test_gate | passed | 11 tests pass, manual verify confirmed 200/403 |
| 19-01-03 | test_gate | passed | 11 tests pass, grep confirmed code present |
| 19-01-04 | test_gate | passed | 16 tests pass (5 new), npm test 908/909 (1 pre-existing failure) |

**Summary:** 7 gates ran, 7 passed, 0 warned, 0 skipped, 0 blocked

## Issues Encountered

- Pre-existing `config-get` test failure (1 of 909) unrelated to this plan -- confirmed pre-existing by stash test

## Next Phase Readiness

- Server backend fully ready for Plan 19-02 (frontend SPA): `/api/projects` returns `milestones[]`, static file serving active
- `DASHBOARD_DIR` constant points to `dashboard/` at project root -- Plan 19-02 builds the SPA files there
- All 16 dashboard-server tests pass; server infrastructure is solid

---
*Phase: 19-dashboard-ui*
*Completed: 2026-03-09*
