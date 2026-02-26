---
phase: quick-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
requirements: [MIGR-01, MIGR-02, MIGR-03]
must_haves:
  truths:
    - "Dry-run reports current state of gymrats .planning/ without modifying anything"
    - "Apply creates any missing structural elements (if any) and writes migrate-undo.json"
    - "Second dry-run confirms idempotency (0 automatable changes remaining)"
  artifacts:
    - path: "~/projects/gymrats/.planning/migrate-undo.json"
      provides: "Undo manifest from migration apply"
  key_links:
    - from: "gsd-tools.cjs migrate"
      to: "~/projects/gymrats/.planning/"
      via: "cwd parameter passed to inspectLayout"
---

<objective>
Test the GSD migration tool (`migrate.cjs`) against the real-world gymrats project at ~/projects/gymrats.

Purpose: Validate that the migration tool correctly inspects an existing .planning/ directory, applies additive-only changes, and demonstrates idempotency (MIGR-01, MIGR-02, MIGR-03) on a non-trivial project that already has substantial planning structure.

Output: Console output from dry-run, apply, and verification dry-run confirming the tool works correctly on real project data.
</objective>

<execution_context>
@/Users/tmac/.claude/get-shit-done/workflows/execute-plan.md
@/Users/tmac/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/migrate.cjs
@/Users/tmac/Projects/gsdup/get-shit-done/bin/gsd-tools.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Dry-run migration inspection on gymrats</name>
  <files></files>
  <action>
Run the migration tool in dry-run mode against the gymrats project to inspect its current .planning/ layout and identify what (if anything) needs migration.

Execute from the gymrats project directory:
```bash
cd /Users/tmac/Projects/gymrats && node /Users/tmac/Projects/gsdup/get-shit-done/bin/gsd-tools.cjs migrate --dry-run
```

Capture and review the output. The gymrats project already has: config.json, phases/, PROJECT.md, STATE.md, ROADMAP.md, REQUIREMENTS.md, MILESTONES.md, milestones/, research/, quick/, RETROSPECTIVE.md, TO-DOS.md. So the tool should report the existing layout style and likely few or zero automatable changes.

Record what the tool reports:
- What layout style is detected (legacy, milestone-scoped, or uninitialized)
- How many automatable changes are needed
- How many manual actions are flagged
- Whether the output JSON structure matches the expected schema from migrate.cjs

If the tool errors out, capture the error message — that itself is a valuable test result indicating a bug to fix.

  <quality_scan>
    <code_to_reuse>N/A — this is a test execution task, not a code creation task</code_to_reuse>
    <docs_to_consult>N/A — no external library dependencies</docs_to_consult>
    <tests_to_write>N/A — no new exported logic; this task IS the manual test</tests_to_write>
  </quality_scan>
  </action>
  <verify>
    <automated>cd /Users/tmac/Projects/gymrats && node /Users/tmac/Projects/gsdup/get-shit-done/bin/gsd-tools.cjs migrate --dry-run</automated>
  </verify>
  <done>Dry-run completes without error and produces JSON output showing the gymrats layout inspection results (layout style, changes list, summary counts)</done>
</task>

<task type="auto">
  <name>Task 2: Apply migration and verify idempotency</name>
  <files></files>
  <action>
Run the migration tool in apply mode against the gymrats project, then re-run dry-run to verify idempotency.

Step 1 — Apply migration:
```bash
cd /Users/tmac/Projects/gymrats && node /Users/tmac/Projects/gsdup/get-shit-done/bin/gsd-tools.cjs migrate --apply
```

Review the apply output:
- How many actions were taken (should match automatable changes from Task 1)
- What was created (directories, files)
- Confirm migrate-undo.json was written at /Users/tmac/Projects/gymrats/.planning/migrate-undo.json
- Review the undo manifest contents to verify it records what was done

Step 2 — Read the undo manifest:
```bash
cat /Users/tmac/Projects/gymrats/.planning/migrate-undo.json
```

Step 3 — Verify idempotency (MIGR-03) by running dry-run again:
```bash
cd /Users/tmac/Projects/gymrats && node /Users/tmac/Projects/gsdup/get-shit-done/bin/gsd-tools.cjs migrate --dry-run
```

The second dry-run should show 0 automatable changes (changes_needed: 0). Manual actions may still appear since those are informational only and never auto-applied.

Step 4 — Run apply again to confirm idempotency from the apply side:
```bash
cd /Users/tmac/Projects/gymrats && node /Users/tmac/Projects/gsdup/get-shit-done/bin/gsd-tools.cjs migrate --apply
```

Should report actions_taken: 0 and raw output "already-up-to-date".

If the gymrats project was already fully up-to-date from Task 1 (0 automatable changes), that is itself a valid idempotency confirmation — document this in the summary.

  <quality_scan>
    <code_to_reuse>N/A — test execution task</code_to_reuse>
    <docs_to_consult>N/A — no external library dependencies</docs_to_consult>
    <tests_to_write>N/A — no new exported logic</tests_to_write>
  </quality_scan>
  </action>
  <verify>
    <automated>cd /Users/tmac/Projects/gymrats && node /Users/tmac/Projects/gsdup/get-shit-done/bin/gsd-tools.cjs migrate --dry-run --raw</automated>
  </verify>
  <done>Apply completes successfully, migrate-undo.json exists with valid JSON, second dry-run shows 0 automatable changes (raw output is "up-to-date"), confirming MIGR-01/02/03 all pass on the gymrats project</done>
</task>

</tasks>

<verification>
All three migration guarantees validated on a real project:
- MIGR-01: --dry-run inspects and reports without modifying
- MIGR-02: --apply creates only missing items, writes undo manifest
- MIGR-03: Re-running shows 0 changes (idempotent)
</verification>

<success_criteria>
- Migration dry-run produces valid JSON output with layout detection
- Migration apply succeeds (or reports already up-to-date)
- migrate-undo.json exists and contains valid manifest
- Post-apply dry-run shows changes_needed: 0
- No files in gymrats were deleted or modified (additive-only contract)
</success_criteria>

<output>
After completion, create `/Users/tmac/Projects/gsdup/.planning/quick/3-test-gsd-migration-tool-on-gymrats-proje/3-SUMMARY.md`
</output>
