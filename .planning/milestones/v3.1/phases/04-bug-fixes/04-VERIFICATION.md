---
phase: 04-bug-fixes
verified: 2026-02-27T11:05:13Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 4: Bug Fixes Verification Report

**Phase Goal:** Fix known bugs — cmdMilestoneComplete phasesDir resolution, DEBT.md init paths, TO-DOS.md stale cleanup, CLI help completeness
**Verified:** 2026-02-27T11:05:13Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | `gsd milestone complete` runs without error in a milestone-scoped layout (phasesDir resolves correctly) | VERIFIED | `milestone.cjs` line 82: `const root = planningRoot(cwd, milestoneScope)` / line 88: `const phasesDir = path.join(root, 'phases')`. Tests pass: `milestone-complete.test.cjs` 2/2. |
| 2 | Running execute-plan.md with `--milestone` causes `roadmap update-plan-progress` to receive the milestone flag | VERIFIED | `execute-plan.md` lines 18-31: MILESTONE_FLAG derived from init JSON `milestone_scope`. Line 394: `roadmap update-plan-progress "${PHASE}" ${MILESTONE_FLAG}`. |
| 3 | `gsd init` creates DEBT.md in the project root; `migrate --apply` creates DEBT.md for projects that lack it | VERIFIED | `config.cjs` lines 15-33: `ensureDebtFile()` helper called from all 3 exit paths. `migrate.cjs` lines 167-184: DEBT.md `create_file` change in `inspectLayout()`. Tests pass: `debt-init.test.cjs` 7/7. |
| 4 | TO-DOS.md files created by the system land in the correct todos directory, not the .planning/ root | VERIFIED | `migrate.cjs` lines 186-194: `remove_stale` change type detects stale `TO-DOS.md`. Lines 449-452: `applyBasic` removes it. Nothing in the codebase creates `TO-DOS.md` at `.planning/` root. |
| 5 | `gsd --help` lists `migrate`, `debt`, and `milestone` commands alongside existing commands | VERIFIED | `gsd-tools.cjs` line 208: categorized help listing includes `Milestone: milestone, migrate` and `Debt: debt`. CLI output confirmed. `help.md` updated with Tech Debt Management and Migration sections. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `get-shit-done/bin/lib/milestone.cjs` | Milestone-scope-aware cmdMilestoneComplete | VERIFIED | Contains `planningRoot` import (line 7) and uses it for all path resolution (lines 82-88) |
| `get-shit-done/bin/gsd-tools.cjs` | CLI router passes milestoneScope to cmdMilestoneComplete; complete help text | VERIFIED | Line 578: `milestone.cmdMilestoneComplete(cwd, args[2], { name: milestoneName, archivePhases }, raw, milestoneScope)`. Line 208: full categorized command list |
| `get-shit-done/workflows/execute-plan.md` | Milestone-aware roadmap update step | VERIFIED | Lines 18-31 extract MILESTONE_SCOPE; line 394 passes `${MILESTONE_FLAG}` to roadmap update-plan-progress |
| `tests/milestone-complete.test.cjs` | Tests for milestone complete in milestone-scoped layout | VERIFIED | Exists, substantive (2 tests), all pass |
| `get-shit-done/bin/lib/config.cjs` | DEBT.md creation during project initialization | VERIFIED | `ensureDebtFile()` called from lines 118, 124, 158 — all three exit paths of `cmdConfigEnsureSection` |
| `get-shit-done/bin/lib/migrate.cjs` | DEBT.md creation and TO-DOS.md cleanup during migration | VERIFIED | Lines 167-194: DEBT.md `create_file` + TO-DOS.md `remove_stale` in `inspectLayout()`. Lines 449-452: handler in `applyBasic()` |
| `tests/debt-init.test.cjs` | Tests for DEBT.md auto-creation and TO-DOS.md cleanup | VERIFIED | Exists, substantive (7 tests across 3 describe groups), all pass |
| `get-shit-done/workflows/help.md` | Updated help reference with all CLI commands | VERIFIED | Contains `Tech Debt Management` section, `Migration` section, and `DEBT.md` in file structure diagram |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `milestone.cjs` | `core.cjs` | `planningRoot` import | WIRED | Line 7: `const { output, error, escapeRegex, planningRoot } = require('./core.cjs')` — imported and used at lines 82, 88 |
| `gsd-tools.cjs` | `milestone.cmdMilestoneComplete` | milestoneScope param | WIRED | Line 578 passes milestoneScope as 5th argument |
| `execute-plan.md` | `roadmap update-plan-progress` | MILESTONE_FLAG | WIRED | Line 394: `${MILESTONE_FLAG}` appended; extracted from init JSON at lines 25-31 |
| `config.cjs` | `.planning/DEBT.md` | `ensureDebtFile()` | WIRED | Called from all 3 exit paths (lines 118, 124, 158) |
| `migrate.cjs` | `.planning/DEBT.md` | `inspectLayout` change detection | WIRED | Line 167-184: `create_file` change; `applyBasic` handler at line 449 creates it |
| `gsd-tools.cjs` | CLI error handler | `error()` call | WIRED | Line 208: categorized listing including `migrate`, `debt`, `milestone` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| FIX-01 | 04-01-PLAN.md | `cmdMilestoneComplete` uses `planningRoot()` for phasesDir | SATISFIED | `milestone.cjs` line 88 confirmed; tests pass |
| FIX-02 | 04-01-PLAN.md | `execute-plan.md` passes `--milestone` to `roadmap update-plan-progress` | SATISFIED | `execute-plan.md` line 394 confirmed |
| FIX-03 | 04-02-PLAN.md | DEBT.md auto-created during project initialization | SATISFIED | `config.cjs` `ensureDebtFile()` at all exit paths; tests pass |
| FIX-04 | 04-02-PLAN.md | `migrate --apply` creates DEBT.md for projects that lack it | SATISFIED | `migrate.cjs` `inspectLayout` + `applyBasic` handler; tests pass |
| FIX-05 | 04-02-PLAN.md | TO-DOS.md in `.planning/` root cleanup | SATISFIED | `migrate.cjs` `remove_stale` change type + `applyBasic` handler; tests pass |
| CLI-01 | 04-03-PLAN.md | CLI `--help` output lists all commands including migrate, debt, milestone | SATISFIED | `gsd-tools.cjs` line 208 confirmed by running CLI |

