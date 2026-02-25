# Phase 14: Integration Wiring Fix - Research

**Researched:** 2026-02-24
**Domain:** Cross-phase integration wiring — workflow bash variables, init command return shapes, conflict manifest lifecycle
**Confidence:** HIGH

## Summary

Phase 14 fixes two cross-phase integration gaps and one broken E2E flow found by the v2.0 milestone audit. All three issues are wiring problems — the code that was meant to be connected exists, but the connections were missed. No new functionality needs to be designed; the audit has already diagnosed each gap precisely.

**INTEGRATION-1 (High):** Both `execute-phase.md` and `plan-phase.md` call `milestone write-status "${milestone_version}"` where `${milestone_version}` is a bash variable that is never extracted from the INIT JSON. The MILESTONE_FLAG block (added in Phase 12-02) extracts `LAYOUT` and `MILESTONE_SCOPE` from init but does not extract `milestone_version`. `cmdInitExecutePhase` already returns `milestone_version` in its response shape; `cmdInitPlanPhase` does not. The simplest consistent fix is to extract `MILESTONE_VERSION` from `$MILESTONE_SCOPE` (already extracted) in both workflows — or add `milestone_version: milestoneScope || null` to `cmdInitPlanPhase` and extract it in both MILESTONE_FLAG blocks.

**INTEGRATION-2 (Low):** `cmdMilestoneUpdateManifest` is implemented in `milestone.cjs` and CLI-routed in `gsd-tools.cjs`, but no workflow file calls it. The `conflict.json` `files_touched` arrays therefore always stay empty, making conflict detection useless in practice.

**STATUS.md flow gap:** Is caused entirely by INTEGRATION-1 — once `${milestone_version}` is defined in both workflow bash environments, all three write-status checkpoints (plan-start in `plan-phase.md`, plan-complete in `execute-phase.md`, phase-complete in `execute-phase.md`) will function correctly.

**Primary recommendation:** Fix INTEGRATION-1 by adding `MILESTONE_VERSION=$(echo "$INIT" | jq -r '.milestone_scope // empty')` to the MILESTONE_FLAG blocks in both `execute-phase.md` and `plan-phase.md`, then rename all `${milestone_version}` references in those workflows to `${MILESTONE_VERSION}`. Fix INTEGRATION-2 by adding an `update-manifest` call in `execute-phase.md` after each plan wave, using the plan's `files_modified` frontmatter field.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | Each milestone writes STATUS.md in its workspace folder at natural checkpoints | STATUS.md checkpoint flow is broken because `${milestone_version}` bash variable is never assigned. Fix is in execute-phase.md and plan-phase.md MILESTONE_FLAG bash blocks. |
| DASH-02 | `/gsd:progress` reads all active milestone STATUS.md files and renders multi-milestone summary table | This works correctly. cmdProgressRenderMulti and the progress workflow are properly wired. The gap is only in STATUS.md *writing*, not reading. |
| DASH-03 | MILESTONES.md repurposed as live dashboard with structured per-milestone sections | `cmdMilestoneWriteStatus` already updates MILESTONES.md as a side effect (line 343-366 of milestone.cjs). The gap is that write-status is never called due to undefined variable. |
| CNFL-01 | Each milestone workspace contains conflict.json declaring files_touched | `conflict.json` is created by `cmdMilestoneNewWorkspace` with `files_touched: []`. It stays empty because `cmdMilestoneUpdateManifest` is never called. Fix: call `update-manifest` in `execute-phase.md`. |
| CNFL-02 | `manifest-check` command reads all active milestone conflict.json files and reports overlapping file paths | `cmdManifestCheck` is correctly implemented and routed. The gap is that `files_touched` arrays are always empty. |
</phase_requirements>

## Standard Stack

### Core

| Component | Location | Purpose | Status |
|-----------|----------|---------|--------|
| `execute-phase.md` | `get-shit-done/workflows/execute-phase.md` | Orchestrates plan execution waves, calls write-status at plan-complete and phase-complete checkpoints | Bug: `${milestone_version}` undefined |
| `plan-phase.md` | `get-shit-done/workflows/plan-phase.md` | Orchestrates research/planning/checking, calls write-status at plan-start checkpoint | Bug: `${milestone_version}` undefined |
| `cmdInitExecutePhase` | `get-shit-done/bin/lib/init.cjs:10` | Already returns `milestone_version: milestone.version` and `milestone_scope: milestoneScope || null` | Correct — but `milestone_version` reads from global PROJECT.md, not milestoneScope |
| `cmdInitPlanPhase` | `get-shit-done/bin/lib/init.cjs:90` | Returns `milestone_scope: milestoneScope || null` but does NOT return `milestone_version` | Missing field |
| `cmdMilestoneUpdateManifest` | `get-shit-done/bin/lib/milestone.cjs:298` | Merges new file paths into `conflict.json` `files_touched` array | Implemented, CLI-routed, never called by any workflow |
| `cmdMilestoneWriteStatus` | `get-shit-done/bin/lib/milestone.cjs:319` | Writes STATUS.md + side-updates MILESTONES.md | Correct — only fails because version arg is empty string |

