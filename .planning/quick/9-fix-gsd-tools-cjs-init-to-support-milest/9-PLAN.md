---
phase: quick-9
plan: 01
type: tdd
wave: 1
depends_on: []
files_modified:
  - get-shit-done/bin/lib/core.cjs
  - tests/core.test.cjs
  - tests/routing.test.cjs
autonomous: true
requirements:
  - BUG-INIT-01
  - BUG-INIT-02
  - BUG-INIT-03

must_haves:
  truths:
    - "detectLayoutStyle returns milestone-scoped when .planning/milestones/ has subdirs even without concurrent:true in config.json"
    - "resolveActiveMilestone sorts v14.0 after v9.0 (not lexicographic)"
    - "init plan-phase finds phases in milestone workspace when concurrent flag is absent but milestones directory exists"
  artifacts:
    - path: "get-shit-done/bin/lib/core.cjs"
      provides: "Fixed detectLayoutStyle and resolveActiveMilestone functions"
      contains: "milestones.*isDirectory|semver|parseVersion"
    - path: "tests/core.test.cjs"
      provides: "Tests for directory-based detection fallback"
      contains: "directory-based detection|without concurrent"
    - path: "tests/routing.test.cjs"
      provides: "Tests for version sorting with double-digit versions"
      contains: "v14|double-digit|numeric"
  key_links:
    - from: "get-shit-done/bin/lib/core.cjs:detectLayoutStyle"
      to: ".planning/milestones/"
      via: "directory existence check fallback"
      pattern: "milestones.*isDirectory"
    - from: "get-shit-done/bin/lib/core.cjs:resolveActiveMilestone"
      to: "version sort"
      via: "numeric comparison replacing lexicographic .sort()"
      pattern: "parseFloat|parseInt|localeCompare.*numeric"
    - from: "get-shit-done/bin/gsd-tools.cjs:auto-detect"
      to: "get-shit-done/bin/lib/core.cjs:detectLayoutStyle"
      via: "detectLayoutStyle === milestone-scoped triggers resolveActiveMilestone"
      pattern: "detectLayoutStyle.*milestone-scoped"
---

<objective>
Fix `gsd-tools.cjs init` commands to correctly detect milestone-scoped layouts and resolve active milestones when the `concurrent: true` flag is absent from config.json.

Purpose: The `new-milestone` workflow creates `.planning/milestones/<version>/` directories but never sets `concurrent: true` in config.json (only `migrate.cjs` does). This causes `detectLayoutStyle()` to return `'legacy'` even when milestones exist, making all init commands return `phase_found: false` and null paths.

Output: Patched `detectLayoutStyle()` with directory-based fallback, fixed `resolveActiveMilestone()` version sorting, and comprehensive tests.
</objective>

<execution_context>
@/Users/tmac/.claude/get-shit-done/workflows/execute-plan.md
@/Users/tmac/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@get-shit-done/bin/lib/core.cjs (lines 475-520: detectLayoutStyle + resolveActiveMilestone)
@get-shit-done/bin/gsd-tools.cjs (line 206: auto-detect milestone scope in router)
@get-shit-done/bin/lib/init.cjs (all init commands that call detectLayoutStyle)
@tests/core.test.cjs (existing detectLayoutStyle tests)
@tests/routing.test.cjs (existing resolveActiveMilestone tests)
@tests/helpers.cjs (createTempProject, createConcurrentProject, cleanup)

<interfaces>
<!-- Key functions being modified -->

From get-shit-done/bin/lib/core.cjs (current):
```javascript
// Line 475-487 — SOLE gate for milestone detection
function detectLayoutStyle(cwd) {
  const configPath = path.join(cwd, '.planning', 'config.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.concurrent === true) {
      return 'milestone-scoped';
    }
    return 'legacy';
  } catch {
    return 'uninitialized';
  }
}

// Line 489-520 — Lexicographic sort bug on version numbers
function resolveActiveMilestone(cwd) {
  // ... uses .sort() which sorts 'v14.0' before 'v2.0'
  // Strategy 1: conflict.json with status === 'active'
  // Strategy 2: newest dir with STATE.md
  // Strategy 3: newest dir
}
```

