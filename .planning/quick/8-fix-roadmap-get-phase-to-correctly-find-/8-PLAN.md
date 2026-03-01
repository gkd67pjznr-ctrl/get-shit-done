---
phase: quick-8
plan: 01
type: tdd
wave: 1
depends_on: []
files_modified:
  - get-shit-done/bin/lib/roadmap.cjs
  - get-shit-done/bin/lib/core.cjs
  - get-shit-done/bin/lib/phase.cjs
  - tests/roadmap.test.cjs
  - tests/phase.test.cjs
autonomous: true
requirements: [BUG-ROADMAP-01]

must_haves:
  truths:
    - "roadmap get-phase finds phases from non-active milestones when no --milestone flag is given"
    - "find-phase locates phases across all milestones when no --milestone flag is given"
    - "getRoadmapPhaseInternal (used by init.cjs) falls back across milestones"
    - "Existing behavior with explicit --milestone flag is unchanged"
    - "All existing tests continue to pass"
  artifacts:
    - path: "get-shit-done/bin/lib/roadmap.cjs"
      provides: "cmdRoadmapGetPhase with cross-milestone fallback"
      contains: "detectLayoutStyle"
    - path: "get-shit-done/bin/lib/core.cjs"
      provides: "getRoadmapPhaseInternal with cross-milestone fallback"
      contains: "milestone-scoped"
    - path: "get-shit-done/bin/lib/phase.cjs"
      provides: "cmdFindPhase delegating to findPhaseInternal for cross-milestone search"
      contains: "findPhaseInternal"
    - path: "tests/roadmap.test.cjs"
      provides: "Test coverage for cross-milestone roadmap get-phase"
    - path: "tests/phase.test.cjs"
      provides: "Test coverage for cross-milestone find-phase"
  key_links:
    - from: "get-shit-done/bin/lib/roadmap.cjs"
      to: "get-shit-done/bin/lib/core.cjs"
      via: "detectLayoutStyle, planningRoot, resolveActiveMilestone imports"
      pattern: "detectLayoutStyle|resolveActiveMilestone"
    - from: "get-shit-done/bin/lib/phase.cjs"
      to: "get-shit-done/bin/lib/core.cjs"
      via: "findPhaseInternal delegation"
      pattern: "findPhaseInternal"
---

<objective>
Fix three functions that fail to find phases in milestone-scoped layouts when the phase lives in a non-active milestone.

**Root Cause:** The CLI auto-resolves `milestoneScope` to the active milestone (e.g., v3.1) via `resolveActiveMilestone`. When a user asks for a phase from a different milestone (e.g., phase 3.1 from v3.0), these functions only search the active milestone's ROADMAP/phases and return "not found":

1. `cmdRoadmapGetPhase` (roadmap.cjs) — reads only active milestone's ROADMAP.md
2. `getRoadmapPhaseInternal` (core.cjs) — same, used by init.cjs for plan-phase/execute-plan/verify-phase
3. `cmdFindPhase` (phase.cjs) — searches only active milestone's phases directory

**Fix pattern:** Mirror what `findPhaseInternal` already does — when phase is not found in the specified milestone and layout is milestone-scoped, search all milestone ROADMAPs/phases directories.

Purpose: Phases from completed milestones should be discoverable without requiring explicit `--milestone` flags.
Output: Fixed functions + TDD test coverage.
</objective>

<execution_context>
@/Users/tmac/.claude/get-shit-done/workflows/execute-plan.md
@/Users/tmac/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@get-shit-done/bin/lib/core.cjs (findPhaseInternal at line 246 is the reference pattern for cross-milestone search)
@get-shit-done/bin/lib/roadmap.cjs (cmdRoadmapGetPhase at line 9 needs fix)
@get-shit-done/bin/lib/phase.cjs (cmdFindPhase at line 151 needs fix)
@tests/roadmap.test.cjs (existing tests to preserve)
@tests/phase.test.cjs (existing tests to extend)
@tests/helpers.cjs (createConcurrentProject helper for test setup)

<interfaces>
From get-shit-done/bin/lib/core.cjs:
```javascript
function planningRoot(cwd, milestoneScope)  // Returns .planning/ or .planning/milestones/<version>/
function detectLayoutStyle(cwd)              // Returns 'legacy' | 'milestone-scoped' | 'uninitialized'
function resolveActiveMilestone(cwd)         // Returns active milestone dir name (e.g., 'v3.1') or null
function findPhaseInternal(cwd, phase, milestoneScope) // Searches across all milestones when !milestoneScope
function escapeRegex(value)
function normalizePhaseName(phase)
function comparePhaseNum(a, b)
function searchPhaseInDir(baseDir, relBase, normalized)
function getRoadmapPhaseInternal(cwd, phaseNum, milestoneScope) // NEEDS FIX: no cross-milestone fallback
```

From get-shit-done/bin/lib/roadmap.cjs:
```javascript
function cmdRoadmapGetPhase(cwd, phaseNum, raw, milestoneScope)      // NEEDS FIX
function cmdRoadmapAnalyze(cwd, raw, milestoneScope)                 // OK (scoped to one milestone is correct)
function cmdRoadmapUpdatePlanProgress(cwd, phaseNum, raw, milestoneScope) // OK (uses findPhaseInternal)
```