### Supporting

| Component | Location | Purpose | When Relevant |
|-----------|----------|---------|---------------|
| `MILESTONE_FLAG` block | Both workflow files, initialize step | Extracts `LAYOUT` + `MILESTONE_SCOPE` from INIT JSON to build conditional `--milestone` flag | Already present — needs one additional line to extract `MILESTONE_VERSION` |
| `phase-plan-index` | `gsd-tools.cjs` | Returns plan frontmatter including `files_modified` | INTEGRATION-2 fix source for `files_touched` values |
| `conflict.json` | `.planning/milestones/<version>/conflict.json` | Stores `files_touched` array for manifest-check | Created with empty array; never populated |

## Architecture Patterns

### Pattern 1: MILESTONE_FLAG Block (Existing)

**What:** The Phase 12-02 MILESTONE_FLAG block extracts milestone routing context from INIT JSON and builds a conditional `--milestone <version>` string. It is present in all 7 workflow files.

**Current form in execute-phase.md and plan-phase.md:**
```bash
# Milestone routing (v2.0)
MILESTONE_FLAG=""
LAYOUT=$(echo "$INIT" | jq -r '.layout_style // "legacy"')
MILESTONE_SCOPE=$(echo "$INIT" | jq -r '.milestone_scope // empty')
if [ "$LAYOUT" = "milestone-scoped" ] && [ -n "$MILESTONE_SCOPE" ]; then
  MILESTONE_FLAG="--milestone ${MILESTONE_SCOPE}"
fi
```

**Fixed form (add one line):**
```bash
# Milestone routing (v2.0)
MILESTONE_FLAG=""
LAYOUT=$(echo "$INIT" | jq -r '.layout_style // "legacy"')
MILESTONE_SCOPE=$(echo "$INIT" | jq -r '.milestone_scope // empty')
MILESTONE_VERSION=$(echo "$INIT" | jq -r '.milestone_scope // empty')
if [ "$LAYOUT" = "milestone-scoped" ] && [ -n "$MILESTONE_SCOPE" ]; then
  MILESTONE_FLAG="--milestone ${MILESTONE_SCOPE}"
fi
```

Then replace all `${milestone_version}` occurrences in both files with `${MILESTONE_VERSION}`.

**Why `milestone_scope` not `milestone_version`:** `milestone_scope` is the passed-through `--milestone` flag value (e.g., `v2.0`). `cmdInitExecutePhase` does return `milestone_version` but it comes from `getMilestoneInfo(cwd)` which reads the global project config — not the milestoneScope workspace. Using `milestone_scope` is the correct source: it's exactly what was passed via `--milestone`, which is what `write-status` needs as its version argument. `cmdInitPlanPhase` does not return `milestone_version` at all, so using `milestone_scope` works consistently for both workflows.

### Pattern 2: Manifest Update in Execute-Phase Wave Loop (New)

**What:** After each plan wave completes, extract `files_modified` from the plan frontmatter and call `milestone update-manifest` to populate `conflict.json`.

**Where to insert:** In `execute-phase.md`, inside the `execute_waves` step, after spot-check passes (step 4), before the 4a STATUS.md checkpoint.

**Form:**
```bash
# INTEGRATION-2: Populate conflict manifest with files touched this wave
if [ "$LAYOUT" = "milestone-scoped" ] && [ -n "$MILESTONE_SCOPE" ]; then
  # Collect files_modified from completed plans in this wave
  WAVE_FILES=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs phase-plan-index "${PHASE_NUMBER}" \
    | jq -r '.plans[] | select(.wave == '"${WAVE_NUM}"') | .files_modified[]?' 2>/dev/null | sort -u)
  if [ -n "$WAVE_FILES" ]; then
    node ~/.claude/get-shit-done/bin/gsd-tools.cjs milestone update-manifest "${MILESTONE_VERSION}" \
      --files ${WAVE_FILES} --raw
  fi
fi
```

**Alternative approach (simpler):** The audit suggests documenting it as "executor-agent responsibility." However, the wave loop in `execute-phase.md` already has the plan context and milestone context in scope, making it the natural call site. The executor subagent does not have milestone context and should not be responsible for manifest updates.

