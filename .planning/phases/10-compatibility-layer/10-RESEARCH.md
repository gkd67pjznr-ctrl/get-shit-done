# Phase 10: Compatibility Layer - Research

**Researched:** 2026-02-24
**Domain:** Legacy project detection, routing, and backwards-compatibility verification for GSD v2.0
**Confidence:** HIGH — based entirely on first-party source analysis of core.cjs, init.cjs, tests/, and the existing v2.0 research artifacts in .planning/research/

---

## Summary

Phase 10 is the compatibility layer for old-style projects (`.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/phases/` at root-level). The core detection mechanism (`detectLayoutStyle`) and path resolution (`planningRoot`) were implemented in Phase 8. Phase 10's job is to expose that detection to more init commands, add tests for all three project state scenarios (including the critical "old-style with archive" edge case), and verify that existing old-style projects work unchanged through all code paths.

The central insight from codebase analysis: the compatibility layer is already partially working. When no `--milestone` flag is provided, `planningRoot(cwd, null)` returns `.planning/` — the legacy path. All init commands already return `.planning/` relative paths for old-style projects. What is missing is (1) `layout_style` not being returned by `cmdInitPlanPhase` and `cmdInitExecutePhase`, so workflows cannot branch on it, and (2) no tests for the "old-style project that already has a `.planning/milestones/` archive" scenario — which is the specific pitfall that the earlier research (PITFALLS.md Pitfall 4) calls out explicitly.

**Primary recommendation:** Add `layout_style` to `cmdInitPlanPhase` and `cmdInitExecutePhase` outputs, then add targeted tests for three project state scenarios: uninitialized, old-style (legacy), and old-style-with-archive. No routing changes are needed — planningRoot already handles this correctly.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COMPAT-01 | Old-style projects (root-level STATE.md, ROADMAP.md, phases/) auto-detected and routed through legacy code paths without migration | `detectLayoutStyle()` returns `'legacy'` for projects with config.json but no `concurrent: true`. `planningRoot(cwd, null)` returns `.planning/`. All init commands already return `.planning/` paths when no `--milestone` flag present. Routing is already implemented via Phase 8; Phase 10 adds tests proving it works and adds `layout_style` to init outputs so workflows can check. |
| COMPAT-02 | Detection uses explicit `concurrent: true` sentinel in config.json, not directory presence | Already implemented in Phase 8. `detectLayoutStyle()` reads only `config.json` — it does NOT check for `.planning/phases/` or `.planning/milestones/`. The sentinel-based design means old-style projects with existing `.planning/milestones/` archive directories (from prior `milestone complete` runs) correctly return `'legacy'`. Tests must verify the "old-style-with-archive" scenario. |
| COMPAT-03 | Compatibility is permanent — old-style projects are never forced to migrate | No migration logic exists or should be added. The system design means `'legacy'` is a permanent valid mode, not a transitional state. The `new-milestone` workflow does not modify old-style project structure when invoked on a legacy project. Tests must assert that old-style commands behave identically before and after the Phase 10 changes. |
</phase_requirements>

---

## What Is Already Done (Phase 8 Completed)

This section documents what Phase 10 does NOT need to implement, to avoid duplication:

| Component | Status | Evidence |
|-----------|--------|----------|
| `detectLayoutStyle(cwd)` in core.cjs | DONE | Reads `config.json`, returns `'legacy'`, `'milestone-scoped'`, or `'uninitialized'`. Tests in `tests/core.test.cjs` (11 tests, all passing). |
| `planningRoot(cwd, milestoneScope)` in core.cjs | DONE | Returns `.planning/milestones/<v>/` or `.planning/` based on truthiness of `milestoneScope`. Tests in `tests/core.test.cjs`. |
| `--milestone` CLI flag parsed by gsd-tools.cjs | DONE | Parses both `--milestone v2.0` and `--milestone=v2.0` forms. Sets `milestoneScope` threaded into init commands. Tests in `tests/init.test.cjs` (PATH-03 tests). |
| `cmdInitNewMilestone` returns `layout_style` | DONE | Returns `layout_style`, `milestones_dir`, `milestones_dir_exists`. Tests in `tests/milestone.test.cjs`. |
| Old-style `milestone complete` without workspace | DONE | `cmdMilestoneComplete` succeeds for old-style projects; `conflict_marked_complete: false`. Tests in `tests/milestone.test.cjs`. |