From tests/helpers.cjs:
```javascript
function createConcurrentProject(version = 'v2.0') // Creates milestone-scoped temp project
function createTempProject()                         // Creates legacy temp project
function cleanup(tmpDir)
function runGsdTools(args, cwd)
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write failing tests for cross-milestone phase lookup</name>
  <files>tests/roadmap.test.cjs, tests/phase.test.cjs</files>
  <behavior>
    - Test: `roadmap get-phase` finds phase 3.1 when active milestone is v3.1 but phase 3.1 exists in v3.0's ROADMAP
    - Test: `roadmap get-phase` still works for phases in the active milestone (phase 4 in v3.1)
    - Test: `roadmap get-phase` with explicit --milestone flag is unchanged (no fallback needed)
    - Test: `find-phase` finds phase 3.1 across milestones when it exists in v3.0's phases dir but active is v3.1
    - Test: `getRoadmapPhaseInternal` finds cross-milestone phases (test via roadmap get-phase CLI or direct unit test)
  </behavior>
  <action>
    Add a new describe block in tests/roadmap.test.cjs: "cross-milestone roadmap get-phase fallback". Setup:
    - Use `createConcurrentProject('v3.1')` to create base project with v3.1 as active milestone
    - Also create v3.0 milestone workspace with its own ROADMAP.md containing `### Phase 3.1: Integration Fixes` and phases dir with `3.1-integration-fixes/`
    - The v3.1 ROADMAP.md should contain `### Phase 4: Bug Fixes`

    Tests:
    1. `roadmap get-phase 3.1` (no --milestone) should return found=true with data from v3.0's ROADMAP
    2. `roadmap get-phase 4` (no --milestone) should return found=true with data from v3.1's ROADMAP (active milestone works as before)
    3. `roadmap get-phase 3.1 --milestone v3.0` should return found=true (explicit flag works)
    4. `roadmap get-phase 99` should return found=false (truly missing phase)

    Add a new describe block in tests/phase.test.cjs: "cross-milestone find-phase fallback". Setup:
    - Same multi-milestone project setup as above
    - v3.0 phases dir has `3.1-integration-fixes/` with a PLAN.md inside
    - v3.1 phases dir has `04-bug-fixes/` with a PLAN.md inside

    Tests:
    1. `find-phase 3.1` (no --milestone) should return found=true with directory in v3.0
    2. `find-phase 4` (no --milestone) should return found=true with directory in v3.1
    3. `find-phase 99` should return found=false

    Run tests to confirm they FAIL (RED phase).
  </action>
  <verify>
    <automated>cd /Users/tmac/Projects/gsdup && node --test tests/roadmap.test.cjs tests/phase.test.cjs 2>&1 | grep -E "(pass|fail|cross-milestone)" | head -20</automated>
  </verify>
  <done>New cross-milestone tests exist and FAIL (RED), all existing tests still PASS</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement cross-milestone fallback in all three functions</name>
  <files>get-shit-done/bin/lib/roadmap.cjs, get-shit-done/bin/lib/core.cjs, get-shit-done/bin/lib/phase.cjs</files>
  <behavior>
    - cmdRoadmapGetPhase: when phase not found in milestoneScope ROADMAP and layout is milestone-scoped, search all other milestone ROADMAPs
    - getRoadmapPhaseInternal: same fallback pattern
    - cmdFindPhase: when phase not found in milestoneScope phases dir and layout is milestone-scoped, delegate to findPhaseInternal(cwd, phase) which already searches all milestones
  </behavior>
  <action>
    **Fix 1: cmdRoadmapGetPhase (roadmap.cjs)**

    Add imports at top: `detectLayoutStyle` and `resolveActiveMilestone` from core.cjs (escapeRegex and planningRoot are already imported).

    After the existing "not found" logic (line 50: `output({ found: false, phase_number: phaseNum }, raw, '');`), BEFORE returning, add cross-milestone fallback:

    ```javascript
    // Cross-milestone fallback: if milestoneScope was set (possibly auto-detected) and
    // layout is milestone-scoped, search other milestone ROADMAPs
    if (milestoneScope && detectLayoutStyle(cwd) === 'milestone-scoped') {
      const milestonesDir = path.join(cwd, '.planning', 'milestones');
      try {
        const msDirs = fs.readdirSync(milestonesDir, { withFileTypes: true })
          .filter(e => e.isDirectory() && e.name !== milestoneScope)
          .map(e => e.name)
          .sort()
          .reverse(); // newest first

        for (const ms of msDirs) {
          const msRoadmapPath = path.join(milestonesDir, ms, 'ROADMAP.md');
          if (!fs.existsSync(msRoadmapPath)) continue;
          const msContent = fs.readFileSync(msRoadmapPath, 'utf-8');
          const msHeaderMatch = msContent.match(phasePattern);
          if (msHeaderMatch) {
            // Found in different milestone - extract same fields as main path
            // ... (extract phaseName, section, goal, success_criteria same as lines 54-87)
            // Add milestone_scope to result
          }
        }
      } catch {}
    }
    ```

    To avoid code duplication, extract the "parse phase section from content" logic into a helper function inside roadmap.cjs:

    ```javascript
    function extractPhaseFromContent(content, phaseNum, phasePattern) {
      const headerMatch = content.match(phasePattern);
      if (!headerMatch) return null;

      const phaseName = headerMatch[1].trim();
      const headerIndex = headerMatch.index;
      const restOfContent = content.slice(headerIndex);
      const nextHeaderMatch = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
      const sectionEnd = nextHeaderMatch ? headerIndex + nextHeaderMatch.index : content.length;
      const section = content.slice(headerIndex, sectionEnd).trim();

      const goalMatch = section.match(/\*\*Goal:\*\*\s*([^\n]+)/i);
      const goal = goalMatch ? goalMatch[1].trim() : null;

      const criteriaMatch = section.match(/\*\*Success Criteria\*\*[^\n]*:\s*\n((?:\s*\d+\.\s*[^\n]+\n?)+)/i);
      const success_criteria = criteriaMatch
        ? criteriaMatch[1].trim().split('\n').map(line => line.replace(/^\s*\d+\.\s*/, '').trim()).filter(Boolean)
        : [];

      return { phase_number: phaseNum, phase_name: phaseName, goal, success_criteria, section };
    }
    ```

    Refactor `cmdRoadmapGetPhase` to use this helper, then add the fallback loop.

    **Fix 2: getRoadmapPhaseInternal (core.cjs)**

    Same pattern. After the existing `if (!headerMatch) return null;` at line 363, add cross-milestone fallback when milestoneScope is set and layout is milestone-scoped. Search other milestone ROADMAPs for the phase header. When found, return the result with an added `milestone_scope` field.

    **Fix 3: cmdFindPhase (phase.cjs)**

    The simplest fix: when the phase is not found in the specified milestone's phases directory (line 166-168), add a fallback that calls `findPhaseInternal(cwd, phase)` (which already handles cross-milestone search). `findPhaseInternal` is already imported in phase.cjs. When `findPhaseInternal` returns a result, format it the same way `cmdFindPhase` currently formats results (the `findPhaseInternal` result already has the right shape via `searchPhaseInDir`).

    Run all tests to confirm GREEN.
  </action>
  <verify>
    <automated>cd /Users/tmac/Projects/gsdup && node --test tests/roadmap.test.cjs tests/phase.test.cjs 2>&1 | tail -10</automated>
  </verify>
  <done>All new cross-milestone tests PASS (GREEN), all existing tests still PASS, no regressions</done>
