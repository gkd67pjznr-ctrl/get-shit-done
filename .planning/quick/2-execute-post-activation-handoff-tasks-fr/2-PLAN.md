---
phase: quick-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/core.test.cjs
  - tests/phase.test.cjs
  - tests/roadmap.test.cjs
  - tests/commands.test.cjs
  - tests/init.test.cjs
autonomous: true
requirements: [HANDOFF-P1, HANDOFF-P2]

must_haves:
  truths:
    - "findPhaseInternal with milestoneScope finds phases in milestone workspace"
    - "getRoadmapPhaseInternal with milestoneScope reads milestone-scoped ROADMAP.md"
    - "cmdPhaseAdd with milestoneScope generates milestone-prefix numbering (e.g., 3.N)"
    - "cmdPhasePlanIndex with milestoneScope indexes milestone workspace phases"
    - "cmdFindPhase with milestoneScope searches milestone workspace"
    - "cmdRoadmapUpdatePlanProgress with milestoneScope reads/writes milestone workspace ROADMAP"
    - "All 266 tests pass (0 failures)"
  artifacts:
    - path: "tests/core.test.cjs"
      provides: "Milestone-scoped tests for findPhaseInternal and getRoadmapPhaseInternal"
      contains: "milestoneScope"
    - path: "tests/phase.test.cjs"
      provides: "Milestone-scoped tests for cmdPhaseAdd, cmdPhasePlanIndex, cmdFindPhase"
      contains: "milestone"
    - path: "tests/roadmap.test.cjs"
      provides: "Milestone-scoped test for cmdRoadmapUpdatePlanProgress"
      contains: "milestone"
    - path: "tests/commands.test.cjs"
      provides: "Fixed check-patches test isolation"
      contains: "HOME"
    - path: "tests/init.test.cjs"
      provides: "Fixed config quality section tests with GSD_HOME isolation"
      contains: "GSD_HOME"
  key_links:
    - from: "tests/core.test.cjs"
      to: "get-shit-done/bin/lib/core.cjs"
      via: "direct require of findPhaseInternal, getRoadmapPhaseInternal"
      pattern: "require.*core\\.cjs"
    - from: "tests/phase.test.cjs"
      to: "get-shit-done/bin/gsd-tools.cjs"
      via: "CLI invocation with --milestone flag"
      pattern: "--milestone"
    - from: "tests/roadmap.test.cjs"
      to: "get-shit-done/bin/gsd-tools.cjs"
      via: "CLI invocation with --milestone flag"
      pattern: "--milestone"
---

<objective>
Add milestone-scoped test coverage for core, phase, and roadmap operations, and fix 4 pre-existing test failures caused by environment leakage.

Purpose: Complete the post-activation handoff tasks (Priority 1 and 2) to reach 266/266 tests passing with proper milestone-scoped test coverage.
Output: Updated test files with new milestone-scoped describe blocks and fixed environment isolation for failing tests.
</objective>

<execution_context>
@/Users/tmac/.claude/get-shit-done/workflows/execute-plan.md
@/Users/tmac/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/HANDOFF-post-activation.md
@tests/helpers.cjs
@tests/core.test.cjs
@tests/phase.test.cjs
@tests/roadmap.test.cjs
@get-shit-done/bin/lib/core.cjs
@get-shit-done/bin/lib/phase.cjs
@get-shit-done/bin/lib/roadmap.cjs

<interfaces>
<!-- Key functions under test and their signatures -->

From get-shit-done/bin/lib/core.cjs:
```javascript
function findPhaseInternal(cwd, phase, milestoneScope)  // Returns phase info object or null
function getRoadmapPhaseInternal(cwd, phaseNum, milestoneScope)  // Returns {found, phase_number, phase_name, goal, section} or null
function normalizePhaseName(phase)  // Returns normalized string (no padding for decimals)
function planningRoot(cwd, milestoneScope)  // Returns path to .planning/ or .planning/milestones/<version>/
```

From get-shit-done/bin/lib/phase.cjs (all accept milestoneScope as last param):
```javascript
function cmdPhaseAdd(cwd, description, raw, milestoneScope)    // Creates phase dir + ROADMAP entry; milestone → 3.N numbering
function cmdPhasePlanIndex(cwd, phase, raw, milestoneScope)    // Indexes plans in phase dir, returns waves/plans/incomplete
function cmdFindPhase(cwd, phase, raw, milestoneScope)         // Finds phase directory, returns metadata
function cmdPhasesList(cwd, options, raw, milestoneScope)      // Lists phases in workspace
```

