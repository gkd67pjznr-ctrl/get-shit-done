---
phase: quick-7
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/bin/lib/init.cjs
  - tests/routing.test.cjs
autonomous: true
requirements: [BUG-01, BUG-02]

must_haves:
  truths:
    - "cmdInitPlanPhase returns phase_found: true and a valid phase_dir when the phase exists in ROADMAP but has no directory on disk"
    - "cmdInitExecutePhase returns phase_found: true and a valid phase_dir when the phase exists in ROADMAP but has no directory on disk"
    - "cmdInitProgress sorts phase directories numerically (2-foo before 10-bar) not alphabetically"
  artifacts:
    - path: "get-shit-done/bin/lib/init.cjs"
      provides: "Auto-create phase directory from ROADMAP fallback in cmdInitPlanPhase and cmdInitExecutePhase; numeric sort in cmdInitProgress"
      contains: "comparePhaseNum"
    - path: "tests/routing.test.cjs"
      provides: "Tests for both bugs"
      contains: "auto-creates phase directory"
  key_links:
    - from: "get-shit-done/bin/lib/init.cjs"
      to: "get-shit-done/bin/lib/core.cjs"
      via: "imports comparePhaseNum, getRoadmapPhaseInternal, generateSlugInternal, normalizePhaseName"
      pattern: "comparePhaseNum"
    - from: "get-shit-done/bin/lib/init.cjs (cmdInitPlanPhase)"
      to: "getRoadmapPhaseInternal"
      via: "fallback when findPhaseInternal returns null"
      pattern: "getRoadmapPhaseInternal.*phase.*effectiveScope"
---

<objective>
Fix two bugs in init.cjs that cause phase detection failures in milestone-scoped projects.

