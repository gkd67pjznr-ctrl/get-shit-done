---
phase: quick-10
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/bin/lib/init.cjs
  - get-shit-done/bin/lib/core.cjs
  - tests/init.test.cjs
autonomous: true
requirements: [BUG-INIT-CROSSMS-01]

must_haves:
  truths:
    - "Running `init phase-op <phase>` without --milestone finds phases in ANY milestone, not just the active one"
    - "Running `init execute-phase <phase>` without --milestone finds phases across milestones"
    - "Running `init plan-phase <phase>` without --milestone finds phases across milestones"
    - "Running `init verify-work <phase>` without --milestone finds phases across milestones"
    - "effectiveScope is derived from the milestone where the phase was FOUND, not from the auto-resolved active milestone"
    - "getRoadmapPhaseInternal cross-searches milestones when milestoneScope is null and layout is milestone-scoped"
  artifacts:
    - path: "get-shit-done/bin/lib/init.cjs"
      provides: "Cross-milestone retry logic in all init phase commands"
      contains: "findPhaseInternal(cwd, phase, null)"
    - path: "get-shit-done/bin/lib/core.cjs"
      provides: "Cross-milestone ROADMAP search when scope is null"
      contains: "getRoadmapPhaseInternal"
    - path: "tests/init.test.cjs"
      provides: "Integration tests for cross-milestone phase lookup"
      contains: "cross-milestone"
  key_links:
    - from: "init.cjs:cmdInitPhaseOp"
      to: "core.cjs:findPhaseInternal"
      via: "cross-milestone retry with null scope"
      pattern: "findPhaseInternal\\(cwd, phase, null\\)"
    - from: "init.cjs:autoCreatePhaseFromRoadmap"
      to: "core.cjs:getRoadmapPhaseInternal"
      via: "cross-milestone retry with null scope"
      pattern: "autoCreatePhaseFromRoadmap.*null"
    - from: "core.cjs:getRoadmapPhaseInternal"
      to: "milestone ROADMAP files"
      via: "cross-search when milestoneScope is null"
      pattern: "!milestoneScope.*milestone-scoped"
---