From get-shit-done/bin/lib/roadmap.cjs:
```javascript
function cmdRoadmapUpdatePlanProgress(cwd, phaseNum, raw, milestoneScope)  // Updates plan checkboxes/progress in ROADMAP
```

From tests/helpers.cjs:
```javascript
function createConcurrentProject(version = 'v2.0')  // Creates temp project with concurrent:true + milestone workspace
function createTempProject()                          // Creates temp project with .planning/phases/
function runGsdTools(args, cwd)                       // Runs CLI command, returns {success, output, error}
function runGsdToolsFull(args, cwd, envOverrides)     // Runs CLI with env overrides, returns {success, output, stderr}
function cleanup(tmpDir)                              // Removes temp directory
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add milestone-scoped tests for core, phase, and roadmap operations</name>
  <files>
    tests/core.test.cjs
    tests/phase.test.cjs
    tests/roadmap.test.cjs
  </files>
  <action>
Add milestone-scoped test describe blocks to each test file. Use `createConcurrentProject('v3.0')` from helpers.cjs to set up test fixtures with milestone workspace structure.

**tests/core.test.cjs** -- Add a new `describe('milestone-scoped core functions', ...)` block at the end of the file:

1. Import `createConcurrentProject` from helpers.cjs (update the require destructuring on line 10).
2. Import `findPhaseInternal` and `getRoadmapPhaseInternal` from core.cjs (update the require destructuring on line 11).
3. Add tests:
   - `findPhaseInternal with milestoneScope finds phase in workspace`: Setup with `createConcurrentProject('v3.0')`, create a phase dir `3.1-test-phase` inside `.planning/milestones/v3.0/phases/`, assert `findPhaseInternal(tmpDir, '3.1', 'v3.0')` returns `{found: true}` with correct `phase_number: '3.1'` and `directory` containing `milestones/v3.0/phases`.
   - `findPhaseInternal with milestoneScope returns null for missing phase`: Use same setup, assert `findPhaseInternal(tmpDir, '99', 'v3.0')` returns `null`.
   - `getRoadmapPhaseInternal with milestoneScope reads milestone ROADMAP`: Setup with `createConcurrentProject('v3.0')`, write ROADMAP.md in `.planning/milestones/v3.0/ROADMAP.md` with content `### Phase 3.1: Test Phase\n**Goal:** Test milestone scope`, assert `getRoadmapPhaseInternal(tmpDir, '3.1', 'v3.0')` returns `{found: true, phase_name: 'Test Phase', goal: 'Test milestone scope'}`.
   - `normalizePhaseName with milestone-style dot-hierarchy`: Assert `normalizePhaseName('3.1')` returns `'3.1'` (not `'03.1'`), `normalizePhaseName('3.2.1')` returns `'3.2.1'`, `normalizePhaseName('15')` returns `'15'` (no change for 2-digit).

**tests/phase.test.cjs** -- Add a new `describe('milestone-scoped phase operations', ...)` block at the end of the file:

1. Import `createConcurrentProject` from helpers.cjs (update the require destructuring on line 9).
2. Add tests (all via CLI with `--milestone v3.0` flag):
   - `cmdFindPhase with milestoneScope finds phase in workspace`: Setup with `createConcurrentProject('v3.0')`, create phase dir `3.1-test` in milestone workspace phases, run `runGsdTools('--milestone v3.0 find-phase 3.1', tmpDir)`, assert output has `found: true` and directory path contains `milestones/v3.0`.
   - `cmdPhasePlanIndex with milestoneScope indexes workspace phases`: Setup with `createConcurrentProject('v3.0')`, create phase dir `3.1-setup` with a `3.1-01-PLAN.md` file in it (content: `---\nwave: 1\nautonomous: true\n---\n## Task 1: Test`), run `runGsdTools('--milestone v3.0 phase-plan-index 3.1', tmpDir)`, assert output has `plans.length === 1` and `plans[0].id === '3.1-01'`.
   - `cmdPhaseAdd with milestoneScope generates milestone-prefix numbering`: Setup with `createConcurrentProject('v3.0')`, write a ROADMAP.md in the milestone workspace with content `# Roadmap v3.0\n\n### Phase 3.1: Foundation\n**Goal:** Setup\n`, run `runGsdTools('--milestone v3.0 phase add New Feature', tmpDir)`, assert output has `phase_number` matching `3.2` (next after 3.1) and directory path in milestone workspace.
   - `phases list with --milestone lists milestone workspace phases`: Setup with `createConcurrentProject('v3.0')`, create two phase dirs (`3.1-alpha`, `3.2-beta`) in milestone workspace, run `runGsdTools('--milestone v3.0 phases list', tmpDir)`, assert output directories contain both phase names sorted correctly.