Purpose: When a phase exists in ROADMAP.md but has no directory on disk (hasn't been planned yet), cmdInitPlanPhase and cmdInitExecutePhase should auto-create the directory and return phase_found: true. Additionally, cmdInitProgress should sort directories numerically, not alphabetically.

Output: Patched init.cjs with both fixes, plus tests covering both bugs.
</objective>

<execution_context>
@/Users/tmac/.claude/get-shit-done/workflows/execute-plan.md
@/Users/tmac/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@get-shit-done/bin/lib/init.cjs
@get-shit-done/bin/lib/core.cjs
@tests/routing.test.cjs
@tests/helpers.cjs

<interfaces>
<!-- From get-shit-done/bin/lib/core.cjs — functions the executor needs -->

```javascript
// Already imported in init.cjs (line 8):
// loadConfig, resolveModelInternal, findPhaseInternal, getRoadmapPhaseInternal,
// pathExistsInternal, generateSlugInternal, getMilestoneInfo, normalizePhaseName,
// planningRoot, detectLayoutStyle, output, error

// NOT YET imported in init.cjs but needed:
function comparePhaseNum(a, b) // numeric phase sorting, exported from core.cjs

// getRoadmapPhaseInternal returns:
// { found: true, phase_number: string, phase_name: string, goal: string, section: string } | null

// generateSlugInternal returns: lowercase-hyphenated string | null
// normalizePhaseName returns: padded phase number string (e.g., "77" -> "77", "3" -> "03", "3.1" -> "3.1")
```

<!-- From cmdInitPhaseOp (init.cjs lines 417-436) — existing fallback pattern to replicate -->

```javascript
// This is the existing pattern in cmdInitPhaseOp that we need to adapt:
if (!phaseInfo) {
  const roadmapPhase = getRoadmapPhaseInternal(cwd, phase, effectiveScope);
  if (roadmapPhase?.found) {
    const phaseName = roadmapPhase.phase_name;
    phaseInfo = {
      found: true,
      directory: null,
      phase_number: roadmapPhase.phase_number,
      phase_name: phaseName,
      phase_slug: phaseName ? phaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : null,
      plans: [],
      summaries: [],
      incomplete_plans: [],
      has_research: false,
      has_context: false,
      has_verification: false,
    };
  }
}
```

<!-- From cmdPhaseAdd (phase.cjs lines 351-356) — directory creation pattern -->

```javascript
const dirName = `${paddedNum}-${slug}`;
const dirPath = path.join(root, 'phases', dirName);
fs.mkdirSync(dirPath, { recursive: true });
fs.writeFileSync(path.join(dirPath, '.gitkeep'), '');
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add ROADMAP fallback with auto-create to cmdInitPlanPhase and cmdInitExecutePhase, fix numeric sort in cmdInitProgress</name>
  <files>get-shit-done/bin/lib/init.cjs, tests/routing.test.cjs</files>
  <behavior>
    - Test: cmdInitPlanPhase with --milestone returns phase_found: true when phase exists in ROADMAP but has no directory — directory is auto-created on disk
    - Test: cmdInitPlanPhase auto-created directory contains .gitkeep
    - Test: cmdInitPlanPhase auto-created directory name follows normalized pattern (e.g., "77-some-phase-name")
    - Test: cmdInitExecutePhase with --milestone returns phase_found: true when phase exists in ROADMAP but has no directory — directory is auto-created on disk
    - Test: cmdInitProgress sorts directories numerically (phase "2-foo" before "10-bar"), not alphabetically ("10-bar" before "2-foo")
  </behavior>
  <action>
**Part A — Add `comparePhaseNum` to imports (line 8 of init.cjs):**

Add `comparePhaseNum` to the destructured require from `./core.cjs`. The current import is:
```javascript
const { loadConfig, resolveModelInternal, findPhaseInternal, getRoadmapPhaseInternal, pathExistsInternal, generateSlugInternal, getMilestoneInfo, normalizePhaseName, planningRoot, detectLayoutStyle, output, error } = require('./core.cjs');
```
Add `comparePhaseNum` after `normalizePhaseName`.

**Part B — Patch `cmdInitPlanPhase` (after line 100, after `const phaseInfo = findPhaseInternal(...)`):**

When `phaseInfo` is null, add a ROADMAP fallback that:
1. Queries `getRoadmapPhaseInternal(cwd, phase, milestoneScope)` (note: use `milestoneScope` here, not `effectiveScope`, since `effectiveScope` depends on `phaseInfo` which is null)
2. If ROADMAP phase is found:
   a. Generate slug from `roadmapPhase.phase_name` using `generateSlugInternal`
   b. Generate normalized phase number using `normalizePhaseName(roadmapPhase.phase_number)`
   c. Build directory name: `${normalized}-${slug}`
   d. Build directory path: `path.join(planningRoot(cwd, milestoneScope), 'phases', dirName)`
   e. Create directory with `fs.mkdirSync(dirPath, { recursive: true })`
   f. Create .gitkeep: `fs.writeFileSync(path.join(dirPath, '.gitkeep'), '')`
   g. Re-query: `phaseInfo = findPhaseInternal(cwd, phase, milestoneScope)` — this now finds the just-created directory and populates all fields correctly

This ensures all downstream code (effectiveScope, padded_phase, etc.) works exactly as if the directory had existed all along.

**Part C — Patch `cmdInitExecutePhase` (after line 16, after `const phaseInfo = findPhaseInternal(...)`):**

Apply the exact same fallback pattern as Part B. Use `milestoneScope` for the ROADMAP query and directory creation, then re-query `findPhaseInternal`.

**Part D — Fix `cmdInitProgress` numeric sort (line 676):**

Change:
```javascript
const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
```
To:
```javascript
const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort((a, b) => comparePhaseNum(a, b));
```

**Part E — Write tests in tests/routing.test.cjs:**

Add three new test groups at the bottom of the file (before the closing):

Group: "BUG-01: cmdInitPlanPhase auto-creates phase directory from ROADMAP":
- Setup: `createConcurrentProject('v12.0')`, write a ROADMAP.md in the v12.0 workspace containing `### Phase 77: Deploy Infrastructure` with a Goal line. Do NOT create a `77-deploy-infrastructure` directory.
- Test 1: Run `['--milestone', 'v12.0', 'init', 'plan-phase', '77', '--raw']`. Assert `output.phase_found === true`. Assert `output.phase_dir` is not null and contains `milestones/v12.0`. Assert `output.phase_name` equals `'Deploy Infrastructure'`.
- Test 2: Assert the directory `output.phase_dir` actually exists on disk (use `fs.existsSync`).
- Test 3: Assert a `.gitkeep` file exists in the auto-created directory.

Group: "BUG-01: cmdInitExecutePhase auto-creates phase directory from ROADMAP":
- Setup: Same as above (createConcurrentProject + ROADMAP with Phase 77).
- Test 1: Run `['--milestone', 'v12.0', 'init', 'execute-phase', '77', '--raw']`. Assert `output.phase_found === true`. Assert `output.phase_dir` is not null.

Group: "BUG-02: cmdInitProgress sorts phases numerically":
- Setup: `createConcurrentProject('v5.0')`. Create directories in the v5.0 phases dir: `2-alpha`, `10-beta`, `3-gamma`. No plan files needed (they'll show as 'pending').
- Test 1: Run `['--milestone', 'v5.0', 'init', 'progress', '--raw']`. Parse output. Assert `output.phases[0].number === '2'`. Assert `output.phases[1].number === '3'`. Assert `output.phases[2].number === '10'`.
  </action>
  <verify>
    <automated>cd /Users/tmac/Projects/gsdup && node --test tests/routing.test.cjs 2>&1 | tail -20</automated>
  </verify>
  <done>
    - cmdInitPlanPhase returns phase_found: true and auto-creates directory when phase is in ROADMAP but not on disk
    - cmdInitExecutePhase returns phase_found: true and auto-creates directory when phase is in ROADMAP but not on disk
    - cmdInitProgress sorts phase directories numerically (2 before 10)
    - All existing tests continue to pass
    - New tests cover both bugs
  </done>
</task>

</tasks>

<verification>
```bash
# Run all test files to ensure no regressions
node --test tests/routing.test.cjs
node --test tests/roadmap.test.cjs

# Quick smoke test: the import of comparePhaseNum should not break anything
node -e "const init = require('./get-shit-done/bin/lib/init.cjs'); console.log('init module loads OK')"
```
</verification>

<success_criteria>
- Both bugs fixed in init.cjs
- Tests pass for auto-directory-creation in cmdInitPlanPhase and cmdInitExecutePhase
- Tests pass for numeric sorting in cmdInitProgress
- All pre-existing tests in routing.test.cjs and roadmap.test.cjs continue to pass
- No regressions in module loading
</success_criteria>

<output>
After completion, create `.planning/quick/7-fix-next-phase-detection-path-mismatch-i/7-SUMMARY.md`
</output>