---

## Standard Stack

### Core (No new libraries needed)

This phase touches only existing modules and tests. No new npm dependencies.

| Module | File | Purpose |
|--------|------|---------|
| `core.cjs` | `get-shit-done/bin/lib/core.cjs` | `detectLayoutStyle()` and `planningRoot()` — already implemented |
| `init.cjs` | `get-shit-done/bin/lib/init.cjs` | `cmdInitPlanPhase` and `cmdInitExecutePhase` — need `layout_style` added to output |
| `tests/core.test.cjs` | `tests/core.test.cjs` | Tests for `detectLayoutStyle` — exists, may need "old-style-with-archive" scenario |
| `tests/init.test.cjs` | `tests/init.test.cjs` | Tests for `layout_style` in init plan-phase/execute-phase outputs |
| `tests/helpers.cjs` | `tests/helpers.cjs` | `createTempProject()` — do NOT modify; a `createLegacyProject()` helper may be needed for clarity |

**Installation:** No new packages. Uses Node.js built-in `fs`, `path`, `node:test`.

---

## Architecture Patterns

### Pattern 1: Three Project State Model

The system distinguishes three states for any project directory:

```
State 1: 'uninitialized'
  .planning/config.json: MISSING
  Result: detectLayoutStyle returns 'uninitialized'
  Routing: new-project workflow, not phase execution
  Test helper: createTempProject() (has .planning/phases/ but no config.json)

State 2: 'legacy'
  .planning/config.json: EXISTS, concurrent key ABSENT or false
  Result: detectLayoutStyle returns 'legacy'
  Routing: all commands use root .planning/ paths (default behavior)
  Test helper: need createLegacyProject() or inline setup with config.json write

State 3: 'milestone-scoped'
  .planning/config.json: EXISTS, concurrent: true
  Result: detectLayoutStyle returns 'milestone-scoped'
  Routing: commands use .planning/milestones/<v>/ paths via --milestone flag
  Test helper: need createConcurrentProject() (Phase 13 will formalize this)
```

The critical test scenario: **State 2 + archive**

An old-style project that has run `milestone complete` previously already has `.planning/milestones/` on disk (containing archived ROADMAPs like `v1.0-ROADMAP.md`, `v1.1-REQUIREMENTS.md`, and old-phase directories like `v1.0-phases/`). The detection MUST return `'legacy'` for this project, not `'milestone-scoped'`.

```javascript
// Scenario: old-style project with completed milestone archives
// .planning/config.json = { mode: 'yolo' }  (no concurrent: true)
// .planning/milestones/v1.0-ROADMAP.md EXISTS
// .planning/milestones/v1.0-phases/ EXISTS
// .planning/milestones/v1.1-phases/ EXISTS
// Expected: detectLayoutStyle(cwd) === 'legacy'  ✓ (already works)
```

This is documented in PITFALLS.md as Pitfall 4 and in the decisions log (`detectLayoutStyle reads config.json only — directory presence detection is forbidden`).

---

### Pattern 2: Adding layout_style to Init Outputs

`cmdInitPlanPhase` and `cmdInitExecutePhase` should expose `layout_style` so orchestrating workflows can branch on it. The pattern from `cmdInitNewMilestone`:

```javascript
// Current cmdInitNewMilestone (init.cjs line 258):
layout_style: detectLayoutStyle(cwd),

// To add to cmdInitPlanPhase and cmdInitExecutePhase:
// Import detectLayoutStyle (already imported in init.cjs)
// Add to result object:
layout_style: detectLayoutStyle(cwd),
```

Both functions already import `detectLayoutStyle` from `core.cjs` (line 8 of init.cjs). It's a one-line addition per function.

