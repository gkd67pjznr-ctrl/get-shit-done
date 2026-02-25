---
milestone: v2.0
audited: 2026-02-24T20:00:00Z
status: gaps_found
scores:
  requirements: 34/34
  phases: 7/7
  integration: 4/6
  flows: 3/6
gaps:
  requirements: []
  integration:
    - id: "INTEGRATION-3"
      severity: "high"
      description: "cmdInitPlanPhase hardcodes state_path, roadmap_path, requirements_path to .planning/ instead of using planningRoot(cwd, milestoneScope)"
      file: "get-shit-done/bin/lib/init.cjs"
      lines: "138-140"
      affected_requirements: ["ROUTE-02"]
      fix: "Derive paths from planningRoot(cwd, milestoneScope) like cmdInitExecutePhase does at lines 76-77"
    - id: "INTEGRATION-4"
      severity: "high"
      description: "cmdRoadmapGetPhase and cmdRoadmapAnalyze hardcode .planning/ROADMAP.md and do not accept milestoneScope parameter; CLI router does not pass milestoneScope to roadmap commands"
      file: "get-shit-done/bin/lib/roadmap.cjs"
      lines: "10, 94"
      router_file: "get-shit-done/bin/gsd-tools.cjs"
      router_lines: "436-438"
      affected_requirements: ["ROUTE-01", "ROUTE-02", "ROUTE-03", "PATH-01"]
      fix: "Add milestoneScope parameter to cmdRoadmapGetPhase and cmdRoadmapAnalyze; use planningRoot(cwd, milestoneScope) for roadmap path resolution; update CLI router to pass milestoneScope"
  flows:
    - id: "FLOW-1"
      name: "Plan-Phase in Milestone Context"
      severity: "high"
      break_point: "cmdInitPlanPhase returns .planning/STATE.md instead of .planning/milestones/v2.0/STATE.md"
      affected_requirements: ["ROUTE-02"]
      caused_by: "INTEGRATION-3"
    - id: "FLOW-2"
      name: "Roadmap Analysis in Milestone Context"
      severity: "high"
      break_point: "cmdRoadmapGetPhase ignores --milestone flag, reads root .planning/ROADMAP.md"
      affected_requirements: ["ROUTE-01", "ROUTE-02"]
      caused_by: "INTEGRATION-4"
    - id: "FLOW-3"
      name: "Progress Dashboard Roadmap Analysis"
      severity: "medium"
      break_point: "cmdRoadmapAnalyze in progress.md reads root ROADMAP.md not milestone workspace"
      affected_requirements: ["ROUTE-03", "DASH-02"]
      caused_by: "INTEGRATION-4"
tech_debt:
  - phase: "cross-phase"
    items:
      - "3 pre-existing test failures in init.test.cjs: config quality section defaults (fast vs standard) — present since before v2.0 work"
---

# v2.0 Milestone Audit: Concurrent Milestones

**Milestone Goal:** Enable multiple milestones to execute in parallel across separate Claude Code sessions with isolated workspaces, conflict awareness, and a compatibility layer for existing projects.

**Audited:** 2026-02-24
**Status:** gaps_found
**Previous Audit:** 2026-02-24T19:00:00Z (triggered Phase 14 gap closure)

## Scores

| Dimension | Score | Notes |
|-----------|-------|-------|
| Requirements | 34/34 | All requirements satisfied per 3-source cross-reference |
| Phases | 7/7 | All 7 phase VERIFICATION.md files present and passed |
| Integration | 4/6 | 2 high-severity cross-phase wiring gaps (NEW — not same as previous audit) |
| E2E Flows | 3/6 | 3 flows broken in milestone-scoped context |

## Phase Verification Summary

| Phase | Status | Score | Requirements |
|-------|--------|-------|-------------|
| 08 - Path Architecture Foundation | passed | 11/11 | PATH-01, PATH-02, PATH-03, PATH-04 |
| 09 - Milestone Workspace Initialization | passed | 11/11 | WKSP-01, WKSP-02, WKSP-03, WKSP-04, CNFL-01 |
| 10 - Compatibility Layer | passed | 5/5 | COMPAT-01, COMPAT-02, COMPAT-03 |
| 11 - Dashboard and Conflict Detection | passed | 12/12 | DASH-01, DASH-02, DASH-03, DASH-04, CNFL-02, CNFL-03, CNFL-04 |
| 12 - Full Routing Update | passed | 8/8 | ROUTE-01..05, PHASE-01..03, TEAM-01 |
| 13 - Test Coverage | passed | 9/9 | TEST-01..06 |
| 14 - Integration Wiring Fix | passed | 5/5 | DASH-01, DASH-02, DASH-03, CNFL-01, CNFL-02 (gap closure) |

