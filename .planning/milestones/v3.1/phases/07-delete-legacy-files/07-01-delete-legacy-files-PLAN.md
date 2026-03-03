---
phase: 07-delete-legacy-files
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/bin/lib/migrate.cjs
  - tests/compat.test.cjs
  - tests/migrate.test.cjs
  - get-shit-done/bin/gsd-tools.cjs
autonomous: true
requirements: [STRIP-01]

must_haves:
  truths:
    - "migrate.cjs no longer exists in the codebase"
    - "Legacy test files compat.test.cjs and migrate.test.cjs no longer exist"
    - "CLI router has no migrate command — running 'gsd migrate' produces unknown command error"
    - "All remaining tests pass (expected ~314 from current 349 minus 35 deleted)"
  artifacts:
    - path: "get-shit-done/bin/gsd-tools.cjs"
      provides: "CLI router without migrate command"
      not_contains: "require('./lib/migrate.cjs')"
  key_links:
    - from: "get-shit-done/bin/gsd-tools.cjs"
      to: "get-shit-done/bin/lib/migrate.cjs"
      via: "require('./lib/migrate.cjs')"
      pattern: "require.*migrate"
      expected: "deleted — link must NOT exist"
---

<objective>
Delete all legacy migration files and remove the migrate CLI command from the router.

Purpose: Begin the legacy strip by removing the entire migration subsystem — migrate.cjs (legacy-to-milestone layout converter), its test files, and CLI entry point. After this, the codebase has no migration tooling since milestone-scoped layout is now the only supported layout.

Output: Three files deleted, one file edited, all remaining tests pass.
</objective>

<execution_context>
@/Users/tmac/.claude/get-shit-done/workflows/execute-plan.md
@/Users/tmac/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/milestones/v3.1/STATE.md
@.planning/milestones/v3.1/ROADMAP.md
@get-shit-done/bin/gsd-tools.cjs
</context>

<interfaces>
<!-- The executor needs to know the exact locations in gsd-tools.cjs to modify. -->

From get-shit-done/bin/gsd-tools.cjs:
- Line 159: `const migrate = require('./lib/migrate.cjs');` — DELETE this import
- Line 213: Help text string — remove `, migrate` from the "Milestone:" category so it reads `Milestone:   milestone`
- Lines 522-547: The entire `case 'migrate': { ... break; }` block — DELETE
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Delete legacy files</name>
  <files>get-shit-done/bin/lib/migrate.cjs, tests/compat.test.cjs, tests/migrate.test.cjs</files>
  <action>
Delete three files using rm:
1. `rm get-shit-done/bin/lib/migrate.cjs` — the entire migration module (legacy-to-milestone converter, ~600 lines)
2. `rm tests/migrate.test.cjs` — migration test suite (23 tests)
3. `rm tests/compat.test.cjs` — backward compatibility test suite (12 tests)

After deletion, verify each file no longer exists with `ls` (should return error / "No such file").
  </action>
  <verify>
    <automated>test ! -f get-shit-done/bin/lib/migrate.cjs && test ! -f tests/compat.test.cjs && test ! -f tests/migrate.test.cjs && echo "PASS: all 3 files deleted" || echo "FAIL: some files still exist"</automated>
  </verify>
  <done>migrate.cjs, compat.test.cjs, and migrate.test.cjs no longer exist on disk</done>
</task>

<task type="auto">
  <name>Task 2: Remove migrate command from CLI router</name>
  <files>get-shit-done/bin/gsd-tools.cjs</files>
  <action>
Edit `get-shit-done/bin/gsd-tools.cjs` to remove three things:

1. **Delete the require import** (line 159):
   Remove the line `const migrate = require('./lib/migrate.cjs');`

2. **Update the help text** (line 213):
   In the error string on line 213, change the Milestone category from:
   `Milestone:   milestone, migrate`
   to:
   `Milestone:   milestone`

3. **Delete the entire migrate case block** (lines 522-547):
   Remove the entire `case 'migrate': { ... break; }` block including:
   - The `case 'migrate': {` line
   - The version flag parsing
   - The `--cleanup`, `--dry-run`, `--apply` branches
   - The error message for unknown migrate subcommands
   - The `break;` and closing `}`

After editing, verify gsd-tools.cjs has no remaining references to `migrate.cjs` (the word "migrate" should NOT appear in any `require` statement or `case` block — note: it is acceptable if "migrate" appears in comment text elsewhere, but there should be zero functional references).
  </action>
  <verify>
    <automated>node -e "require('./get-shit-done/bin/gsd-tools.cjs')" 2>&1 | head -5; grep -n "require.*migrate\|case 'migrate'" get-shit-done/bin/gsd-tools.cjs && echo "FAIL: migrate references remain" || echo "PASS: no migrate references in router"</automated>
  </verify>
  <done>gsd-tools.cjs loads without error; no require or case block references migrate.cjs; help text no longer lists migrate</done>
</task>

<task type="auto">
  <name>Task 3: Run full test suite regression</name>
  <files></files>
  <action>
Run the full test suite to confirm no breakage:
```
node --test tests/*.test.cjs
```

Expected result: ~314 tests pass (349 current minus 35 deleted from migrate.test.cjs and compat.test.cjs), 0 failures.

If any tests fail, investigate — likely causes would be:
- Another test file importing from migrate.cjs (grep confirmed none exist, but verify)
- A test referencing the migrate CLI command (grep confirmed none exist, but verify)

Fix any unexpected failures before marking done.
  </action>
  <verify>
    <automated>node --test tests/*.test.cjs 2>&1 | grep "^# tests\|^# pass\|^# fail"</automated>
  </verify>
  <done>All remaining tests pass with 0 failures; test count is ~314 (no migrate/compat tests)</done>
</task>

</tasks>

<verification>
1. `test ! -f get-shit-done/bin/lib/migrate.cjs` — file does not exist
2. `test ! -f tests/compat.test.cjs` — file does not exist
3. `test ! -f tests/migrate.test.cjs` — file does not exist
4. `grep -c "case 'migrate'" get-shit-done/bin/gsd-tools.cjs` — returns 0
5. `grep -c "require.*migrate.cjs" get-shit-done/bin/gsd-tools.cjs` — returns 0
6. `node --test tests/*.test.cjs` — all remaining tests pass, 0 failures
</verification>

<success_criteria>
- migrate.cjs deleted from get-shit-done/bin/lib/
- compat.test.cjs deleted from tests/
- migrate.test.cjs deleted from tests/
- gsd-tools.cjs has no migrate require, no migrate case block, help text updated
- Full test suite passes with 0 failures (~314 tests)
</success_criteria>

<output>
After completion, create `.planning/milestones/v3.1/phases/07-delete-legacy-files/07-01-delete-legacy-files-SUMMARY.md`
</output>