From get-shit-done/bin/gsd-tools.cjs (line 206):
```javascript
// Auto-detect milestone scope when not explicitly provided
if (!milestoneScope && detectLayoutStyle(cwd) === 'milestone-scoped') {
  milestoneScope = resolveActiveMilestone(cwd);
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write failing tests for all three bugs (RED)</name>
  <files>tests/core.test.cjs, tests/routing.test.cjs</files>
  <behavior>
    - Test A (core.test.cjs): detectLayoutStyle returns 'milestone-scoped' when config.json has NO concurrent flag but .planning/milestones/ exists with at least one vX.Y subdirectory containing STATE.md
    - Test B (core.test.cjs): detectLayoutStyle returns 'legacy' when config.json has NO concurrent flag and .planning/milestones/ does NOT exist (no false positive)
    - Test C (core.test.cjs): detectLayoutStyle returns 'milestone-scoped' when config.json does not exist at all but .planning/milestones/v1.0/ exists with STATE.md (uninitialized -> milestone-scoped upgrade)
    - Test D (routing.test.cjs): resolveActiveMilestone returns 'v14.0' (not 'v2.0') when both v2.0 and v14.0 exist with conflict.json status:active — tests numeric sort
    - Test E (routing.test.cjs): resolveActiveMilestone returns 'v10.0' when v2.0 and v10.0 exist with STATE.md only (no conflict.json) — tests Strategy 2 numeric sort
    - Test F (routing.test.cjs): resolveActiveMilestone returns 'v9.0' when v1.0 and v9.0 exist as bare dirs — tests Strategy 3 numeric sort
  </behavior>
  <action>
    Add tests to the EXISTING describe blocks in each file.

    In tests/core.test.cjs, add to the 'detectLayoutStyle' describe block:
    1. Test for directory-based detection: create a temp project with createTempProject(), manually create `.planning/milestones/v1.0/` with STATE.md inside but do NOT write concurrent:true to config.json (write config without it, e.g. `{ "mode": "yolo" }`). Assert detectLayoutStyle returns 'milestone-scoped'.
    2. Test no false positive: createTempProject() with config `{ "mode": "yolo" }` but NO milestones directory. Assert returns 'legacy'.
    3. Test uninitialized with milestones dir: createTempProject(), do NOT create config.json at all, but DO create `.planning/milestones/v1.0/STATE.md`. Assert returns 'milestone-scoped' (not 'uninitialized').

    In tests/routing.test.cjs, add to the 'resolveActiveMilestone' describe block:
    4. Test double-digit conflict.json sort: createConcurrentProject('v2.0'), add v14.0 dir with conflict.json status:active AND v2.0 conflict.json status:active. Assert returns 'v14.0'.
    5. Test double-digit STATE.md sort: create dirs for v2.0 and v10.0 both with STATE.md, no conflict.json. Assert returns 'v10.0'.
    6. Test double-digit bare dir sort: create dirs for v1.0 and v9.0, no STATE.md or conflict.json. Assert returns 'v9.0'.

    Run tests — all 6 new tests MUST FAIL (existing behavior returns wrong values).
  </action>
  <verify>
    <automated>node --test tests/core.test.cjs tests/routing.test.cjs 2>&1 | grep -E "(pass|fail)" | tail -5</automated>
  </verify>
  <done>6 new tests exist and all 6 FAIL. All previously passing tests (58) still pass. The failures demonstrate all three bugs.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Fix detectLayoutStyle and resolveActiveMilestone (GREEN)</name>
  <files>get-shit-done/bin/lib/core.cjs</files>
  <behavior>
    - detectLayoutStyle falls back to directory-based detection when concurrent flag is not set
    - resolveActiveMilestone uses numeric version comparison instead of lexicographic .sort()
  </behavior>
  <action>
    **Fix 1: detectLayoutStyle() (core.cjs ~line 475)**

    After the existing config.json check, add a directory-based fallback. The logic should be:
    1. Try to read config.json. If `concurrent === true`, return 'milestone-scoped' (existing behavior, unchanged).
    2. If config.json exists but `concurrent` is not true, OR if config.json doesn't exist (catch block):
       - Check if `.planning/milestones/` directory exists and contains at least one `vX.Y` subdirectory with a STATE.md file inside
       - If yes, return 'milestone-scoped'
    3. If config.json existed but no milestones detected, return 'legacy' (existing behavior).
    4. If config.json didn't exist and no milestones detected, return 'uninitialized' (existing behavior).

    Restructure the function to something like:
    ```javascript
    function detectLayoutStyle(cwd) {
      const configPath = path.join(cwd, '.planning', 'config.json');
      let hasConfig = false;
      try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        hasConfig = true;
        const parsed = JSON.parse(raw);
        if (parsed.concurrent === true) {
          return 'milestone-scoped';
        }
      } catch {
        // config.json missing or invalid
      }
      // Directory-based fallback: detect milestones even without concurrent flag
      try {
        const milestonesDir = path.join(cwd, '.planning', 'milestones');
        const dirs = fs.readdirSync(milestonesDir, { withFileTypes: true })
          .filter(e => e.isDirectory() && /^v\d/.test(e.name));
        const hasWorkspace = dirs.some(d =>
          fs.existsSync(path.join(milestonesDir, d.name, 'STATE.md'))
        );
        if (hasWorkspace) return 'milestone-scoped';
      } catch {
        // No milestones directory
      }
      return hasConfig ? 'legacy' : 'uninitialized';
    }
    ```

    **Fix 2: resolveActiveMilestone() (core.cjs ~line 489)**

    Create a helper function for version-aware sorting that replaces all three `.sort()` calls:
    ```javascript
    function compareVersions(a, b) {
      // Extract numeric parts from version strings like 'v2.0', 'v14.1'
      const partsA = a.replace(/^v/, '').split('.').map(Number);
      const partsB = b.replace(/^v/, '').split('.').map(Number);
      for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const numA = partsA[i] || 0;
        const numB = partsB[i] || 0;
        if (numA !== numB) return numA - numB;
      }
      return 0;
    }
    ```

    Then replace all three `.sort()` calls in resolveActiveMilestone with `.sort(compareVersions)`:
    - Line ~506: `active.sort(compareVersions);`
    - Line ~513: `.sort(compareVersions);`
    - Line ~517: `const all = dirs.map(d => d.name).sort(compareVersions);`

    Export `compareVersions` in the module.exports for testability (optional but recommended).

    Run full test suite — ALL tests must pass including the 6 new ones.
  </action>
  <verify>
    <automated>node --test tests/core.test.cjs tests/routing.test.cjs 2>&1 | grep -E "^# (tests|pass|fail)"</automated>
  </verify>
  <done>All tests pass (58 previously passing + 6 new = 64 total, 0 failures). detectLayoutStyle correctly detects milestone-scoped layouts via directory presence. resolveActiveMilestone correctly sorts version numbers numerically.</done>
</task>

<task type="auto">
  <name>Task 3: Integration test — init plan-phase finds milestone phases without concurrent flag</name>
  <files>tests/init.test.cjs</files>
  <action>
    Add integration tests to tests/init.test.cjs in a new describe block: 'init commands with milestone directory detection (BUG-INIT-01)'.

    Test 1: "init plan-phase finds phase when milestones dir exists but concurrent flag is absent"
    - Create a temp project with createTempProject()
    - Write config.json WITHOUT concurrent:true: `{ "mode": "yolo" }`
    - Create `.planning/milestones/v2.0/phases/01-test/` directory
    - Write `.planning/milestones/v2.0/STATE.md` and `.planning/milestones/v2.0/ROADMAP.md`
    - Run: `runGsdTools('init plan-phase 1 --raw', tmpDir)`
    - Assert: output.phase_found === true
    - Assert: output.layout_style === 'milestone-scoped'
    - Assert: output.milestone_scope === 'v2.0'
    - Assert: output.planning_root ends with '.planning/milestones/v2.0'

    Test 2: "init execute-phase finds phase when milestones dir exists but concurrent flag is absent"
    - Same setup as Test 1, plus write a PLAN.md in the phase dir
    - Run: `runGsdTools('init execute-phase 1 --raw', tmpDir)`
    - Assert: output.phase_found === true
    - Assert: output.layout_style === 'milestone-scoped'

    Test 3: "init plan-phase selects correct milestone with double-digit versions"
    - Create temp project, write config WITHOUT concurrent:true
    - Create v2.0 and v14.0 milestone dirs, both with STATE.md
    - Create phase in v14.0: `.planning/milestones/v14.0/phases/01-test/`
    - Run: `runGsdTools('init plan-phase 1 --raw', tmpDir)`
    - Assert: output.milestone_scope === 'v14.0' (not 'v2.0')

    Run full test suite to verify no regressions.
  </action>
  <verify>
    <automated>node --test tests/init.test.cjs tests/core.test.cjs tests/routing.test.cjs 2>&1 | grep -E "^# (tests|pass|fail)"</automated>
  </verify>
  <done>All init integration tests pass. init plan-phase and init execute-phase correctly find phases in milestone workspaces even when concurrent:true is absent. Version resolution picks v14.0 over v2.0. Full test suite (58 original + 6 unit + 3 integration = 67 total) passes with 0 failures.</done>
</task>

</tasks>

<verification>
1. Run full test suite: `node --test tests/*.test.cjs` — all tests pass, 0 failures
2. Manual smoke test on the gsdup project itself: `node get-shit-done/bin/gsd-tools.cjs init plan-phase 3.1 --raw` returns phase_found:true
3. Verify no existing tests regressed by comparing pass count before (58 in core+routing) vs after
</verification>

<success_criteria>
- detectLayoutStyle() returns 'milestone-scoped' when `.planning/milestones/` contains version subdirs with STATE.md, regardless of concurrent flag
- resolveActiveMilestone() returns 'v14.0' over 'v2.0' (numeric sort, not lexicographic)
- All init commands (plan-phase, execute-phase, phase-op, verify-work) work correctly in milestone projects created via new-milestone workflow (no concurrent flag)
- Full test suite passes with 0 failures
</success_criteria>

<output>
After completion, create `.planning/quick/9-fix-gsd-tools-cjs-init-to-support-milest/9-SUMMARY.md`
</output>