**`update-manifest` CLI signature (from gsd-tools.cjs:494-497):**
```bash
node gsd-tools.cjs milestone update-manifest <version> --files <file1> <file2> ...
```
The `--files` flag consumes all following non-flag args as file paths.

### Anti-Patterns to Avoid

- **Do not rename `MILESTONE_SCOPE` to `MILESTONE_VERSION` everywhere** — they are semantically distinct in the codebase even if the value is identical. `MILESTONE_SCOPE` controls `--milestone` flag routing; `MILESTONE_VERSION` is the version argument to write-status. Using separate names preserves intent.
- **Do not add `milestone_version` extraction to the global INIT parse list in the workflow text without also extracting it in bash** — the "Parse JSON for:" doc comment in the workflow is informational, the actual extraction is in the bash block.
- **Do not add `update-manifest` to execute-plan.md (executor subagent workflow)** — executor subagents do not have milestone context; the orchestrate-and-call pattern belongs in `execute-phase.md` at wave completion.
- **Do not call `update-manifest` with an empty `--files` list** — `cmdMilestoneUpdateManifest` merges deduplicated arrays correctly, but calling with an empty list is a no-op noise. Guard with `if [ -n "$WAVE_FILES" ]`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Extracting milestone version from bash env | String parsing of $ARGUMENTS | `jq -r '.milestone_scope // empty'` on the INIT JSON | INIT JSON already contains the value; bash string parsing is fragile |
| Collecting files_modified across plans | Custom file scanning | `gsd-tools.cjs phase-plan-index` + `jq` to extract `files_modified[]` | plan-index already parses plan frontmatter correctly |
| Deduplicating files before update-manifest | Sort+uniq in bash | Call `update-manifest` directly — `cmdMilestoneUpdateManifest` deduplicates with `[...new Set(...)]` | Server-side deduplication is already correct (milestone.cjs:312) |

## Common Pitfalls

### Pitfall 1: Using `milestone_version` Field from `cmdInitExecutePhase` Directly

**What goes wrong:** `cmdInitExecutePhase` does return `milestone_version: milestone.version` (init.cjs:66), but `milestone.version` comes from `getMilestoneInfo(cwd)` which reads from the global project config. In a milestone-scoped project, the global version may differ from the active `milestoneScope`. Using `.milestone_version` from the JSON would extract the wrong version in concurrent milestone scenarios.

**Why it happens:** Naming coincidence — the field name matches what we want, but the source does not.

**How to avoid:** Extract `MILESTONE_VERSION` from `.milestone_scope`, not `.milestone_version`. `milestone_scope` is the `--milestone` flag value passed by the user, which is exactly the workspace version.

**Warning signs:** If write-status calls use `milestone_version` and it ever differs from the `--milestone` argument in tests, this pitfall was hit.

### Pitfall 2: Double-Extracting Variables in Bash

**What goes wrong:** Adding `MILESTONE_VERSION=$(echo "$INIT" | jq ...)` as a separate jq invocation when `$MILESTONE_SCOPE` is already set to the same value wastes a subshell but is otherwise harmless. The risk is inconsistency: if the block reads `MILESTONE_VERSION` from a different field than `MILESTONE_SCOPE`, the two variables may diverge.

**How to avoid:** After `MILESTONE_SCOPE` is set, assign `MILESTONE_VERSION="$MILESTONE_SCOPE"` — no second jq call needed. Or assign both from the same jq call. Either pattern is correct.

**Simplest correct form:**
```bash
LAYOUT=$(echo "$INIT" | jq -r '.layout_style // "legacy"')
MILESTONE_SCOPE=$(echo "$INIT" | jq -r '.milestone_scope // empty')
MILESTONE_VERSION="$MILESTONE_SCOPE"   # alias — same value, semantic distinction
if [ "$LAYOUT" = "milestone-scoped" ] && [ -n "$MILESTONE_SCOPE" ]; then
  MILESTONE_FLAG="--milestone ${MILESTONE_SCOPE}"
fi
```

### Pitfall 3: Phase-Plan-Index Wave Number Matching

**What goes wrong:** The `phase-plan-index` command returns plans with a `wave` field. If the wave numbering in the index does not match the orchestrator's wave iteration variable, the jq filter `select(.wave == ${WAVE_NUM})` will not match any plans, and `files_modified` will be empty.

**Why it happens:** Wave numbers in plan frontmatter are `1`, `2`, etc. (integers). The jq comparison must use numeric comparison, not string comparison.

