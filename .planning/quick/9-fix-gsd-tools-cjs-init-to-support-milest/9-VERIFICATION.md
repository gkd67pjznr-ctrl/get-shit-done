---
phase: quick-9
verified: 2026-03-02T00:00:00Z
status: passed
score: 3/3 must-haves verified
re_verification: false
---

# Quick Task 9: Fix gsd-tools.cjs init to support milestone-scoped layout — Verification Report

**Task Goal:** Fix gsd-tools.cjs init to support milestone-scoped directory layout
**Verified:** 2026-03-02
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `detectLayoutStyle` returns `milestone-scoped` when `.planning/milestones/` has subdirs with `STATE.md` even without `concurrent:true` in config.json | VERIFIED | `core.cjs` lines 488-501 implement directory-based fallback; test "directory-based detection" confirms at lines 121-131 of `tests/core.test.cjs`; 64/64 tests pass |
| 2 | `resolveActiveMilestone` sorts v14.0 after v9.0 (numeric, not lexicographic) | VERIFIED | `compareVersions()` helper at lines 506-515 of `core.cjs` replaces all three `.sort()` calls in `resolveActiveMilestone`; test "numeric sort strategy 1" asserts `v14.0` over `v2.0` at `tests/routing.test.cjs` line 450; 64/64 pass |
| 3 | `init plan-phase` finds phases in milestone workspace when `concurrent` flag is absent but milestones directory exists | VERIFIED | Integration test at `tests/init.test.cjs` lines 601-635 confirms `phase_found: true`, `layout_style: milestone-scoped`, `milestone_scope: v2.0`; live smoke test on gsdup returns `phase_found: true, layout_style: milestone-scoped, milestone_scope: v3.1` |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `get-shit-done/bin/lib/core.cjs` | Fixed `detectLayoutStyle` and `resolveActiveMilestone` functions | VERIFIED | Contains both the directory-based fallback (lines 488-501) and `compareVersions` helper (lines 506-515); `detectLayoutStyle` and `resolveActiveMilestone` exported in `module.exports` |
| `tests/core.test.cjs` | Tests for directory-based detection fallback | VERIFIED | Three new tests at lines 121-152: "directory-based detection" (with config, no false positive, no config at all); all assertions against `'milestone-scoped'` return value |
| `tests/routing.test.cjs` | Tests for version sorting with double-digit versions | VERIFIED | Three new tests at lines 433-474: strategy 1 (`v14.0` over `v2.0`), strategy 2 (`v10.0` over `v2.0`), strategy 3 (`v9.0` over `v1.0`) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `core.cjs:detectLayoutStyle` | `.planning/milestones/` directory | directory existence check fallback | WIRED | `fs.readdirSync(milestonesDir)` + `fs.existsSync(STATE.md)` at lines 492-498; pattern `/^v\d/` filters version dirs |
| `core.cjs:resolveActiveMilestone` | version sort | `compareVersions()` numeric comparison | WIRED | All three `.sort()` calls replaced with `.sort(compareVersions)`; `compareVersions` uses `.map(Number)` for numeric comparison — functionally satisfies plan requirement (plan listed `parseFloat/parseInt/localeCompare` as patterns but actual uses `.map(Number)` which is equivalent) |
| `gsd-tools.cjs:auto-detect` | `core.cjs:detectLayoutStyle` | `detectLayoutStyle === 'milestone-scoped'` triggers `resolveActiveMilestone` | WIRED | Line 206 in `gsd-tools.cjs`: `if (!milestoneScope && detectLayoutStyle(cwd) === 'milestone-scoped')` — confirmed present and unchanged |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BUG-INIT-01 | 9-PLAN.md | `init` commands return `phase_found: false` when `concurrent` flag absent | SATISFIED | Integration tests in `tests/init.test.cjs` describe block "init commands with milestone directory detection (BUG-INIT-01)" confirm fix; live smoke test passes |
| BUG-INIT-02 | 9-PLAN.md | `detectLayoutStyle` returns `'legacy'` when milestones exist without `concurrent:true` | SATISFIED | Unit tests in `tests/core.test.cjs` with directory-based detection confirm fix; `detectLayoutStyle` now falls back to directory scan |
| BUG-INIT-03 | 9-PLAN.md | `resolveActiveMilestone` lexicographic sort causes wrong version selection | SATISFIED | `compareVersions()` helper replaces all lexicographic `.sort()` calls; routing tests confirm `v14.0` selected over `v2.0` |

### Anti-Patterns Found

No anti-patterns detected in modified files:
- No TODO/FIXME/HACK/PLACEHOLDER comments in `core.cjs` lines 475-548
- No empty implementations or stub returns
- No console.log-only handlers
- All three task commits verified in git log: `97837bb` (RED tests), `4524bb7` (GREEN fix), `e0d31a0` (integration tests)

### Human Verification Required

None. All behaviors are programmatically verifiable:
- Function return values are deterministic
- Test suite provides full coverage of bug fixes
- Live smoke test on the gsdup project confirms end-to-end behavior

## Step 7b: Quality Findings

### Dead Code / Orphaned Exports

- INFO: `get-shit-done/bin/lib/core.cjs` export `compareVersions` has no project-internal importers outside `core.cjs` itself. This is intentional — the function is exported for testability as stated in the plan's design decisions. The tests for `resolveActiveMilestone` exercise it indirectly. No action required.

**Step 7b: 0 WARN findings (0 duplication, 0 orphaned, 0 missing test), 1 INFO**

## Gaps Summary

No gaps. All must-have truths verified, all artifacts substantive and wired, all three bug requirements satisfied.

The implementation correctly:
1. Adds directory-based fallback to `detectLayoutStyle()` using `hasValidConfig` flag (set only after successful `JSON.parse`) to preserve the existing "uninitialized for invalid JSON" behavior
2. Adds `compareVersions()` helper with part-by-part numeric comparison replacing lexicographic `.sort()` in all three strategies of `resolveActiveMilestone()`
3. Covers all fixes with 9 new tests (6 unit + 3 integration) bringing the total from 334 to 343 passing tests with 0 failures

---

_Verified: 2026-03-02_
_Verifier: Claude (gsd-verifier)_