<objective>
Fix all CLI init phase commands (phase-op, execute-phase, plan-phase, verify-work) to auto-resolve milestone scope by searching across ALL milestones when a phase is not found in the active milestone. Currently, the CLI router auto-resolves `milestoneScope` to the active milestone (e.g., "v3.1"), which restricts `findPhaseInternal` to that single milestone. Phases in other milestones (e.g., v3.0's phase 95) fail to be found.

Purpose: Users should not need --milestone flag when referencing phases from non-active milestones.
Output: Fixed init.cjs and core.cjs with cross-milestone retry logic, plus integration tests.
</objective>

<execution_context>
@/Users/tmac/.claude/get-shit-done/workflows/execute-plan.md
@/Users/tmac/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@get-shit-done/bin/lib/init.cjs
@get-shit-done/bin/lib/core.cjs
@tests/init.test.cjs
@tests/helpers.cjs
</context>

<interfaces>
<!-- Key functions the executor needs to understand -->

From core.cjs:
```javascript
function findPhaseInternal(cwd, phase, milestoneScope)
// When milestoneScope is provided: searches ONLY that milestone's phases dir (line 252-257)
// When milestoneScope is null AND layout is milestone-scoped: searches ALL milestones (line 260-282)
// Returns: { found, directory, phase_number, phase_name, ..., milestone_scope? }

function getRoadmapPhaseInternal(cwd, phaseNum, milestoneScope)
// When milestoneScope is set: tries that milestone's ROADMAP, then cross-searches others (line 393-414)
// When milestoneScope is null: tries root ROADMAP only — DOES NOT cross-search milestones (BUG)
// Returns: { found, phase_number, phase_name, goal, section, milestone_scope? }

function detectLayoutStyle(cwd)
// Returns: 'milestone-scoped' | 'legacy' | 'uninitialized'
```

From init.cjs:
```javascript
function autoCreatePhaseFromRoadmap(cwd, phase, milestoneScope)
// When milestoneScope is set: only searches that milestone's ROADMAP (line 17)
// When milestoneScope is null AND layout is milestone-scoped: searches ALL milestones (line 20-28)
// BUT: called with milestoneScope already set from CLI router, so cross-search never triggers
```

From gsd-tools.cjs (CLI router, line 205-208):
```javascript
// Auto-detect milestone scope when not explicitly provided
if (!milestoneScope && detectLayoutStyle(cwd) === 'milestone-scoped') {
  milestoneScope = resolveActiveMilestone(cwd);
}
// Result: milestoneScope is ALWAYS set in milestone-scoped layout, even without --milestone flag
```
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add cross-milestone retry to init commands and fix getRoadmapPhaseInternal</name>
  <files>get-shit-done/bin/lib/init.cjs, get-shit-done/bin/lib/core.cjs</files>
  <behavior>
    - When milestoneScope is set and findPhaseInternal returns null, retry with null scope to trigger cross-milestone search
    - effectiveScope should prefer detected milestone (phaseInfo.milestone_scope) over the auto-resolved milestoneScope
    - getRoadmapPhaseInternal should cross-search milestones when milestoneScope is null and layout is milestone-scoped
    - autoCreatePhaseFromRoadmap called with milestoneScope should retry with null scope if phase not found
  </behavior>
  <action>
    **In init.cjs — Add cross-milestone retry to 4 functions:**

    1. `cmdInitPhaseOp` (line 466): After `findPhaseInternal(cwd, phase, milestoneScope)` returns null, add:
       ```javascript
       // Cross-milestone retry: if phase not found in active milestone, search all milestones
       if (!phaseInfo && milestoneScope) {
         phaseInfo = findPhaseInternal(cwd, phase, null);
       }
       ```
       Then fix effectiveScope priority (line 469) to prefer detected scope:
       ```javascript
       const effectiveScope = phaseInfo?.milestone_scope || milestoneScope || null;
       ```
       Also apply the same cross-milestone retry to the ROADMAP fallback block (line 473-474):
       When `getRoadmapPhaseInternal(cwd, phase, effectiveScope)` returns null, retry:
       ```javascript
       if (!roadmapPhase?.found && effectiveScope) {
         roadmapPhase = getRoadmapPhaseInternal(cwd, phase, null);
       }
       ```

    2. `cmdInitExecutePhase` (line 61): After `findPhaseInternal(cwd, phase, milestoneScope)` returns null, add same retry:
       ```javascript
       if (!phaseInfo && milestoneScope) {
         phaseInfo = findPhaseInternal(cwd, phase, null);
       }
       ```
       Fix effectiveScope (line 69) to: `phaseInfo?.milestone_scope || milestoneScope || null`

    3. `cmdInitPlanPhase` (line 150): Same pattern — retry with null, fix effectiveScope (line 158).

    4. `cmdInitVerifyWork` (line 431): Same pattern — retry with null, fix effectiveScope (line 434).

    **In core.cjs — Fix getRoadmapPhaseInternal (line 353):**

    After the primary roadmap check (line 385-391), add a cross-milestone block for when `!milestoneScope`:
    ```javascript
    // Cross-milestone search: if no milestoneScope and layout is milestone-scoped,
    // search all milestone ROADMAPs (mirrors the existing milestoneScope cross-search above)
    if (!milestoneScope && detectLayoutStyle(cwd) === 'milestone-scoped') {
      const milestonesDir = path.join(cwd, '.planning', 'milestones');
      try {
        const msDirs = fs.readdirSync(milestonesDir, { withFileTypes: true })
          .filter(e => e.isDirectory())
          .map(e => e.name)
          .sort()
          .reverse();
        for (const ms of msDirs) {
          const msRoadmapPath = path.join(milestonesDir, ms, 'ROADMAP.md');
          if (!fs.existsSync(msRoadmapPath)) continue;
          try {
            const msContent = fs.readFileSync(msRoadmapPath, 'utf-8');
            const result = parseFromContent(msContent, ms);
            if (result) return result;
          } catch {}
        }
      } catch {}
    }
    ```
    Place this BEFORE the existing `milestoneScope` cross-search block (line 393), so both code paths (null and non-null milestoneScope) get cross-milestone search.

    **In init.cjs — Fix autoCreatePhaseFromRoadmap (line 14):**

    The existing code already handles null milestoneScope correctly (lines 20-28 search all milestones). However, when called WITH milestoneScope from cmdInitExecutePhase/cmdInitPlanPhase, it only searches that one milestone. Add retry logic: after the main loop, if no result was found and milestoneScope was provided, retry the whole search with null (which triggers the cross-milestone path already built in):
    ```javascript
    // At the end, before return null:
    // Cross-milestone retry when called with explicit scope that found nothing
    if (milestoneScope) {
      return autoCreatePhaseFromRoadmap(cwd, phase, null);
    }
    ```
    IMPORTANT: Avoid infinite recursion — only retry once. Add a guard parameter or check that milestoneScope was the original call.
  </action>
  <verify>
    <automated>cd /Users/tmac/Projects/gsdup && node --test tests/init.test.cjs 2>&1 | tail -5</automated>
  </verify>
  <done>All existing init tests pass. Cross-milestone retry logic added to cmdInitPhaseOp, cmdInitExecutePhase, cmdInitPlanPhase, cmdInitVerifyWork. getRoadmapPhaseInternal cross-searches when milestoneScope is null. effectiveScope prefers detected scope over auto-resolved scope.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add integration tests for cross-milestone phase lookup in init commands</name>
  <files>tests/init.test.cjs</files>
  <behavior>
    - Test: concurrent project with v1.0 (phase 95) and v2.0 (active). `init phase-op 95` (no --milestone) finds phase 95 in v1.0.
    - Test: concurrent project with v1.0 (phase 3) and v2.0 (active, no phase 3). `init execute-phase 3` finds phase 3 in v1.0.
    - Test: concurrent project with v1.0 (ROADMAP has Phase 42) and v2.0 (active). `init plan-phase 42` finds phase 42 via ROADMAP cross-search and auto-creates directory.
    - Test: concurrent project with v1.0 (phase 7) and v2.0 (active). `init verify-work 7` finds phase 7 in v1.0.
    - Test: effectiveScope is set to the milestone where the phase was found (v1.0), NOT the active milestone (v2.0).
  </behavior>
  <action>
    Add a new `describe` block in tests/init.test.cjs:

    ```javascript
    describe('cross-milestone phase lookup in init commands (BUG-INIT-CROSSMS-01)', () => {
    ```

    Use `createConcurrentProject('v2.0')` as base, then add a second milestone workspace (v1.0) with phases. The active milestone is v2.0 (newest), but the target phase exists only in v1.0.

    Test structure for each test:
    1. Create concurrent project with v2.0 as active
    2. Create v1.0 milestone workspace: `mkdir -p .planning/milestones/v1.0/phases/95-legacy-feature` + STATE.md + ROADMAP.md
    3. Run `init phase-op 95` (no --milestone flag)
    4. Assert: `phase_found === true`, `milestone_scope === 'v1.0'`, directory points to v1.0

    Tests to write:
    - `init phase-op finds phase in non-active milestone without --milestone flag`
    - `init execute-phase finds phase in non-active milestone without --milestone flag`
    - `init plan-phase finds phase in non-active milestone without --milestone flag`
    - `init verify-work finds phase in non-active milestone without --milestone flag`
    - `effectiveScope reflects found milestone, not active milestone`
    - `init phase-op falls back to ROADMAP cross-milestone search` (phase exists in v1.0 ROADMAP but has no directory yet)
  </action>
  <verify>
    <automated>cd /Users/tmac/Projects/gsdup && node --test tests/init.test.cjs 2>&1 | tail -10</automated>
  </verify>
  <done>6 new integration tests pass. Cross-milestone phase lookup works for phase-op, execute-phase, plan-phase, and verify-work. effectiveScope correctly reflects the milestone where the phase was found. ROADMAP cross-search works for auto-creation.</done>
</task>

<task type="auto">
  <name>Task 3: Run full test suite to verify no regressions</name>
  <files></files>
  <action>
    Run the complete test suite to verify no regressions in any test file:
    ```bash
    cd /Users/tmac/Projects/gsdup && node --test tests/*.test.cjs
    ```

    If any tests fail that were NOT already failing before this change (the 4 pre-existing failures in check-patches and config quality), investigate and fix.

    Known pre-existing failures to IGNORE:
    - check-patches tests (pre-existing)
    - config quality tests that need isolated GSD_HOME (pre-existing)
  </action>
  <verify>
    <automated>cd /Users/tmac/Projects/gsdup && node --test tests/*.test.cjs 2>&1 | grep -E "^(# |not ok)" | head -20</automated>
  </verify>
  <done>Full test suite passes with no new failures. Only pre-existing failures (if any) remain.</done>
</task>

</tasks>

<verification>
1. `node --test tests/init.test.cjs` — all init tests pass including new cross-milestone tests
2. `node --test tests/core.test.cjs` — core tests pass (getRoadmapPhaseInternal changes)
3. `node --test tests/*.test.cjs` — full suite, no new regressions
4. Manual smoke test: `node get-shit-done/bin/gsd-tools.cjs init phase-op 3.1 --cwd .` should find phase 3.1 in v3.0 milestone even though v3.1 is active
</verification>

<success_criteria>
- All 4 init commands (phase-op, execute-phase, plan-phase, verify-work) find phases across milestones without --milestone flag
- effectiveScope correctly reflects the milestone where the phase was found
- getRoadmapPhaseInternal cross-searches milestones when milestoneScope is null
- autoCreatePhaseFromRoadmap retries cross-milestone when explicit scope finds nothing
- All existing tests pass, 6+ new tests added
- No infinite recursion in autoCreatePhaseFromRoadmap retry
</success_criteria>

<output>
After completion, create `.planning/quick/10-fix-cli-phase-op-init-to-auto-resolve-mi/10-SUMMARY.md`
</output>