</task>

<task type="auto">
  <name>Task 3: Full test suite regression check</name>
  <files>tests/*.test.cjs</files>
  <action>
    Run the entire test suite to verify no regressions across all modules. The `findPhaseInternal` and `getRoadmapPhaseInternal` changes could affect init.cjs, phase-complete, and roadmap-update-plan-progress flows. Verify:

    1. `node --test tests/*.test.cjs` — all pass (262+ of 266, same 4 pre-existing failures as noted in MEMORY.md)
    2. Manual smoke test: `node get-shit-done/bin/gsd-tools.cjs roadmap get-phase 3.1` should now return found=true from v3.0
    3. Manual smoke test: `node get-shit-done/bin/gsd-tools.cjs find-phase 3.1` should now return found=true from v3.0
    4. Manual smoke test: `node get-shit-done/bin/gsd-tools.cjs roadmap get-phase 4` should still return found=true from v3.1 (active milestone)

    If the 4 pre-existing failures are in check-patches or config quality tests, that is expected and not a regression.
  </action>
  <verify>
    <automated>cd /Users/tmac/Projects/gsdup && node --test tests/*.test.cjs 2>&1 | tail -15</automated>
  </verify>
  <done>Full test suite passes with same pass/fail counts as baseline (262+/266). Smoke tests confirm cross-milestone lookups work.</done>
</task>

</tasks>

<verification>
1. `node --test tests/roadmap.test.cjs` — all tests pass including new cross-milestone tests
2. `node --test tests/phase.test.cjs` — all tests pass including new cross-milestone tests
3. `node --test tests/*.test.cjs` — no regressions (262+ pass, same 4 pre-existing failures)
4. `node get-shit-done/bin/gsd-tools.cjs roadmap get-phase 3.1` returns found=true with v3.0 data
5. `node get-shit-done/bin/gsd-tools.cjs find-phase 3.1` returns found=true with v3.0 directory
6. `node get-shit-done/bin/gsd-tools.cjs roadmap get-phase 4` returns found=true with v3.1 data (active milestone, no regression)
</verification>

<success_criteria>
- All three functions (cmdRoadmapGetPhase, getRoadmapPhaseInternal, cmdFindPhase) find phases across milestones without requiring explicit --milestone flag
- Explicit --milestone flag behavior is unchanged
- Full test suite shows no regressions
- New TDD tests cover cross-milestone fallback scenarios
</success_criteria>

<output>
After completion, create `.planning/quick/8-fix-roadmap-get-phase-to-correctly-find-/8-SUMMARY.md`
</output>