**No orphaned requirements.** REQUIREMENTS.md maps MAINT-01, MAINT-02, DOC-01 to Phases 5 and 6 — correct, not Phase 4.

### Anti-Patterns Found

No anti-patterns found. Scanned all 6 modified `.cjs` files:
- No TODO/FIXME/XXX/HACK comments
- No placeholder return values
- No empty handlers
- No stub implementations

### Commit Verification

All 7 commits referenced in SUMMARY files exist in git:
- `784f19a` — fix(04-01): fix cmdMilestoneComplete phasesDir resolution and wire milestoneScope
- `5c8f901` — test(04-01): add milestone complete tests for milestone-scoped layout
- `9cb6410` — fix(04-01): pass --milestone flag to roadmap update-plan-progress in execute-plan.md
- `7af4c07` — fix(04-02): add DEBT.md init and TO-DOS.md stale cleanup
- `3b43b27` — test(04-02): add debt-init tests and fix migrate test fixtures
- `089cc00` — feat(04-03): update CLI usage message to list all commands
- `6a92c2b` — docs(04-03): update help.md reference with debt and migration commands

## Step 7b: Quality Findings

### Missing Tests

- INFO: `get-shit-done/bin/gsd-tools.cjs` has no corresponding test file. This is the CLI entry point — verifiable only by integration/functional tests, not a unit test peer. Tests for individual commands are in dedicated test files (`milestone-complete.test.cjs`, `debt-init.test.cjs`, etc.).
- INFO: `get-shit-done/workflows/execute-plan.md` is a workflow markdown file — no corresponding test file expected. Documented in plan quality gates as N/A.
- INFO: `get-shit-done/workflows/help.md` is documentation — no corresponding test file expected.

**Step 7b: 0 WARN findings (0 duplication, 0 orphaned, 0 missing test), 3 INFO**

### Human Verification Required

None — all fixes are programmatic (path resolution, file creation, string changes). All behavior is verified by the 307-test suite.

## Test Suite Status

Full suite: **307 pass, 0 fail** (run: `node --test tests/*.test.cjs`)

- `tests/milestone-complete.test.cjs`: 2/2 pass (FIX-01)
- `tests/debt-init.test.cjs`: 7/7 pass (FIX-03, FIX-04, FIX-05)
- `tests/migrate.test.cjs`: fixtures updated to include DEBT.md as required file

## Gaps Summary

No gaps. All 5 success criteria verified. All 6 requirements satisfied. No blocker anti-patterns.

---

_Verified: 2026-02-27T11:05:13Z_
_Verifier: Claude (gsd-verifier)_