**tests/roadmap.test.cjs** -- Add a new `describe('milestone-scoped roadmap update-plan-progress', ...)` block at the end of the file:

1. Add test:
   - `cmdRoadmapUpdatePlanProgress with milestoneScope reads/writes workspace ROADMAP`: Setup with `createConcurrentProject('v3.0')`, write ROADMAP.md in milestone workspace with content containing a phase section with plan-level checkboxes (`### Phase 3.1: Test\n**Goal:** Test\n**Plans:** 1/1 plans complete\nPlans:\n- [ ] 3.1-01-PLAN.md -- Some desc`), create phase dir `3.1-test` in milestone workspace with `3.1-01-PLAN.md` and `3.1-01-SUMMARY.md`, run `runGsdTools('--milestone v3.0 roadmap update-plan-progress 3.1 --raw', tmpDir)`, read the milestone workspace ROADMAP.md and assert it contains `- [x] 3.1-01-PLAN.md` (checkbox flipped).

  <quality_scan>
    <code_to_reuse>
      - Known: `tests/roadmap.test.cjs` lines 266-325 — `describe('milestone-scoped roadmap commands (INTG-02)')` is the existing pattern for milestone-scoped CLI tests via `createConcurrentProject`; reuse the beforeEach/afterEach pattern and `--milestone v3.0` flag placement.
      - Known: `tests/roadmap.test.cjs` lines 331-455 — `describe('plan-level checkbox update')` shows exact pattern for testing `cmdRoadmapUpdatePlanProgress` with fixture setup.
      - Known: `tests/core.test.cjs` lines 1-120 — existing tests for `planningRoot` and `detectLayoutStyle` show the direct-import testing pattern for core functions.
      - Grep pattern: `grep -rn "createConcurrentProject" tests/ --include="*.cjs" | head -10`
    </code_to_reuse>
    <docs_to_consult>
      N/A -- no external library dependencies; all functions are internal codebase.
    </docs_to_consult>
    <tests_to_write>
      - File: `tests/core.test.cjs` -- 4 new tests in "milestone-scoped core functions" describe block
      - File: `tests/phase.test.cjs` -- 4 new tests in "milestone-scoped phase operations" describe block
      - File: `tests/roadmap.test.cjs` -- 1 new test in "milestone-scoped roadmap update-plan-progress" describe block
      - What to test: milestoneScope parameter correctly routes to milestone workspace for findPhaseInternal, getRoadmapPhaseInternal, cmdFindPhase, cmdPhasePlanIndex, cmdPhaseAdd, phases list, and cmdRoadmapUpdatePlanProgress
    </tests_to_write>
  </quality_scan>
  </action>
  <verify>
    <automated>cd /Users/tmac/Projects/gsdup && node --test tests/core.test.cjs tests/phase.test.cjs tests/roadmap.test.cjs 2>&1 | tail -5</automated>
  </verify>
  <done>9 new milestone-scoped tests pass: findPhaseInternal (2), getRoadmapPhaseInternal (1), normalizePhaseName (1), cmdFindPhase (1), cmdPhasePlanIndex (1), cmdPhaseAdd (1), phases list (1), cmdRoadmapUpdatePlanProgress (1)</done>
</task>

<task type="auto">
  <name>Task 2: Fix 4 pre-existing test failures (environment isolation)</name>
  <files>
    tests/commands.test.cjs
    tests/init.test.cjs
  </files>
  <action>
Fix 4 test failures caused by environment leakage from the user's system into the test environment.

**Root causes diagnosed:**

