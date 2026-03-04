---
phase: 08-strip-core-legacy
verified: 2026-03-04T02:14:31Z
status: gaps_found
score: 12/14 must-haves verified
re_verification: false
gaps:
  - truth: "findPhaseInternal has no legacy fallback branch — no path.join(cwd, '.planning', 'phases') search"
    status: failed
    reason: "A deviation in Plan 08-02 (Task 3) restored the unconditional legacy .planning/phases/ fallback at core.cjs lines 280-284, contradicting both the 08-01 must-have and ROADMAP success criterion #4 (STRIP-03)"
    artifacts:
      - path: "get-shit-done/bin/lib/core.cjs"
        issue: "Lines 280-284 contain 'Fallback: search flat .planning/phases/ (non-milestone-scoped projects)' — a legacy branch the plan explicitly required deleting"
    missing:
      - "Remove lines 280-284 from findPhaseInternal in core.cjs (the legacy .planning/phases/ fallback) — or accept that STRIP-03 is partially fulfilled and update requirement definition"
  - truth: "All 309 tests pass after changes"
    status: partial
    reason: "300 tests pass (not 309). 9 detectLayoutStyle tests were removed from core.test.cjs because the function was deleted. Net result is 300/300 (0 failures), which is acceptable by plan language — but the test count goal was not met literally"
    artifacts:
      - path: "tests/core.test.cjs"
        issue: "9 detectLayoutStyle test cases removed; plan said this was permitted if they blocked passing"
    missing:
      - "No action required — 300/300 tests pass with 0 failures. Test count gap is a documentation issue: requirements state ~316 tests but this is Phase 9 scope"
---

# Phase 8: Strip Core Legacy — Verification Report

**Phase Goal:** No code checks or branches on layout style — milestone-scoped is the only path
**Verified:** 2026-03-04T02:14:31Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | detectLayoutStyle function does not exist in core.cjs | VERIFIED | `grep -c "detectLayoutStyle" core.cjs` returns 0; node confirms `typeof c.detectLayoutStyle === 'undefined'` |
| 2  | getArchivedPhaseDirs function does not exist in core.cjs | VERIFIED | `grep -c "getArchivedPhaseDirs" core.cjs` returns 0; node confirms `typeof c.getArchivedPhaseDirs === 'undefined'` |
| 3  | findPhaseInternal has no legacy fallback branch — no path.join(cwd, '.planning', 'phases') search | FAILED | Lines 280-284 of core.cjs contain an unconditional legacy `.planning/phases/` fallback restored as a deviation in Plan 08-02 |
| 4  | getRoadmapPhaseInternal has no detectLayoutStyle guards — cross-milestone fallback is unconditional | VERIFIED | Lines 332 and 353 use `if (!milestoneScope)` and `if (milestoneScope)` with no detectLayoutStyle call |
| 5  | Neither detectLayoutStyle nor getArchivedPhaseDirs appear in module.exports | VERIFIED | Both return `undefined`; not present in exports object |
| 6  | detectLayoutStyle not imported in any of the four dependent modules | VERIFIED | 0 hits in init.cjs, roadmap.cjs, phase.cjs, commands.cjs |
| 7  | getArchivedPhaseDirs not imported in any of the four dependent modules | VERIFIED | 0 hits in phase.cjs, commands.cjs |
| 8  | No init command outputs a layout_style field | VERIFIED | `grep -c "layout_style" init.cjs` returns 0 |
| 9  | roadmap.cjs conditionals simplified — no detectLayoutStyle guards | VERIFIED | Lines 41 and 82 use `if (milestoneScope)` unconditionally |
| 10 | phase.cjs conditionals simplified — no detectLayoutStyle or getArchivedPhaseDirs | VERIFIED | Line 191 uses `if (!foundInScope && milestoneScope)` unconditionally; no getArchivedPhaseDirs call |
| 11 | commands.cjs cmdProgressRenderMulti has no detectLayoutStyle gate | VERIFIED | Gate removed; function always executes multi-milestone path |
| 12 | commands.cjs cmdHistoryDigest has no getArchivedPhaseDirs call | VERIFIED | Block deleted; no getArchivedPhaseDirs reference |
| 13 | All 309 tests pass after changes | PARTIAL | 300/300 tests pass (0 failures), but count is 300 not 309 — 9 detectLayoutStyle tests removed from core.test.cjs |
| 14 | detectLayoutStyle not called anywhere in codebase | VERIFIED | Codebase-wide grep finds 0 hits in source files (references/agent-teams.md mention is documentation only) |

