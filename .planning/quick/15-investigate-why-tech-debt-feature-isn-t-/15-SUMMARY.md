---
phase: 15-investigate-tech-debt-triggering
plan: 01
subsystem: workflows
tags: [tech-debt, workflows, integration]
dependency_graph:
  requires: [get-shit-done/bin/lib/debt.cjs]
  provides: [workflow-level debt logging instructions]
  affects: [verify-phase, execute-plan, verification-report]
key-files:
  modified:
    - get-shit-done/workflows/verify-phase.md
    - get-shit-done/workflows/execute-plan.md
    - get-shit-done/templates/verification-report.md
key-decisions:
  - "Place debt logging after anti-pattern scan and before status determination in verify-phase"
  - "Two insertion points in execute-plan: deviation handling (out-of-scope discoveries) and summary creation (reporting)"
  - "Non-critical gaps become debt entries; critical/blocking gaps remain in Gaps Summary as blockers"
metrics:
  duration: "2 min"
  completed: "2026-03-05"
  tasks: 2
  files: 3
---

# Quick Task 15: Integrate Tech Debt Logging into GSD Workflows

Wired gsd-tools debt log/list CLI into verify-phase, execute-plan, and verification-report workflows so tech debt is automatically captured during normal GSD usage instead of requiring ad-hoc knowledge of the tool.

## What Changed

### verify-phase.md
- Added `log_tech_debt` step between `scan_antipatterns` and `identify_human_verification`
- Instructs verifiers to log non-critical gaps (duplicated code, missing tests, orphaned exports, TODOs, stubs) as tech debt via `gsd-tools debt log`
- Includes guidance on what to log vs. what stays as blocker gaps
- Adds `gsd-tools debt list --status open` to get count for verification report

### verification-report.md
- Added "Tech Debt Logged" section after "Non-Critical Gaps" and before "Recommended Fix Plans"
- Template includes table format (ID, Type, Severity, Component, Description) and total count
- Fallback text for when no debt was logged

### execute-plan.md
- Added debt logging instructions in `deviation_documentation` for out-of-scope discoveries during task execution
- Added debt reporting in `create_summary` step to check and report logged entries
- Executors now capture discovered issues as tech debt instead of losing them

## Root Cause
The `gsd-tools debt log/list/resolve` CLI was fully functional but zero workflow files referenced it. The tool was an island -- agents only used it if they happened to know it existed ad-hoc. This integration ensures every verification and execution run surfaces the debt logging capability at the right moments.

## Deviations from Plan

None - plan executed exactly as written.

## Quality Gates

**Quality Level:** standard

| Task | Gate | Outcome | Detail |
|------|------|---------|--------|
| 1 | codebase_scan | passed | 1 existing debt log reference found in help.md |
| 1 | context7_lookup | skipped | N/A -- no external deps |
| 1 | test_baseline | passed | 716/717 tests passing (1 pre-existing) |
| 1 | test_gate | skipped | markdown workflow files, no exported logic |
| 1 | diff_review | passed | clean diff |
| 2 | codebase_scan | passed | deviation/scope patterns identified in execute-plan |
| 2 | context7_lookup | skipped | N/A -- no external deps |
| 2 | test_gate | skipped | markdown workflow file, no exported logic |
| 2 | diff_review | passed | clean diff |

**Summary:** 9 gates ran, 4 passed, 0 warned, 5 skipped, 0 blocked

## Issues Encountered

None.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | aad3db6 | Add tech debt logging to verify-phase workflow and verification report template |
| 2 | ea39e62 | Add tech debt logging to execute-plan workflow |