1. **check-patches test** (`tests/commands.test.cjs` line 768): The test overrides `GSD_HOME` to an empty temp dir but `cmdCheckPatches` also checks `~/.claude/gsd-local-patches/` as a fallback (line 521 of commands.cjs). The user has a real `backup-meta.json` at that path, so `has_patches` returns `true` instead of `false`.

   **Fix:** Override `HOME` environment variable in the `runGsdToolsFull` call to point to a clean temp directory, so `path.join(homedir, '.claude', 'gsd-local-patches')` resolves to a nonexistent path. Change the test at line 771 from:
   ```javascript
   const result = runGsdToolsFull(['check-patches'], tmpDir, { GSD_HOME: gsdHomeDir });
   ```
   to:
   ```javascript
   const result = runGsdToolsFull(['check-patches'], tmpDir, { GSD_HOME: gsdHomeDir, HOME: gsdHomeDir });
   ```
   This ensures `os.homedir()` returns the temp dir, so both `globalPatchesDir` and `localPatchesDir` resolve to paths that don't exist.

2. **config quality section tests** (`tests/init.test.cjs` lines 331, 347, 438): The `cmdConfigEnsureSection` function loads user-level defaults from `~/.gsd/defaults.json` (line 29 of config.cjs). The user's real `defaults.json` has `quality.level: "standard"`, which overrides the hardcoded `"fast"` default. Tests expect `"fast"` because they assume a clean environment.

   **Fix for all 3 failing tests:** Override `HOME` and `GSD_HOME` in `runGsdTools` calls to isolate from real user defaults. Since `runGsdTools` doesn't support env overrides, switch to `runGsdToolsFull` for these specific tests.

   In `tests/init.test.cjs`:
   - Add `runGsdToolsFull` to the require destructuring at the top (line ~8).
   - For the test at line 331 (`config-ensure-section creates quality key with fast default`): Create a temp GSD_HOME dir, use `runGsdToolsFull(['config-ensure-section'], tmpDir, { GSD_HOME: isolatedHome, HOME: isolatedHome })` instead of `runGsdTools`. Clean up the temp dir in a finally block.
   - For the test at line 347 (`config-get quality.level returns fast on fresh config`): Same pattern -- use isolated `GSD_HOME` and `HOME` for both the ensure-section and config-get calls.
   - For the test at line 438 (`config-ensure-section adds quality block to existing config missing it`): Same pattern.

   Important: The `runGsdToolsFull` function accepts args as an array (e.g., `['config-ensure-section']`) or a string. Ensure all switched calls use the correct format. Check existing `runGsdToolsFull` usage in `tests/commands.test.cjs` for the pattern.

  <quality_scan>
    <code_to_reuse>
      - Known: `tests/commands.test.cjs` lines 768-778 — existing `check-patches` test with `runGsdToolsFull` and env overrides; modify in-place.
      - Known: `tests/helpers.cjs` lines 30-44 — `runGsdToolsFull(args, cwd, envOverrides)` function signature and behavior.
      - Grep pattern: `grep -rn "runGsdToolsFull" tests/ --include="*.cjs" | head -10`
    </code_to_reuse>
    <docs_to_consult>
      N/A -- no external library dependencies; fixing test isolation only.
    </docs_to_consult>
    <tests_to_write>
      N/A -- we are fixing existing tests, not writing new exported logic.
    </tests_to_write>
  </quality_scan>
  </action>
  <verify>
    <automated>cd /Users/tmac/Projects/gsdup && node --test tests/commands.test.cjs tests/init.test.cjs 2>&1 | grep -E "pass|fail" | tail -5</automated>
  </verify>
  <done>All 4 previously failing tests now pass: check-patches returns has_patches false (1), config quality.level defaults to fast (2), config auto-migration quality.level defaults to fast (1). Full suite: 266/266 pass, 0 fail.</done>
</task>

</tasks>

<verification>
Run the full test suite to confirm all 266+ tests pass with zero failures:
```bash
node --test tests/*.test.cjs 2>&1 | tail -10
```
Expected: `# pass 266` (or higher with new tests), `# fail 0`
</verification>

<success_criteria>
- 9 new milestone-scoped tests added and passing across core.test.cjs, phase.test.cjs, and roadmap.test.cjs
- 4 pre-existing test failures fixed via proper environment isolation (HOME + GSD_HOME overrides)
- Full test suite: 0 failures (was 4), total pass count increased by 9 (from 262 to 271+)
- No existing passing tests broken by changes
</success_criteria>

<output>
After completion, create `.planning/quick/2-execute-post-activation-handoff-tasks-fr/2-SUMMARY.md`
</output>
