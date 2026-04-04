---
phase: 50
plan: 01
status: complete
started: 2026-04-04
completed: 2026-04-04
duration_estimate: 30m
commits:
  - adb3228 feat(gates): add eslint_gate to VALID_GATES in write-gate-execution.cjs
  - a39294a feat(gates): add eslint_gate detection and evaluation to gate-runner.cjs
  - 780a6d6 test(gates): add eslint_gate test suite covering detection and evaluation
---

# Plan 50-01 Summary: Wire ESLint MCP PostToolUse Hook

## Outcome

Complete. All 4 tasks executed. All must_haves satisfied. 13/13 tests pass (0 failures).

## Tasks Completed

### Task 1: Add eslint_gate to VALID_GATES
- Added `'eslint_gate'` to the VALID_GATES Set in `.claude/hooks/lib/write-gate-execution.cjs`
- File loads without error; `validateEntry()` now accepts `eslint_gate` entries

### Task 2: Add eslint_gate detection and evaluation to gate-runner.cjs
- Added `const { spawnSync } = require('child_process');` at top of file
- Added `runEslint(filePath, cwd)` helper that invokes `npx --no-install eslint --format json --no-eslintrc --rule '{}' <file>` with 10s timeout
- Modified `detectGate()`: Write events on `.ts/.tsx/.js/.cjs/.mjs` files now return `{ gate: 'eslint_gate', filePath, ... }` (replacing `diff_review`)
- Added `eslint_gate` evaluation branch in `evaluateGate()` with three outcomes:
  - `warned` + `detail: 'eslint_unavailable'` when ESLint not found
  - `blocked` + `detail: 'eslint_errors:N'` when errors detected
  - `passed` when clean
- `gsd-run-gates.cjs`: no `diff_review` conditionals found — no changes needed

### Task 3: Write tests for eslint_gate
- Created `tests/eslint-gate.test.cjs` with 10 tests covering:
  - Detection: `.ts`, `.js`, `.cjs`, null for `.md`/`.json`, `test_gate` for Bash
  - Evaluation: fast mode skip, standard mode runs gate, entry field correctness, degradation path

### Task 4: No regression in existing gate-runner tests
- `grep -rn "diff_review" tests/` found references only in `dashboard-server.test.cjs` and `server.test.cjs` — these are data fixtures testing server aggregation, not assertions about `detectGate` behavior
- `diff_review` remains in VALID_GATES so historical entries remain valid
- `gate-runner-skills.test.cjs` (3 tests) + `eslint-gate.test.cjs` (10 tests): 13/13 pass

## Deviations

None. Implementation followed the plan exactly.

## Verification Results

```
detectGate('Write', { file_path: '/tmp/foo.ts' }) => { gate: 'eslint_gate', ... }  OK
write-gate-execution loads OK
gsd-run-gates.cjs: no diff_review conditionals
node --test gate-runner-skills.test.cjs eslint-gate.test.cjs: 13 pass, 0 fail
```
