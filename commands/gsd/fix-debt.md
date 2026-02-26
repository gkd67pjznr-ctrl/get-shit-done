---
name: gsd:fix-debt
description: Route a debt entry through diagnosis and fix execution
argument-hint: "[TD-ID or blank for auto-select]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Task
  - AskUserQuestion
---

<objective>
Orchestrate a debt entry through its full fix lifecycle: open -> in-progress -> diagnosed -> fixed -> resolved.

**Orchestrator role:** Select entry (by ID or priority), mark in-progress, spawn gsd-debugger for diagnosis, create an inline fix plan, spawn gsd-executor to apply the fix, verify the result, and mark the entry resolved.

**Why subagent isolation:** Diagnosis burns context fast (reading files, forming hypotheses, testing). Fresh context per investigation keeps the orchestrator lean for decision-making. The executor independently handles quality gates, deviation rules, and commits.
</objective>

<context>
Debt entry to fix: $ARGUMENTS

Check for open debt entries:
```bash
node ~/.claude/get-shit-done/bin/gsd-tools.cjs debt list --status open --raw
```
</context>

<process>

## 0. Initialize Context

```bash
INIT=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs state load)
COMMIT_DOCS=$(echo "$INIT" | jq -r '.commit_docs')
```

Resolve models for subagent spawning:
```bash
DEBUGGER_MODEL=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs resolve-model gsd-debugger --raw)
EXECUTOR_MODEL=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs resolve-model gsd-executor --raw)
```

## 1. Select Debt Entry

```bash
ENTRIES=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs debt list --status open --raw)
TOTAL=$(echo "$ENTRIES" | jq -r '.total')
```

If `$TOTAL` is 0:
- Print: "No open debt entries found. Nothing to fix."
- EXIT

If `$ARGUMENTS` matches `TD-[0-9]+` pattern:
```bash
ENTRY=$(echo "$ENTRIES" | jq -r --arg id "$ARGUMENTS" '.entries[] | select(.id == $id) | @json')
```

If entry not found for the given ID:
- Print: "Debt entry $ARGUMENTS not found or not in open status."
- EXIT

If no argument provided, auto-select by priority (critical > high > medium > low, then oldest first):
```bash
ENTRY=$(echo "$ENTRIES" | jq -r '
  .entries |
  sort_by(
    if .severity == "critical" then 0
    elif .severity == "high" then 1
    elif .severity == "medium" then 2
    else 3 end,
    .date_logged
  ) |
  first |
  @json
')
```

Extract entry fields:
```bash
ENTRY_ID=$(echo "$ENTRY" | jq -r '.id')
ENTRY_SEVERITY=$(echo "$ENTRY" | jq -r '.severity')
ENTRY_TYPE=$(echo "$ENTRY" | jq -r '.type')
ENTRY_COMPONENT=$(echo "$ENTRY" | jq -r '.component')
ENTRY_DESCRIPTION=$(echo "$ENTRY" | jq -r '.description')
ENTRY_SOURCE=$(echo "$ENTRY" | jq -r '.source_phase + "/" + .source_plan')
ENTRY_DATE=$(echo "$ENTRY" | jq -r '.date_logged')
```

Display the selected entry:
```
Selected debt entry:
  ID:          $ENTRY_ID
  Severity:    $ENTRY_SEVERITY
  Type:        $ENTRY_TYPE
  Component:   $ENTRY_COMPONENT
  Description: $ENTRY_DESCRIPTION
  Source:      $ENTRY_SOURCE
  Logged:      $ENTRY_DATE
```

## 2. Confirm and Mark In-Progress

If NOT in yolo/autonomous mode, use AskUserQuestion:

```
AskUserQuestion("Fix debt entry $ENTRY_ID ($ENTRY_SEVERITY severity)?\n\n$ENTRY_DESCRIPTION\n\n[yes / skip / pick-another]")
```

- "skip" -> `debt resolve --id $ENTRY_ID --status deferred`, print "Entry deferred.", EXIT
- "pick-another" -> list all open entries with IDs and descriptions, ask user to type an ID, restart from Step 1 with that ID
- "yes" or yolo mode -> proceed

Mark in-progress **before** spawning any subagent:
```bash
node ~/.claude/get-shit-done/bin/gsd-tools.cjs debt resolve --id "$ENTRY_ID" --status in-progress
```

## 3. Assess Diagnosis Need

