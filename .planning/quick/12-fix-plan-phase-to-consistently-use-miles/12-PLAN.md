---
phase: quick-12
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - /Users/tmac/.claude/get-shit-done/workflows/plan-phase.md
  - /Users/tmac/.claude/agents/gsd-planner.md
  - /Users/tmac/.claude/get-shit-done/templates/planner-subagent-prompt.md
autonomous: true
requirements: [QUICK-12]

must_haves:
  truths:
    - "plan-phase workflow passes phase_dir and planning_root to planner agent prompt"
    - "gsd-planner agent uses phase_dir from planning_context instead of hardcoded .planning/phases/ paths"
    - "plan-phase mkdir fallback uses planning_root from init instead of hardcoded .planning/phases/"
    - "PLAN.md files are written to milestone-scoped directories when concurrent layout is active"
  artifacts:
    - path: "/Users/tmac/.claude/get-shit-done/workflows/plan-phase.md"
      provides: "Orchestrator workflow that passes milestone-scoped paths to planner"
      contains: "planning_root"
    - path: "/Users/tmac/.claude/agents/gsd-planner.md"
      provides: "Planner agent that uses phase_dir from context instead of hardcoded paths"
      contains: "phase_dir"
  key_links:
    - from: "plan-phase.md step 8 (planner prompt)"
      to: "gsd-planner.md execution_flow steps"
      via: "planning_context includes phase_dir and planning_root"
      pattern: "phase_dir|planning_root"
    - from: "gsd-planner.md write_phase_prompt step"
      to: "PLAN.md file on disk"
      via: "Write tool using phase_dir path"
      pattern: "phase_dir.*PLAN\\.md"
---

<objective>
Fix plan-phase workflow and gsd-planner agent to consistently use milestone-scoped directories instead of hardcoded `.planning/phases/` paths.

Purpose: When `concurrent: true` is set, plan-phase currently writes PLAN.md files to root `.planning/phases/` instead of `.planning/milestones/<version>/phases/` because (1) plan-phase.md has a hardcoded mkdir fallback, (2) the planner prompt does not include `phase_dir` or `planning_root`, and (3) gsd-planner.md has hardcoded `.planning/phases/` paths in its execution steps.

Output: Updated plan-phase.md, gsd-planner.md, and planner-subagent-prompt.md that correctly use milestone-scoped paths from init JSON.
</objective>

<execution_context>
@/Users/tmac/.claude/get-shit-done/workflows/execute-plan.md
@/Users/tmac/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add phase_dir and planning_root to planner prompt in plan-phase.md</name>
  <files>/Users/tmac/.claude/get-shit-done/workflows/plan-phase.md</files>
  <action>
Fix FOUR issues in plan-phase.md:

0. **Step 1 parse list (line 21):** Add `planning_root` to the variable parse list. The current list on line 21 includes `phase_dir`, `padded_phase`, etc. but omits `planning_root`. Append `planning_root` to the comma-separated list so the orchestrator extracts it from the init JSON. (Without this, the variable is unavailable for later steps.)

1. **Step 2 mkdir fallback (line 37):** Change the hardcoded directory creation from:
```bash
mkdir -p ".planning/phases/${padded_phase}-${phase_slug}"
```
to use `planning_root` from init JSON:
```bash
mkdir -p "${planning_root}/phases/${padded_phase}-${phase_slug}"
```
where `planning_root` is extracted from the INIT JSON in step 1 (it already returns `planning_root`).

2. **Step 8 planner prompt (lines 282-318):** Add `phase_dir`, `planning_root`, and `padded_phase` to the `<planning_context>` block so the planner agent knows where to write files. Add these lines after the `**Phase:**` line:
```markdown
**Phase directory:** {phase_dir}
**Planning root:** {planning_root}
**Padded phase:** {padded_phase}
```
These values come from the init JSON already parsed in step 1.

3. **Step 12 revision prompt (lines 398-425):** Same issue -- add `phase_dir` and `planning_root` to the revision context `<files_to_read>` block. Change:
```markdown
- {PHASE_DIR}/*-PLAN.md (Existing plans)
```
to use the actual `phase_dir` from init (which is already available as `PHASE_DIR` in the orchestrator context).