**Score:** 12/14 truths verified (1 failed, 1 partial)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `get-shit-done/bin/lib/core.cjs` | Core module without detectLayoutStyle or getArchivedPhaseDirs | STUB (partial) | Functions deleted and removed from exports; BUT legacy .planning/phases/ fallback present at lines 280-284 (contradicts STRIP-03 and 08-01 must-have #3) |
| `get-shit-done/bin/lib/init.cjs` | No detectLayoutStyle import, no layout_style fields | VERIFIED | 0 hits for detectLayoutStyle or layout_style |
| `get-shit-done/bin/lib/roadmap.cjs` | No detectLayoutStyle import or guard | VERIFIED | 0 hits; guards simplified |
| `get-shit-done/bin/lib/phase.cjs` | No detectLayoutStyle or getArchivedPhaseDirs | VERIFIED | 0 hits; includeArchived accepted as no-op parameter |
| `get-shit-done/bin/lib/commands.cjs` | No detectLayoutStyle gate or getArchivedPhaseDirs call | MOSTLY VERIFIED | 0 hits for both deleted functions; NOTE: line 497 has `layout_style: 'milestone-scoped'` hardcoded in cmdProgressRenderMulti output (constant string, not dynamic detection — does not violate STRIP-02) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| core.cjs | init.cjs | require('./core.cjs') destructure | VERIFIED | detectLayoutStyle not in import; layout_style absent from outputs |
| core.cjs | roadmap.cjs | require('./core.cjs') destructure | VERIFIED | detectLayoutStyle removed from import |
| core.cjs | phase.cjs | require('./core.cjs') destructure | VERIFIED | detectLayoutStyle and getArchivedPhaseDirs removed from import |
| core.cjs | commands.cjs | require('./core.cjs') destructure | VERIFIED | Both deleted functions removed from import |
| core.cjs | gsd-tools.cjs | require('./lib/core.cjs') | VERIFIED | detectLayoutStyle removed; resolveActiveMilestone call at line 205-206 is unconditional (deviation fix in 08-02) |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| STRIP-02 | 08-01, 08-02 | detectLayoutStyle() deleted from core.cjs; no code anywhere checks or branches on layout style | SATISFIED | Function deleted from core.cjs, removed from all module exports and imports; no dynamic layout detection anywhere in source |
| STRIP-03 | 08-01, 08-02 | planningRoot() always resolves to milestone path — no legacy fallback branch in findPhaseInternal | PARTIALLY SATISFIED | detectLayoutStyle guard removed; BUT an unconditional legacy .planning/phases/ fallback was restored in core.cjs lines 280-284 as a deviation. The requirement text says "no legacy fallback branch" — this branch exists. ROADMAP success criterion #4 is not met. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `get-shit-done/bin/lib/core.cjs` | 280-284 | Legacy `.planning/phases/` fallback restored unconditionally in `findPhaseInternal` | Blocker | Directly contradicts STRIP-03: "no legacy fallback branch in findPhaseInternal". The ROADMAP success criterion #4 states "findPhaseInternal has no legacy fallback branch (no path.join(cwd, '.planning', 'phases') search)" — this search is present. |
| `get-shit-done/bin/lib/commands.cjs` | 497 | `layout_style: 'milestone-scoped'` hardcoded string in cmdProgressRenderMulti output | Info | Not a layout style detection (no function call, no branching) — a constant annotation in JSON output. Does not violate STRIP-02 intent. However it perpetuates the field name in the API surface, which Phase 9 may want to address. |

## Step 7b: Quality Findings

### Missing Tests

- WARN: `get-shit-done/bin/lib/core.cjs` has no corresponding test file. Expected: `get-shit-done/bin/lib/core.test.cjs`. (Note: tests exist at `tests/core.test.cjs` — nonstandard location but tests do exist. This is a path convention difference, not an actual gap.)

**Step 7b: 0 WARN findings (0 duplication, 0 orphaned, 0 missing test), 0 INFO**

(Tests exist at `tests/*.test.cjs` — non-adjacent to source files by project convention. No genuine missing test gap found.)

### Human Verification Required

None — all verification points are code-checkable. The behavioral impact of the restored `.planning/phases/` fallback can be confirmed by inspecting the function directly.

### Gaps Summary

**1 blocker gap (STRIP-03 partially unmet):**

The plan required that `findPhaseInternal` have NO legacy `.planning/phases/` fallback — this was the core goal of STRIP-03. However, when running tests in Plan 08-02, 30+ test failures appeared because `createTempProject()` in the test helper creates flat `.planning/phases/` structures (not milestone-scoped). The executor restored the legacy fallback unconditionally to fix the tests.

The result is a compromise: `detectLayoutStyle` is fully gone (STRIP-02 satisfied), but `findPhaseInternal` still searches `.planning/phases/` as a final unconditional fallback (STRIP-03 partially unmet). The ROADMAP success criterion #4 is not met as written.

**Decision point for the team:** Either:
a. Accept this as "close enough" — the legacy fallback is now unconditional rather than gated on layout detection, which removes the dynamic branching behavior (tests are the real consumer)
b. Update test helpers to use `createConcurrentProject()` instead of `createTempProject()` and then remove the legacy fallback — this fully satisfies STRIP-03 as written

**Note on test count (partial gap):** 300 tests pass (not 309). The 9-test reduction is from removing detectLayoutStyle tests in core.test.cjs — the plan explicitly permitted this. This is a documentation gap, not a code gap. Phase 9's STRIP-05 sets the final target at ~316 tests.

---

_Verified: 2026-03-04T02:14:31Z_
_Verifier: Claude (gsd-verifier)_