**How to avoid:** Use `jq -r '.plans[] | select(.wave == '"${WAVE_NUM}"')'` — the numeric injection into the jq expression. Or collect `files_modified` from ALL plans in the phase (not wave-scoped) after each wave, since `update-manifest` is idempotent via deduplication.

**Simpler alternative:** Collect ALL `files_modified` from all plans at once after the first wave and call `update-manifest` once — `cmdMilestoneUpdateManifest` handles duplicates, so calling it multiple times with overlapping files is safe.

### Pitfall 4: Missing `cmdInitPlanPhase` Field (No Code Change Needed)

**What goes wrong:** The audit fix suggestion mentions "Add `milestone_version: milestoneScope || null` to result objects in `cmdInitExecutePhase` and `cmdInitPlanPhase`." `cmdInitExecutePhase` already has `milestone_version` (but as a different source — see Pitfall 1). `cmdInitPlanPhase` does NOT have it.

**Conclusion:** The workflow fix (using `MILESTONE_SCOPE`) requires NO changes to init.cjs. The init.cjs path is a valid alternative but requires adding a field to `cmdInitPlanPhase` AND correcting the extraction source in both workflows. The workflow-only fix is simpler and lower risk.

## Code Examples

### Fix 1: MILESTONE_FLAG Block Update (Both Workflow Files)

Apply this pattern to the MILESTONE_FLAG block in `execute-phase.md` (initialize step) and `plan-phase.md` (step 1. Initialize):

```bash
# Milestone routing (v2.0)
MILESTONE_FLAG=""
LAYOUT=$(echo "$INIT" | jq -r '.layout_style // "legacy"')
MILESTONE_SCOPE=$(echo "$INIT" | jq -r '.milestone_scope // empty')
MILESTONE_VERSION="$MILESTONE_SCOPE"
if [ "$LAYOUT" = "milestone-scoped" ] && [ -n "$MILESTONE_SCOPE" ]; then
  MILESTONE_FLAG="--milestone ${MILESTONE_SCOPE}"
fi
```

Then the existing write-status calls work as-is:
```bash
node ~/.claude/get-shit-done/bin/gsd-tools.cjs milestone write-status "${MILESTONE_VERSION}" \
  --phase "${PHASE_NUMBER}" --plan "${PLAN_ID}" \
  --checkpoint plan-complete \
  --progress "${COMPLETED}/${TOTAL} plans (${PCT}%)" \
  --status "In Progress" --raw
```

### Fix 2: Manifest Update Call in execute-phase.md

Add after wave completion spot-checks pass (step 4), before the 4a STATUS.md checkpoint:

```bash
# Populate conflict manifest with files touched (CNFL-01, CNFL-02)
if [ "$LAYOUT" = "milestone-scoped" ] && [ -n "$MILESTONE_VERSION" ]; then
  PHASE_FILES=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs phase-plan-index "${PHASE_NUMBER}" \
    | jq -r '.plans[].files_modified[]?' 2>/dev/null | sort -u | tr '\n' ' ')
  if [ -n "$PHASE_FILES" ]; then
    node ~/.claude/get-shit-done/bin/gsd-tools.cjs milestone update-manifest "${MILESTONE_VERSION}" \
      --files ${PHASE_FILES} --raw
  fi
fi
```

Note: Collecting all plans' `files_modified` (not wave-scoped) is intentional — `update-manifest` deduplicates, and this avoids wave numbering alignment issues.

### Verification: write-status CLI Call (Reference)

Existing correct call signature (from `gsd-tools.cjs:498-512`):
```bash
node gsd-tools.cjs milestone write-status <version> \
  --phase <phase> --plan <plan> \
  --checkpoint <checkpoint> \
  --progress "<string>" \
  --status "<string>" --raw
```

### Verification: update-manifest CLI Call (Reference)

From `gsd-tools.cjs:494-497` and `milestone.cjs:298-317`:
```bash
node gsd-tools.cjs milestone update-manifest <version> --files <file1> <file2> ...
# Returns: { version, files_touched: [...], added: N }
```

## State of the Art

| Old State | Current State | Impact |
|-----------|---------------|--------|
| No STATUS.md writes (Phase 11 implemented, Phase 12-02 wired workflows) | STATUS.md calls are in workflow text but silently fail (empty version arg) | Write-status succeeds when `${milestone_version}` is defined; cmd itself is correct |
| No conflict manifest population (Phase 9 created conflict.json, Phase 11 implemented cmdMilestoneUpdateManifest) | `update-manifest` is CLI-reachable but never called | Manifest-check always reports zero conflicts regardless of actual overlap |

## Open Questions