**Previous gaps closed:** Phase 14 fixed INTEGRATION-1 (MILESTONE_VERSION extraction) and INTEGRATION-2 (update-manifest wiring) from previous audit. Both verified as resolved.

## 3-Source Requirements Cross-Reference

### Source 1: VERIFICATION.md Status

All 34 requirements marked SATISFIED in their respective phase VERIFICATION.md files.

### Source 2: SUMMARY.md Frontmatter

All 34 requirements listed in `requirements-completed` across 14 SUMMARY.md files:

| SUMMARY | Requirements Completed |
|---------|----------------------|
| 08-01 | PATH-01, PATH-02, PATH-04 |
| 08-02 | PATH-03 |
| 09-01 | WKSP-01, CNFL-01 |
| 09-02 | WKSP-02, WKSP-03, WKSP-04 |
| 10-01 | COMPAT-01, COMPAT-02, COMPAT-03 |
| 11-01 | DASH-01, DASH-03, CNFL-02, CNFL-04 |
| 11-02 | DASH-02, DASH-04, CNFL-03 |
| 11-03 | DASH-01 |
| 12-01 | ROUTE-02, ROUTE-04, PHASE-01, PHASE-02, PHASE-03 |
| 12-02 | ROUTE-01, ROUTE-03, ROUTE-05, TEAM-01 |
| 13-01 | TEST-01, TEST-02, TEST-03, TEST-04, TEST-05 |
| 13-02 | TEST-06 |
| 14-01 | DASH-01, DASH-02, DASH-03, CNFL-01, CNFL-02 |

### Source 3: REQUIREMENTS.md Traceability

All 34 requirements marked `[x]` Complete in traceability table.

### Cross-Reference Result

| Requirement | VERIFICATION.md | SUMMARY Frontmatter | REQUIREMENTS.md | Final Status |
|-------------|----------------|---------------------|-----------------|-------------|
| PATH-01 | passed | listed | [x] | **satisfied** |
| PATH-02 | passed | listed | [x] | **satisfied** |
| PATH-03 | passed | listed | [x] | **satisfied** |
| PATH-04 | passed | listed | [x] | **satisfied** |
| WKSP-01 | passed | listed | [x] | **satisfied** |
| WKSP-02 | passed | listed | [x] | **satisfied** |
| WKSP-03 | passed | listed | [x] | **satisfied** |
| WKSP-04 | passed | listed | [x] | **satisfied** |
| CNFL-01 | passed | listed | [x] | **satisfied** |
| CNFL-02 | passed | listed | [x] | **satisfied** |
| CNFL-03 | passed | listed | [x] | **satisfied** |
| CNFL-04 | passed | listed | [x] | **satisfied** |
| COMPAT-01 | passed | listed | [x] | **satisfied** |
| COMPAT-02 | passed | listed | [x] | **satisfied** |
| COMPAT-03 | passed | listed | [x] | **satisfied** |
| DASH-01 | passed | listed | [x] | **satisfied** |
| DASH-02 | passed | listed | [x] | **satisfied** |
| DASH-03 | passed | listed | [x] | **satisfied** |
| DASH-04 | passed | listed | [x] | **satisfied** |
| PHASE-01 | passed | listed | [x] | **satisfied** |
| PHASE-02 | passed | listed | [x] | **satisfied** |
| PHASE-03 | passed | listed | [x] | **satisfied** |
| ROUTE-01 | passed | listed | [x] | **satisfied** |
| ROUTE-02 | passed | listed | [x] | **satisfied** |
| ROUTE-03 | passed | listed | [x] | **satisfied** |
| ROUTE-04 | passed | listed | [x] | **satisfied** |
| ROUTE-05 | passed | listed | [x] | **satisfied** |
| TEST-01 | passed | listed | [x] | **satisfied** |
| TEST-02 | passed | listed | [x] | **satisfied** |
| TEST-03 | passed | listed | [x] | **satisfied** |
| TEST-04 | passed | listed | [x] | **satisfied** |
| TEST-05 | passed | listed | [x] | **satisfied** |
| TEST-06 | passed | listed | [x] | **satisfied** |
| TEAM-01 | passed | listed | [x] | **satisfied** |

**Orphaned requirements:** None. All 34 requirements in the traceability table appear in at least one phase VERIFICATION.md.

## Integration Gaps (Critical)

### INTEGRATION-3: cmdInitPlanPhase Hardcoded Paths (HIGH)

**File:** `get-shit-done/bin/lib/init.cjs` lines 138-140
**Affected:** ROUTE-02

`cmdInitPlanPhase` accepts `milestoneScope` and computes `planning_root = planningRoot(cwd, milestoneScope)` correctly (line 144), but hardcodes file paths:

```js
state_path: '.planning/STATE.md',              // Should derive from planningRoot
roadmap_path: '.planning/ROADMAP.md',          // Should derive from planningRoot
requirements_path: '.planning/REQUIREMENTS.md', // Should derive from planningRoot
```

Compare `cmdInitExecutePhase` (lines 76-77) which correctly does:
```js
state_path: path.relative(cwd, path.join(root, 'STATE.md')),
roadmap_path: path.relative(cwd, path.join(root, 'ROADMAP.md')),
```

**Impact:** When plan-phase workflow runs with `--milestone v2.0`, planner/plan-checker/researcher agents read root-level files instead of milestone workspace files.

### INTEGRATION-4: Roadmap Commands Ignore milestoneScope (HIGH)

**File:** `get-shit-done/bin/lib/roadmap.cjs` lines 10, 94
**Router:** `get-shit-done/bin/gsd-tools.cjs` lines 436-438
**Affected:** ROUTE-01, ROUTE-02, ROUTE-03, PATH-01

Both `cmdRoadmapGetPhase` and `cmdRoadmapAnalyze` hardcode the roadmap path:
```js
const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
```

The CLI router does not pass `milestoneScope` to either function:
```js
roadmap.cmdRoadmapGetPhase(cwd, args[2], raw);
roadmap.cmdRoadmapAnalyze(cwd, raw);
```

Despite workflows correctly passing `${MILESTONE_FLAG}` to these commands, the flag is silently ignored.

**Impact:** Plan-phase step 3 (`roadmap get-phase`) and progress/complete-milestone (`roadmap analyze`) read the root ROADMAP.md instead of the milestone workspace ROADMAP.md.

## Broken E2E Flows

### FLOW-1: Plan-Phase in Milestone Context (HIGH)

**Path:** plan-phase.md -> `init plan-phase --milestone v2.0` -> agents read wrong STATE.md/ROADMAP.md
**Breaks at:** `cmdInitPlanPhase` returns `.planning/STATE.md` instead of `.planning/milestones/v2.0/STATE.md`
**Caused by:** INTEGRATION-3

### FLOW-2: Roadmap Analysis in Milestone Context (HIGH)

**Path:** plan-phase.md step 3 -> `roadmap get-phase ${PHASE} ${MILESTONE_FLAG}` -> returns data from root roadmap
**Breaks at:** `cmdRoadmapGetPhase` ignores `--milestone` flag
**Caused by:** INTEGRATION-4

### FLOW-3: Progress Dashboard Roadmap Analysis (MEDIUM)

**Path:** progress.md -> `roadmap analyze ${MILESTONE_FLAG}` -> analyzes root roadmap
**Breaks at:** `cmdRoadmapAnalyze` ignores `--milestone` flag
**Note:** STATUS.md-based multi-milestone display works correctly (tested). Only roadmap analysis step is broken.
**Caused by:** INTEGRATION-4

## Working E2E Flows

| Flow | Description | Status |
|------|-------------|--------|
| New Milestone Creation | new-milestone -> workspace creation -> manifest-check | Working |
| Phase Execution (milestone) | execute-phase -> init -> planningRoot -> write-status -> update-manifest | Working |
| Legacy Compatibility | All commands without --milestone -> legacy paths | Working |

## Tech Debt

### Pre-existing Test Failures (3 tests)

Present across Phases 8, 10, 12, and 13 verifications. All 3 failures are in `tests/init.test.cjs`:
- `config quality section` — 2 failures: tests expect quality.level default `'fast'` but code returns `'standard'`
- `config auto-migration (QCFG-02)` — 1 failure: same fast/standard default mismatch

These predate v2.0 and are unrelated to concurrent milestone functionality.

### Anti-Patterns

None found across any phase. All 7 phase verifications confirmed zero TODO/FIXME/HACK/PLACEHOLDER comments in phase-modified files.

## Test Suite Status

```
Total tests: 235
Passing: 232
Failing: 3 (pre-existing, unrelated to v2.0)

v2.0-specific suites (all pass):
- core.test.cjs: 13/13
- compat.test.cjs: 12/12
- milestone.test.cjs: 17/17
- dashboard.test.cjs: 17/17
- routing.test.cjs: 21/21
- e2e.test.cjs: 7/7
```

## Previous Audit Gaps — Now Resolved

The first v2.0 audit (2026-02-24T19:00:00Z) found 2 integration gaps and 6 orphaned requirements. All were addressed:

- **INTEGRATION-1** (MILESTONE_VERSION extraction): Fixed by Phase 14 commit `b3dd30e`
- **INTEGRATION-2** (update-manifest wiring): Fixed by Phase 14 commit `60f1517`
- **TEST-01 through TEST-06** (orphaned requirements): Implemented by Phase 13, verified with 9/9 must-haves