4. **Offer-next section (line 549):** Change the hardcoded display path from:
```
- cat .planning/phases/{phase-dir}/*-PLAN.md -- review plans
```
to:
```
- cat {phase_dir}/*-PLAN.md -- review plans
```

All `planning_root` and `phase_dir` values are already returned by `init plan-phase` and parsed in step 1. No new CLI changes needed.
  </action>
  <verify>
Read the modified plan-phase.md and confirm:
- No remaining hardcoded `.planning/phases/` in mkdir commands
- Planner prompt includes phase_dir and planning_root
- Revision prompt includes phase_dir
- Offer-next uses dynamic path
  </verify>
  <done>plan-phase.md has zero hardcoded `.planning/phases/` paths in operational code (template examples with XX-name are acceptable)</done>
</task>

<task type="auto">
  <name>Task 2: Update gsd-planner.md execution steps to use phase_dir from planning_context</name>
  <files>/Users/tmac/.claude/agents/gsd-planner.md, /Users/tmac/.claude/get-shit-done/templates/planner-subagent-prompt.md</files>
  <action>
The gsd-planner agent has hardcoded `.planning/phases/` paths in its execution flow steps. These need to use the `phase_dir` and `planning_root` values that will now be passed in the `<planning_context>` block (from Task 1).

**In gsd-planner.md, update these execution_flow steps:**

1. **load_project_state step (around line 965):** After the init JSON parsing, add a note:
```
Also extract `phase_dir` and `planning_root` from the `<planning_context>` provided by the orchestrator. These are the authoritative paths for where to read/write phase files.
```

2. **load_codebase_context step:** The codebase map path `.planning/codebase/*.md` is correct (always at root). No change needed.

3. **identify_phase step (line 997-999):** Change:
```bash
cat .planning/ROADMAP.md
ls .planning/phases/
```
to:
```bash
cat ${planning_root}/ROADMAP.md    # Use planning_root from planning_context
ls ${phase_dir}/                    # Use phase_dir from planning_context
```
Add a note: "Use `planning_root` from `<planning_context>` for ROADMAP.md path. Use `phase_dir` for phase directory listing."

4. **read_project_history step (line 1033):** Change:
```bash
cat .planning/phases/{selected-phase}/*-SUMMARY.md
```
to:
```bash
cat ${planning_root}/phases/{selected-phase}/*-SUMMARY.md
```

5. **gather_phase_context step:** The `$phase_dir` references here already use a variable (from init). Add clarification that `phase_dir` comes from `<planning_context>` when spawned by plan-phase, or from init JSON when running standalone.

6. **write_phase_prompt step (line 1137):** Change:
```
Write to `.planning/phases/XX-name/{phase}-{NN}-PLAN.md`
```
to:
```
Write to `${phase_dir}/{padded_phase}-{NN}-PLAN.md`

Use `phase_dir` and `padded_phase` from `<planning_context>`. These are the authoritative paths — do NOT construct paths manually from `.planning/phases/`.
```

7. **update_roadmap step (line 1173):** Change:
```
1. Read `.planning/ROADMAP.md`
```
to:
```
1. Read `${planning_root}/ROADMAP.md` (use `planning_root` from `<planning_context>`)
```

8. **git_commit step (line 1196):** Change:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs($PHASE): create phase plan" --files .planning/phases/$PHASE-*/$PHASE-*-PLAN.md .planning/ROADMAP.md
```
to:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs($PHASE): create phase plan" --files ${phase_dir}/${padded_phase}-*-PLAN.md ${planning_root}/ROADMAP.md
```

9. **revision_mode section (lines 875, 923, 942-943):** Update all `.planning/phases/$PHASE-*` references to use `${phase_dir}` and `${planning_root}`.

10. **gap_closure_mode section:** Update any `.planning/phases/` references to use `${phase_dir}` and `${planning_root}`.

