# Deferred Items — Phase 04 Bug Fixes

## Pre-existing Test Failures (out of scope for 04-01)

### migrate.test.cjs — 3 failures

**Discovered during:** Plan 04-01 Task 2 (test run)
**Root cause:** `fix(04-02)` added DEBT.md to the migration checklist (`migrate.cjs`) but did not update the test fixtures in `tests/migrate.test.cjs` that assert 0 changes on fully-configured projects.

**Affected tests:**
- `dry-run on fully-configured legacy project reports 0 changes (up-to-date)` (line 66)
- `dry-run on fully-configured project reports up-to-date raw value` (line 83)
- `dry-run on fully-configured concurrent project reports 0 changes` (line 95)

**Fix needed:** Update test fixtures to include `DEBT.md` in the "fully-configured" setup, or update the migrate logic to not require DEBT.md for fully-configured projects.

**Logged:** 2026-02-27