Check description richness:
- If `$ENTRY_DESCRIPTION` length > 50 characters AND does not look like generic placeholder text (e.g., not "TBD", "N/A", "unknown"):
  - **Rich description detected.**
  - In non-yolo mode: AskUserQuestion("Entry $ENTRY_ID has a detailed description. Skip diagnosis and proceed directly to fix plan? (yes/no)")
    - "yes" -> skip to Step 5, using entry description as diagnosis context
    - "no" -> proceed to Step 4
  - In yolo mode: skip to Step 5 (use description as diagnosis context)
- If description is sparse (<=50 chars or generic): always proceed to Step 4

## 4. Diagnose via gsd-debugger

Construct debugger prompt:

```markdown
<objective>
Investigate debt entry: $ENTRY_ID
**Summary:** $ENTRY_DESCRIPTION
</objective>

<symptoms>
expected: Code/behavior indicated by: $ENTRY_DESCRIPTION
actual: Known debt issue: $ENTRY_TYPE in $ENTRY_COMPONENT
errors: None (proactive debt, not a crash)
reproduction: Inspect $ENTRY_COMPONENT for $ENTRY_TYPE debt
timeline: Logged $ENTRY_DATE (source: $ENTRY_SOURCE)
</symptoms>

<mode>
symptoms_prefilled: true
goal: find_root_cause_only
</mode>

<debug_file>
Create: .planning/debug/debt-$ENTRY_ID.md
</debug_file>
```

Spawn debugger:
```
Task(
  prompt=filled_prompt,
  subagent_type="gsd-debugger",
  model="$DEBUGGER_MODEL",
  description="Diagnose $ENTRY_ID: $ENTRY_DESCRIPTION"
)
```

Handle debugger return:

**If `## ROOT CAUSE FOUND`:**
- Extract root cause summary from debugger output
- Set `DIAGNOSIS` = root cause text
- Proceed to Step 5

**If `## INVESTIGATION INCONCLUSIVE`:**
- Present findings to user: what was checked, what was eliminated
- AskUserQuestion("Diagnosis inconclusive for $ENTRY_ID. How to proceed?\n\n[attempt-fix-anyway / defer / add-context-and-retry]")
  - "defer" -> `debt resolve --id $ENTRY_ID --status deferred`, EXIT
  - "add-context-and-retry" -> gather additional context from user, spawn debugger again
  - "attempt-fix-anyway" -> set `DIAGNOSIS` = entry description, proceed to Step 5

**If `## CHECKPOINT REACHED`:**
- Present checkpoint details to user
- Gather user response
- Spawn continuation:
  ```
  Task(
    prompt="Continue debugging $ENTRY_ID. Evidence is in .planning/debug/debt-$ENTRY_ID.md. Goal: find_root_cause_only.",
    subagent_type="gsd-debugger",
    model="$DEBUGGER_MODEL",
    description="Continue diagnosis $ENTRY_ID"
  )
  ```

**If diagnosis fails unexpectedly:**
- Transition back to open: `debt resolve --id $ENTRY_ID --status open`
- Print error and EXIT

## 5. Plan Fix (Inline Mini-Plan)

Create fix plan directory:
```bash
mkdir -p .planning/debug/debt-$ENTRY_ID-fix/
```

Scope guard: `files_modified` MUST be limited to the entry's `$ENTRY_COMPONENT`. If `$DIAGNOSIS` reveals broader scope (more than 3-4 files), present this to the user before proceeding:
- AskUserQuestion("Diagnosis reveals fix requires changes beyond $ENTRY_COMPONENT. Proceed with broader scope? (yes/defer)")
  - "defer" -> `debt resolve --id $ENTRY_ID --status deferred`, EXIT
  - "yes" -> proceed with expanded scope

Write inline fix plan to `.planning/debug/debt-$ENTRY_ID-fix/01-PLAN.md`:

```markdown
---
phase: debt-fix-$ENTRY_ID
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - $ENTRY_COMPONENT
autonomous: true
---

<objective>
Fix debt entry $ENTRY_ID: $ENTRY_DESCRIPTION

Root cause: $DIAGNOSIS
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<tasks>
<task id="1" type="auto">
  <title>Apply fix: $ENTRY_DESCRIPTION</title>
  <action>
  [Specific fix instructions derived from diagnosis:
  - Component: $ENTRY_COMPONENT
  - Issue type: $ENTRY_TYPE
  - Root cause: $DIAGNOSIS
  - Apply the targeted fix to eliminate the debt issue]
  </action>
  <done>
  - The specific debt issue no longer exists in $ENTRY_COMPONENT
  - Verification command confirms fix is applied
  </done>
</task>
</tasks>

<verification>
Inspect $ENTRY_COMPONENT to confirm the $ENTRY_TYPE debt is resolved.
Run any relevant tests: node --test tests/*.test.cjs 2>&1 | tail -5
</verification>

<success_criteria>
- Debt issue $ENTRY_ID no longer present in $ENTRY_COMPONENT
- No regressions in existing tests
</success_criteria>
```