**Why expose it:** Workflows (plan-phase.md, execute-phase.md) get init JSON as their primary context object. If a workflow needs to branch on project style — e.g., "if legacy, use .planning/STATE.md; if milestone-scoped, use .planning/milestones/<v>/STATE.md" — it reads `layout_style` from init JSON. Without this field, the workflow has no way to know.

---

### Pattern 3: Test Coverage for Three-State Compatibility

Tests must cover three project states explicitly. The existing `createTempProject()` creates an `'uninitialized'` project (no config.json). For COMPAT tests:

```javascript
// Scenario A: Legacy project (config.json, no concurrent:true)
function createLegacyProject() {
  const tmpDir = createTempProject();  // creates .planning/phases/
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify({ mode: 'yolo', commit_docs: true }),
    'utf-8'
  );
  return tmpDir;
}

// Scenario B: Legacy project with milestone archives
function createLegacyProjectWithArchive() {
  const tmpDir = createLegacyProject();
  // Simulate previous milestone complete
  const milestonesDir = path.join(tmpDir, '.planning', 'milestones');
  fs.mkdirSync(path.join(milestonesDir, 'v1.0-phases'), { recursive: true });
  fs.writeFileSync(
    path.join(milestonesDir, 'v1.0-ROADMAP.md'),
    '# Roadmap v1.0\n'
  );
  return tmpDir;
}

// Scenario C: Milestone-scoped project (concurrent:true + workspace)
function createConcurrentProject() {
  const tmpDir = createTempProject();
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify({ concurrent: true }),
    'utf-8'
  );
  // Create an active workspace with STATE.md
  const workspaceDir = path.join(tmpDir, '.planning', 'milestones', 'v2.0');
  fs.mkdirSync(path.join(workspaceDir, 'phases'), { recursive: true });
  fs.writeFileSync(path.join(workspaceDir, 'STATE.md'), '# State\n');
  return tmpDir;
}
```

**NOTE:** `createConcurrentProject()` is also needed for Phase 13 (TEST-01). Phase 10 can add it to helpers.cjs or define it inline in the compat test file. Coordinate with Phase 13 planning — if adding to helpers.cjs, do it now so Phase 13 has it available.

---

### Pattern 4: Self-Hosted Compatibility Verification

The gsdup project itself IS an old-style project:
- Has `.planning/config.json` without `concurrent: true` → `detectLayoutStyle` returns `'legacy'`
- Has `.planning/phases/` with current phases
- Has `.planning/milestones/` with archived ROADMAPs (`v1.0`, `v1.1`, `v2.0-ROADMAP.md`) AND an active `v-test/` workspace

**Important:** gsdup has a `v-test` workspace directory in `.planning/milestones/v-test/` (with `STATE.md`, `ROADMAP.md`, etc.) — but `detectLayoutStyle` still returns `'legacy'` because config.json lacks `concurrent: true`. This is correct behavior per COMPAT-02.