1. **Where exactly in the execute-phase.md wave loop to insert the manifest update call**
   - What we know: The wave loop is in the `execute_waves` step. Spot-checks happen in step 4. STATUS.md write happens in step 4a.
   - What's unclear: Whether to insert before or after step 4a. The audit says "when processing plan files_modified frontmatter" — this implies per-wave.
   - Recommendation: Insert after spot-checks pass (step 4 verification) and before the 4a STATUS checkpoint. This ensures manifest only gets updated for actually-completed plans. Place the manifest call as a new "4b" step between spot-check and 4a.

2. **Whether to keep `MILESTONE_VERSION` as alias or separate jq extraction**
   - What we know: `MILESTONE_SCOPE` and `milestone_scope` in init JSON carry the same value (`milestoneScope || null` from the router)
   - What's unclear: Whether future changes might diverge them
   - Recommendation: Use `MILESTONE_VERSION="$MILESTONE_SCOPE"` — single-source, no extra jq call, semantically named for the write-status context.

3. **Whether `cmdInitPlanPhase` also needs `milestone_version` added (init.cjs change)**
   - What we know: The workflow-only fix (using `MILESTONE_SCOPE`) requires no init.cjs changes
   - What's unclear: Whether the planner has future uses for a `milestone_version` field distinct from `milestone_scope`
   - Recommendation: Skip the init.cjs change for now — the workflow fix is sufficient and lower risk. The audit's alternative fix ("use `${MILESTONE_SCOPE}` in workflows instead") is exactly what this plan implements.

## Validation Architecture

`workflow.nyquist_validation` is not set in `.planning/config.json` — this section is skipped per agent instructions.

## Files to Modify

This is a pure wiring fix across two workflow files with no library changes:

| File | Change Type | What Changes |
|------|------------|--------------|
| `get-shit-done/workflows/execute-phase.md` | Edit | Add `MILESTONE_VERSION="$MILESTONE_SCOPE"` to MILESTONE_FLAG block; add manifest update call after wave spot-checks |
| `get-shit-done/workflows/plan-phase.md` | Edit | Add `MILESTONE_VERSION="$MILESTONE_SCOPE"` to MILESTONE_FLAG block |

No changes to:
- `get-shit-done/bin/lib/init.cjs` — not needed (workflow-only fix chosen)
- `get-shit-done/bin/lib/milestone.cjs` — already correct
- `get-shit-done/bin/gsd-tools.cjs` — already correctly routes update-manifest
- Any test files — Phase 13 covers test coverage

## Sources

### Primary (HIGH confidence)

- Direct source inspection: `get-shit-done/bin/lib/init.cjs` — verified `cmdInitExecutePhase` returns `milestone_version` (line 66) and `milestone_scope` (line 80); `cmdInitPlanPhase` returns `milestone_scope` (line 142) but NOT `milestone_version`
- Direct source inspection: `get-shit-done/workflows/execute-phase.md` — verified MILESTONE_FLAG block (lines 31-38) extracts only `LAYOUT` and `MILESTONE_SCOPE`; write-status calls reference `${milestone_version}` (lines 170, 407) which is never assigned
- Direct source inspection: `get-shit-done/workflows/plan-phase.md` — verified same pattern (lines 29-35, 349)
- Direct source inspection: `get-shit-done/bin/lib/milestone.cjs:298-317` — `cmdMilestoneUpdateManifest` fully implemented; `get-shit-done/bin/gsd-tools.cjs:494-497` — CLI routing fully implemented; no workflow caller found in any `.md` file
- `.planning/v2.0-MILESTONE-AUDIT.md` — authoritative audit diagnoses, fix prescriptions, and affected requirement mapping

### Secondary (MEDIUM confidence)

- `.planning/phases/12-full-routing-update/12-02-SUMMARY.md` — confirms Phase 12-02 added MILESTONE_FLAG blocks to all 7 workflow files; the miss of `MILESTONE_VERSION` extraction was not flagged

## Metadata

**Confidence breakdown:**
- Gap diagnosis: HIGH — source code directly confirmed both integration gaps
- Fix approach (INTEGRATION-1): HIGH — using `MILESTONE_SCOPE` alias is consistent with existing pattern and requires no new code
- Fix approach (INTEGRATION-2): HIGH — `update-manifest` CLI signature verified; call site identified in execute-phase.md wave loop
- Side effects: HIGH — `cmdMilestoneUpdateManifest` is idempotent (deduplicates); `cmdMilestoneWriteStatus` is overwrite (always last-write-wins); both safe to call multiple times

**Research date:** 2026-02-24
**Valid until:** Stable — wiring fixes do not depend on fast-moving dependencies