**Note:** The orchestrator must write concrete, specific instructions into the `<action>` block derived from the diagnosis — not placeholder text. The executor will implement exactly what the plan says.

**If plan creation fails:**
- Transition to deferred: `debt resolve --id $ENTRY_ID --status deferred`
- Print reason and EXIT

## 6. Execute Fix via gsd-executor

Spawn executor directly on the plan file (bypasses ROADMAP phase lookup):
```
Task(
  prompt="Execute plan at .planning/debug/debt-$ENTRY_ID-fix/01-PLAN.md. Autonomous. All tasks + SUMMARY + commit.",
  subagent_type="gsd-executor",
  model="$EXECUTOR_MODEL",
  description="Fix $ENTRY_ID"
)
```

Handle executor return:

**Success (executor reports all tasks complete):**
- Proceed to Step 7

**Failure or partial (executor reports issues):**
- Present executor output to user
- AskUserQuestion("Executor encountered issues fixing $ENTRY_ID. How to proceed?\n\n[retry / defer]")
  - "retry" -> inspect executor SUMMARY, adjust plan if needed, spawn executor again
  - "defer" -> `debt resolve --id $ENTRY_ID --status deferred`, EXIT

## 7. Verify Fix

Read executor SUMMARY from `.planning/debug/debt-$ENTRY_ID-fix/`:
```bash
ls .planning/debug/debt-$ENTRY_ID-fix/*SUMMARY.md 2>/dev/null
```

If executor SUMMARY reports all tasks done and no blocking issues:
- Proceed to Step 8

If executor SUMMARY reports issues or incomplete tasks:
- Present to user: what succeeded, what failed
- AskUserQuestion("Fix for $ENTRY_ID is incomplete. How to proceed?\n\n[retry / defer]")
  - "retry" -> spawn executor again on the same plan
  - "defer" -> `debt resolve --id $ENTRY_ID --status deferred`, EXIT

In yolo mode: if executor return indicates success (## PLAN COMPLETE), proceed directly to Step 8.

## 8. Mark Resolved

Transition to resolved:
```bash
node ~/.claude/get-shit-done/bin/gsd-tools.cjs debt resolve --id "$ENTRY_ID" --status resolved
```

Print success:
```
Debt entry $ENTRY_ID resolved.
  Fixed: $ENTRY_DESCRIPTION
  Component: $ENTRY_COMPONENT
```

Suggest next steps:
```
Next: Run /gsd:fix-debt again to fix the next entry, or /gsd:progress to check milestone status.
```

</process>

<error_handling>

If any step fails unexpectedly, transition the entry away from `in-progress`. NEVER leave an entry stuck in `in-progress`:

| Failure point | Transition | Reason |
|---|---|---|
| Step 4 — diagnosis fails | back to `open` | Nothing was attempted; entry can be retried |
| Step 5 — plan creation fails | to `deferred` | Orchestrator couldn't produce a plan; log reason |
| Step 6 — execution fails | to `deferred` | Something was attempted; may have partial changes |
| Step 7 — verification fails | to `deferred` | Execution may be incomplete |

Error recovery commands:
```bash
# Back to open (diagnosis failed, nothing touched):
node ~/.claude/get-shit-done/bin/gsd-tools.cjs debt resolve --id "$ENTRY_ID" --status open

# Defer (something was attempted but couldn't complete):
node ~/.claude/get-shit-done/bin/gsd-tools.cjs debt resolve --id "$ENTRY_ID" --status deferred
```

</error_handling>

<success_criteria>
- [ ] Debt entry selected (by ID or auto-priority)
- [ ] Entry transitioned to in-progress before work starts
- [ ] Diagnosis completed (or skipped for rich entries in yolo mode)
- [ ] Inline fix plan created with scoped files_modified
- [ ] Executor spawned and fix applied
- [ ] Entry marked resolved (or deferred if fix failed)
- [ ] No entry left stuck in in-progress
</success_criteria>