```bash
# Actual gsdup project verification:
node get-shit-done/bin/gsd-tools.cjs init plan-phase 10
# Returns: layout_style: 'legacy' (after Phase 10 adds this field)
# Returns: state_path: '.planning/STATE.md'
# Returns: planning_root: '/Users/tmac/Projects/gsdup/.planning'
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Project state detection | Custom directory-presence checks | `detectLayoutStyle(cwd)` from core.cjs | Already implemented, tested, and uses the correct sentinel-based approach |
| Path resolution | String concatenation `.planning/milestones/` + version | `planningRoot(cwd, milestoneScope)` | Already handles both legacy and milestone-scoped paths |
| Test temp directories | New `fs.mkdtemp` calls in each test | Extend `helpers.cjs` helpers | Consistent cleanup, consistent scaffold |

**Key insight:** The detection and path logic is already correct. Phase 10 is integration/surfacing work, not new algorithm work.

---

## Common Pitfalls

### Pitfall 1: Directory-Presence Detection (Pitfall 4 from PITFALLS.md)

**What goes wrong:** Checking for `.planning/milestones/` directory to detect "new-style" project. Old-style projects that have run `milestone complete` already have this directory (for archives like `v1.0-ROADMAP.md`, `v1.0-phases/`).

**Why it happens:** Intuitive but wrong. The archive directory looks like a workspace directory.

**How to avoid:** Already avoided — `detectLayoutStyle` reads `config.json` for `concurrent: true` sentinel. Never add directory-presence checks to detection logic. The decision log in STATE.md says: "detectLayoutStyle reads config.json only — directory presence detection is forbidden."

**Warning signs:** `detectLayoutStyle` being passed a project that has `.planning/milestones/v1.0-phases/` and returning anything other than `'legacy'` when config.json lacks `concurrent: true`.

---

### Pitfall 2: Modifying createTempProject() (Pitfall 5 from PITFALLS.md)

**What goes wrong:** Adding `config.json` to `createTempProject()` to make it return `'legacy'` instead of `'uninitialized'`.

**Why it happens:** Wanting tests to use `'legacy'` project state for compatibility tests.

**How to avoid:** Do NOT modify `createTempProject()` — it's shared by 173 passing tests (176 total, 3 pre-existing failures in config tests). Any change breaks all of them. Add `createLegacyProject()` as a new helper function.

**Warning signs:** More than 3 test failures after any change to helpers.cjs.

---

### Pitfall 3: Not Testing the Archive Scenario

**What goes wrong:** Writing compatibility tests that only cover the "no milestones directory" old-style case. Missing the "has milestones/ from prior complete" case.

**Why it happens:** The "no milestones" case is simpler to construct.

**How to avoid:** Explicitly test the scenario in PITFALLS.md Pitfall 4: create a legacy project, add `.planning/milestones/v1.0-phases/` and `v1.0-ROADMAP.md`, verify `detectLayoutStyle` still returns `'legacy'`.

---

### Pitfall 4: layout_style Not In Execute-Phase Init

**What goes wrong:** Adding `layout_style` to `cmdInitPlanPhase` but forgetting `cmdInitExecutePhase`. The plan-phase workflow can branch on layout_style; execute-phase cannot.

**How to avoid:** Both `cmdInitPlanPhase` (line 87) and `cmdInitExecutePhase` (line 10) in init.cjs need the field. Add in the same PR.

---

## Code Examples

### detectLayoutStyle — Current Implementation

```javascript
// Source: get-shit-done/bin/lib/core.cjs (lines 410-422)
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
```

Returns: `'milestone-scoped'` | `'legacy'` | `'uninitialized'`

### Adding layout_style to cmdInitPlanPhase

```javascript
// Source: get-shit-done/bin/lib/init.cjs (cmdInitPlanPhase, around line 102)
const result = {
  // ... existing fields ...
  milestone_scope: milestoneScope || null,
  planning_root: planningRoot(cwd, milestoneScope),

  // ADD THESE:
  layout_style: detectLayoutStyle(cwd),   // 'legacy', 'milestone-scoped', or 'uninitialized'
};
```

`detectLayoutStyle` is already imported at line 8 of init.cjs — no new imports needed.

### Test: Legacy Detection with Archive

```javascript
// Tests for COMPAT-01, COMPAT-02, COMPAT-03
test('old-style project with milestone archive returns legacy', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-compat-test-'));

  // Scaffold old-style project
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify({ mode: 'yolo' }),
    'utf-8'
  );

  // Add milestone archive (simulates prior milestone complete)
  const milestonesDir = path.join(tmpDir, '.planning', 'milestones');
  fs.mkdirSync(path.join(milestonesDir, 'v1.0-phases'), { recursive: true });
  fs.writeFileSync(path.join(milestonesDir, 'v1.0-ROADMAP.md'), '# Roadmap v1.0\n', 'utf-8');

  // MUST return 'legacy', NOT 'milestone-scoped'
  assert.strictEqual(detectLayoutStyle(tmpDir), 'legacy');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
