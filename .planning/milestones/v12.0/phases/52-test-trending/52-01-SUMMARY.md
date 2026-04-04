---
phase: "52"
plan: "01"
subsystem: benchmark
tags: [test-trending, phase-benchmarks, schema-extension]
requires: []
provides: [test_count field in phase-benchmarks.jsonl, test_delta computation, --test-count CLI flag]
affects: [get-shit-done/bin/lib/benchmark.cjs, get-shit-done/bin/gsd-tools.cjs, get-shit-done/workflows/execute-plan.md]
tech-stack:
  added: []
  patterns: [parseJsonlFile reverse scan for prior non-null value]
key-files:
  created: []
  modified:
    - get-shit-done/bin/lib/benchmark.cjs
    - get-shit-done/bin/gsd-tools.cjs
    - get-shit-done/workflows/execute-plan.md
    - tests/benchmark.test.cjs
key-decisions:
  - test_delta reads prior entries after rotation so the file is always in a consistent state; first post-rotation entry gets null delta by design
  - test count extraction in execute-plan uses npm test output grep — non-blocking, falls back to empty string silently
  - Both test_count and test_delta are always written to entries (null when not applicable), never omitted
requirements-completed:
  - TEST-01
  - TEST-02
duration: ~20m
completed: 2026-04-04
---

# Phase 52 Plan 01: Test Count Extraction and phase-benchmarks Schema Extension Summary

Extended `state benchmark-plan` to capture current test count and compute a delta against the most recent prior non-null benchmark entry, with shell extraction in execute-plan.md and 4 new tests.

Duration: ~20m | Start: 2026-04-04 | End: 2026-04-04 | Tasks: 4 | Files modified: 4

## What Was Done

- **Task 1 — benchmark.cjs schema extension**: Added `test_count` and `test_delta` fields to the `cmdBenchmarkPlan` function. Accepts `opts.test_count` (integer or null); computes `test_delta` by scanning prior JSONL entries in reverse for the most recent entry with a finite `test_count`. Both fields always appear in written entries (null when omitted or no prior value found).

- **Task 2 — CLI flag wiring**: Added `--test-count N` flag parsing in the `state benchmark-plan` branch of `gsd-tools.cjs`. Updated the help comment block to document the new flag.

- **Task 3 — execute-plan.md shell extraction**: Added a non-blocking shell block before the `state benchmark-plan` call in the `update_current_position` step. Extracts the test count from `npm test` output by matching the Vitest summary line (`Tests  X passed`). If extraction fails, `TEST_COUNT_FLAG` stays empty and benchmark-plan runs normally without `--test-count`.

- **Task 4 — tests**: Added 4 new tests in `tests/benchmark.test.cjs` covering: null fields when flag omitted, first entry with count (delta null), delta computation from a prior entry, and null-skipping delta logic. All 9 benchmark tests pass.

## Verification Results

```
node --test tests/benchmark.test.cjs
# 9 tests, 9 pass, 0 fail

# Smoke test: first entry (delta null)
# test_count: 100 test_delta: null

# Smoke test: second entry (delta computed)
# test_count: 105 test_delta: 5
```

Full test suite: 1175 pass, 3 fail (3 failures are pre-existing, unrelated to this plan — config-get top-level value, scan-state.json empty object, tmux parseTmuxOutput).

## Decisions

- After file rotation (>500 entries), `parseJsonlFile` returns `[]` and `test_delta` is null for the first new entry. This is correct behavior — the prior window is gone.
- The Vitest grep pattern `grep -E 'Tests\s+[0-9]+'` extracts the first number from the "Tests X passed (Y)" summary line. This avoids running tests twice.

## Next

Ready for Plan 52-02 — surface test count delta in `/gsd:progress` and `/gsd:digest`.