11. **plan_format section (line 457):** Change the output template:
```
After completion, create `.planning/phases/XX-name/{phase}-{plan}-SUMMARY.md`
```
to:
```
After completion, create `${phase_dir}/{phase}-{plan}-SUMMARY.md`
```

**In planner-subagent-prompt.md:** Update the template paths from `.planning/phases/{phase_dir}/` to `{phase_dir}/` since `phase_dir` already includes the full relative path (e.g., `.planning/milestones/v3.1/phases/3.1-integration-fixes`). Also add `**Phase directory:** {phase_dir}` and `**Planning root:** {planning_root}` to the template.

IMPORTANT: Only update paths in operational instructions (steps the planner actually executes). Leave example/illustration paths (like the ones in task_breakdown, dependency_graph sections with made-up examples like "src/models/user.ts") unchanged -- those are teaching examples, not executed code.
  </action>
  <verify>
Run: grep -n '\.planning/phases/' /Users/tmac/.claude/agents/gsd-planner.md | grep -v 'example\|Example\|illustration\|src/' to verify no operational hardcoded paths remain.
Also run: grep -c 'phase_dir\|planning_root' /Users/tmac/.claude/agents/gsd-planner.md to verify the dynamic variables are present.
  </verify>
  <done>gsd-planner.md execution steps use phase_dir and planning_root variables instead of hardcoded .planning/phases/ paths. planner-subagent-prompt.md template includes phase_dir and planning_root placeholders.</done>
</task>

<task type="auto">
  <name>Task 3: Verify end-to-end with init plan-phase output</name>
  <files>None (verification only)</files>
  <action>
Run the following verification steps:

1. Confirm `init plan-phase 3.1` still returns correct milestone-scoped paths:
```bash
node get-shit-done/bin/gsd-tools.cjs init plan-phase 3.1 2>&1 | jq '{phase_dir, planning_root, milestone_scope, padded_phase}'
```
Expected: phase_dir contains `.planning/milestones/v3.1/phases/...`, planning_root points to `.planning/milestones/v3.1`, milestone_scope is "v3.1".

2. Grep all three modified files for remaining hardcoded `.planning/phases/` in operational code:
```bash
grep -n '\.planning/phases/' /Users/tmac/.claude/get-shit-done/workflows/plan-phase.md
grep -n '\.planning/phases/' /Users/tmac/.claude/agents/gsd-planner.md
grep -n '\.planning/phases/' /Users/tmac/.claude/get-shit-done/templates/planner-subagent-prompt.md
```
Remaining matches should ONLY be in non-operational contexts (teaching examples, format illustrations).

3. Verify the planner prompt in plan-phase.md step 8 contains phase_dir and planning_root.

4. Run existing tests to verify no regressions:
```bash
cd /Users/tmac/Projects/gsdup && node --test tests/*.test.cjs
```
(Tests validate CLI behavior, not workflow markdown, but ensures no accidental breakage.)
  </action>
  <verify>All grep checks pass showing no operational hardcoded paths. Tests pass. Init returns correct milestone-scoped paths.</verify>
  <done>End-to-end verification confirms plan-phase will use milestone-scoped directories for concurrent layouts.</done>
</task>

</tasks>

<verification>
After all tasks:
1. No hardcoded `.planning/phases/` in plan-phase.md operational code
2. gsd-planner.md execution steps reference phase_dir/planning_root variables
3. Planner prompt includes phase_dir and planning_root from init JSON
4. init plan-phase still returns correct milestone-scoped paths
5. Existing tests pass
</verification>

<success_criteria>
- plan-phase.md mkdir fallback uses planning_root from init
- plan-phase.md planner prompt passes phase_dir and planning_root to planner agent
- gsd-planner.md uses phase_dir/planning_root in all execution steps (write_phase_prompt, git_commit, identify_phase, update_roadmap, revision_mode)
- planner-subagent-prompt.md template includes phase_dir and planning_root
- No regression in existing test suite
</success_criteria>

<output>
After completion, create `.planning/quick/12-fix-plan-phase-to-consistently-use-miles/12-SUMMARY.md`
</output>