```

### Test: Init Plan-Phase Returns layout_style

```javascript
test('init plan-phase returns layout_style for legacy project', () => {
  // Set up legacy project (config.json without concurrent:true)
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify({ mode: 'yolo' }),
    'utf-8'
  );

  const result = runGsdTools('init plan-phase 1 --raw', tmpDir);
  assert.ok(result.success, `Command failed: ${result.error}`);
  const parsed = JSON.parse(result.output);

  assert.strictEqual(parsed.layout_style, 'legacy');
});

test('init execute-phase returns layout_style for legacy project', () => {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify({ mode: 'yolo' }),
    'utf-8'
  );

  const result = runGsdTools('init execute-phase 1 --raw', tmpDir);
  assert.ok(result.success, `Command failed: ${result.error}`);
  const parsed = JSON.parse(result.output);

  assert.strictEqual(parsed.layout_style, 'legacy');
});
```

---

## State of the Art

| Old Approach | Current Approach | Phase Implemented | Impact |
|--------------|------------------|-------------------|--------|
| No layout detection | `detectLayoutStyle()` returns `'legacy'`/`'milestone-scoped'`/`'uninitialized'` | Phase 8 | Old-style projects now have an identity |
| Directory-presence detection (pitfall) | Sentinel-based: reads `concurrent: true` in config.json | Phase 8 | Old-style projects with archives correctly route as `'legacy'` |
| `layout_style` only in `cmdInitNewMilestone` | After Phase 10: also in `cmdInitPlanPhase` and `cmdInitExecutePhase` | Phase 10 | Workflows can branch on project style |
| No compatibility tests | Three-state test coverage: uninitialized, legacy, legacy-with-archive | Phase 10 | Regression protection for old-style users |

**NOT yet done (Phase 12+):**
- Workflows actually branching on `layout_style` to route to milestone-scoped vs legacy paths
- `createConcurrentProject()` formalized in helpers.cjs (Phase 13 TEST-01)
- Full routing update for all commands (Phase 12 ROUTE-01 through ROUTE-05)

---

## Open Questions

1. **Should `createLegacyProject()` be added to helpers.cjs now or inline in tests?**
   - What we know: `createConcurrentProject()` is needed in Phase 13 (TEST-01). Both helpers have the same "should live in helpers.cjs" motivation.
   - What's unclear: Phase 10 could define these helpers inline in a new `compat.test.cjs` file, or add to helpers.cjs now.
   - Recommendation: Add both `createLegacyProject()` and `createConcurrentProject()` to helpers.cjs in Phase 10. Phase 13 (TEST-01) says "create `createConcurrentProject()` alongside existing `createTempProject()`" — Phase 10 can do this work early and Phase 13 tests just use it.

2. **Does `cmdInitResume` and other non-phase init commands need `layout_style`?**
   - What we know: `cmdInitResume`, `cmdInitProgress`, `cmdInitMilestoneOp`, `cmdInitQuick` don't return `layout_style` currently.
   - What's unclear: Do the resume-project, progress, health workflows need to branch on layout_style?
   - Recommendation: Only add to `cmdInitPlanPhase` and `cmdInitExecutePhase` for Phase 10 (these are the phase-execution init commands). Other init commands can be updated in Phase 12 when workflows are fully updated.

3. **Should the `v-test` workspace in gsdup's .planning/milestones/v-test/ be cleaned up?**
   - What we know: The v-test workspace exists from prior testing. gsdup's config.json lacks `concurrent: true`, so `detectLayoutStyle` returns `'legacy'` even with this workspace present.
   - What's unclear: Is v-test intentional or a leftover? It's in `.planning/milestones/v-test/` which is in git status as `??` (untracked).
   - Recommendation: Ignore for Phase 10 purposes — it doesn't affect compatibility routing. Clean up in a separate commit if desired.

---

## Validation Architecture

The config.json at `.planning/config.json` does NOT have `workflow.nyquist_validation: true` (the key is absent entirely). **Validation Architecture section is skipped per instructions.**

---

## Implementation Scope for Planning

Phase 10 is a **small, targeted phase** — approximately 1 plan with these tasks:

**Task group 1: Expose layout_style (code change)**
- Add `layout_style: detectLayoutStyle(cwd)` to `cmdInitPlanPhase` result object in `init.cjs`
- Add `layout_style: detectLayoutStyle(cwd)` to `cmdInitExecutePhase` result object in `init.cjs`

**Task group 2: Add compatibility tests (test-only)**
- Add to `tests/core.test.cjs` OR a new `tests/compat.test.cjs`:
  - Test: `detectLayoutStyle` returns `'legacy'` for old-style project with `.planning/milestones/` archive (the key pitfall scenario)
  - Test: `detectLayoutStyle` returns `'uninitialized'` for no config.json
  - Test: `detectLayoutStyle` returns `'legacy'` for config.json without `concurrent`
  - Test: `detectLayoutStyle` returns `'milestone-scoped'` for `concurrent: true`
- Add to `tests/init.test.cjs`:
  - Test: `init plan-phase` returns `layout_style: 'legacy'` for old-style project
  - Test: `init execute-phase` returns `layout_style: 'legacy'` for old-style project
  - Test: `init plan-phase` returns `layout_style: 'milestone-scoped'` for concurrent project
  - Test: old-style `init plan-phase` returns `.planning/` paths (not milestone-scoped paths)
- Add to `tests/helpers.cjs`:
  - `createLegacyProject()` — createTempProject + config.json without concurrent
  - `createConcurrentProject()` — for milestone-scoped scenario testing

**Task group 3: Regression verification**
- Run full test suite (173 currently passing) — all must still pass
- No changes to `createTempProject()` (must remain untouched)

**Estimated complexity:** 1 plan, ~2-3 waves. Task group 1 is 2-line code change. Task group 2 is the bulk (8-10 new tests). Task group 3 is verification.

---

## Sources

### Primary (HIGH confidence)
- Direct source analysis: `get-shit-done/bin/lib/core.cjs` — `detectLayoutStyle()` implementation (lines 410-422), `planningRoot()` implementation (lines 402-408)
- Direct source analysis: `get-shit-done/bin/lib/init.cjs` — `cmdInitNewMilestone` returns `layout_style` (line 258); `cmdInitPlanPhase` and `cmdInitExecutePhase` do NOT
- Direct source analysis: `tests/core.test.cjs` — 11 tests covering `planningRoot` and `detectLayoutStyle`, all passing
- Direct source analysis: `tests/helpers.cjs` — `createTempProject()` creates `'uninitialized'` layout (no config.json), must NOT be modified
- Direct source analysis: `.planning/research/PITFALLS.md` — Pitfall 4 (backward compat layer false detection) and Pitfall 5 (test suite breakage) are directly applicable
- Direct source analysis: `.planning/research/ARCHITECTURE.md` — Pattern 2 (compatibility detection via sentinel), Anti-Pattern 5 (no automatic migration)
- Runtime verification: `node gsd-tools.cjs init plan-phase 10 --cwd /Users/tmac/Projects/gsdup` returns `state_path: '.planning/STATE.md'` (correct legacy routing)
- Runtime verification: `node gsd-tools.cjs find-phase 10 --cwd /Users/tmac/Projects/gsdup` returns correct old-style phase directory
- Test baseline: 176 tests, 173 pass, 3 fail (pre-existing config test failures unrelated to compatibility)

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` decisions log: "detectLayoutStyle reads config.json only — directory presence detection is forbidden" (confirmed from Phase 8)
- `.planning/REQUIREMENTS.md` traceability: COMPAT-01, COMPAT-02, COMPAT-03 all mapped to Phase 10, all Pending

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all existing modules
- Architecture: HIGH — detectLayoutStyle/planningRoot already implemented and tested
- Pitfalls: HIGH — directly catalogued in .planning/research/PITFALLS.md with root causes
- Implementation scope: HIGH — verified by reading all relevant source files and running commands

**Research date:** 2026-02-24
**Valid until:** 2026-03-26 (stable codebase, 30-day window)
