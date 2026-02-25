# Phase 13: Test Coverage - Research

**Researched:** 2026-02-24
**Domain:** Node.js built-in test runner, test coverage, concurrent milestone path validation
**Confidence:** HIGH

## Summary

Phase 13 adds comprehensive test coverage for all v2.0 concurrent milestone functionality. The project already uses the Node.js built-in test runner (`node --test`) with CommonJS test files, and all helper infrastructure — including the critical `createConcurrentProject()` helper (TEST-01) — is already implemented in `tests/helpers.cjs`. Phase 14 (integration wiring fix) is already complete, so the code under test is stable.

The primary work is writing new tests, not new test infrastructure. Analysis of the existing test files against the six requirements reveals that TEST-01 (`createConcurrentProject`) and TEST-03 (three-state detection) have substantial existing coverage in `compat.test.cjs`, `routing.test.cjs`, and `dashboard.test.cjs`. The gaps are: TEST-02 (milestone-scoped path resolution in both layouts — partially covered), TEST-04 (conflict manifest overlap detection — covered in `dashboard.test.cjs`), TEST-05 (90%+ branch coverage on new `planningRoot`/`detectLayoutStyle` functions — partially covered in `core.test.cjs`), and TEST-06 (end-to-end plan→execute→verify in both layout modes — no existing E2E test file).

The three failing tests in the existing suite (`config quality section`, `config auto-migration`) are pre-existing and unrelated to Phase 13's requirements. They should not be touched unless they collide with Phase 13 test structure.

**Primary recommendation:** Create one new test file (`tests/e2e.test.cjs`) covering TEST-06, and add targeted branch-coverage tests to existing files to satisfy TEST-05. All other requirements are already met by existing tests.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEST-01 | `createConcurrentProject()` test helper created alongside existing `createTempProject()` | Already implemented in `tests/helpers.cjs` at line 71. Exported and used in `compat.test.cjs`, `routing.test.cjs`, `dashboard.test.cjs`. No new work needed. |
| TEST-02 | Tests for milestone-scoped path resolution in both old-style and new-style layouts | `core.test.cjs` covers `planningRoot` with null/undefined/v2.0/v1.1 inputs. `compat.test.cjs` Group 3 covers legacy paths. `routing.test.cjs` Groups 1-5 cover milestone-scoped path fields (planning_root, state_path) via all init commands. Coverage is complete; verify against branch matrix below. |
| TEST-03 | Tests for compatibility detection across all three states (new project, old-with-archives, new-style concurrent) | `core.test.cjs` covers all three states. `compat.test.cjs` Group 1 covers all three states including the old-with-archive-dirs pitfall (COMPAT-02 key pitfall test). Complete. |
| TEST-04 | Tests for conflict manifest overlap detection | `dashboard.test.cjs` `cmdManifestCheck` describe block covers: no conflict, overlap detection, completed milestone exclusion, empty milestones dir, and advisory-only exit 0. Complete. |
| TEST-05 | 90%+ branch coverage on new functions in core.cjs and commands.cjs | Gaps identified (see Architecture Patterns). Requires additional tests for `planningRoot` empty-string branch, `detectLayoutStyle` with missing `concurrent` key in valid JSON vs. malformed JSON distinction, and branches in `cmdProgressRenderMulti` (no STATUS.md milestones, table format). |
| TEST-06 | End-to-end test executing plan→execute→verify in both layout modes | No E2E test file exists. Requires new `tests/e2e.test.cjs`. Full flow: legacy mode and milestone-scoped mode. Uses `runGsdToolsFull` with the real CLI binary against a temp project. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:test` | Node.js built-in (>=18) | Test runner | Already in use across all test files; no install needed |
| `node:assert` | Built-in | Assertions | Already in use; `assert/strict` preferred for equality |
| `child_process` (spawnSync/execSync) | Built-in | CLI subprocess testing | Required pattern — gsd-tools commands call `process.exit()` so direct require is forbidden |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `helpers.cjs` | Project | Shared test utilities | All test files; exports `runGsdTools`, `runGsdToolsFull`, `createTempProject`, `createLegacyProject`, `createConcurrentProject`, `cleanup`, `TOOLS_PATH` |
| `fs`, `path`, `os` | Built-in | File system manipulation | Setting up temp project scaffolds |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node --test` | Jest, Mocha, Vitest | Project is already committed to built-in runner; zero-dependency is intentional for an npm package with no runtime deps |
| Direct require of lib modules | CLI subprocess via `spawnSync` | Direct require works for library functions (core.cjs, milestone.cjs, etc.) but NOT for commands that call `output()`/`error()` (which call `process.exit()`) |

**Installation:** None required. All dependencies are built-in Node.js modules.

## Architecture Patterns

### Recommended Project Structure
```
tests/
├── helpers.cjs          # Shared helpers — DO NOT add new helpers without checking here first
├── core.test.cjs        # planningRoot, detectLayoutStyle (branch gaps to fill here)
├── compat.test.cjs      # Three-state detection, layout_style in init commands
├── routing.test.cjs     # ROUTE-02, PHASE-03 milestone routing
├── dashboard.test.cjs   # cmdMilestoneWriteStatus, cmdManifestCheck, cmdProgressRenderMulti
├── milestone.test.cjs   # milestone new-workspace, update-manifest, complete
├── e2e.test.cjs         # NEW — TEST-06 end-to-end plan→execute→verify (both modes)
└── [existing tests]     # commands.test.cjs, init.test.cjs, etc.
```

### Pattern 1: Subprocess Pattern for Commands That Call process.exit()
**What:** Any command routed through `output()` or `error()` in core.cjs calls `process.exit()`. Direct `require()` of the lib module in the test process kills the test runner. Use `spawnSync` subprocess.
**When to use:** All CLI command tests. Direct library function tests (like `planningRoot`, `detectLayoutStyle`) can use direct require.
**Example:**
```javascript
// Source: tests/milestone.test.cjs (established pattern)
const { spawnSync } = require('child_process');
const LIB_PATH = path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'milestone.cjs');

function runNewWorkspace(cwd, version) {
  const script = `
    const m = require(${JSON.stringify(LIB_PATH)});
    m.cmdMilestoneNewWorkspace(${JSON.stringify(cwd)}, ${JSON.stringify(version)}, {}, true);
  `;
  return spawnSync(process.execPath, ['-e', script], { encoding: 'utf-8' });
}
```

### Pattern 2: CLI Routing via runGsdToolsFull
**What:** Full CLI invocation through the gsd-tools.cjs binary using `runGsdToolsFull`. Returns `{ success, output, stderr, error }`.
**When to use:** Integration and E2E tests that must exercise the full CLI routing layer (--milestone flag parsing, command dispatch, output serialization).
**Example:**
```javascript
// Source: tests/routing.test.cjs (established pattern)
const { runGsdToolsFull, createConcurrentProject, cleanup } = require('./helpers.cjs');

const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'phase-op', '1', '--raw'], tmpDir);
assert.ok(result.success, `Command failed: ${result.stderr}`);
const output = JSON.parse(result.output);
assert.strictEqual(output.milestone_scope, 'v2.0');
```

### Pattern 3: Direct Library Function Testing
**What:** Import library functions directly for pure unit testing of core.cjs functions without subprocess overhead.
**When to use:** `planningRoot`, `detectLayoutStyle`, and other non-output functions.
**Example:**
```javascript
// Source: tests/core.test.cjs (established pattern)
const { planningRoot, detectLayoutStyle } = require('../get-shit-done/bin/lib/core.cjs');

test('returns milestone-scoped path for v2.0', () => {
  const result = planningRoot(tmpDir, 'v2.0');
  assert.strictEqual(result, path.join(tmpDir, '.planning', 'milestones', 'v2.0'));
});
```

### Pattern 4: before/after vs. beforeEach/afterEach
**What:** When all tests in a describe share a single read-only fixture, use `before`/`after`. When tests mutate the temp dir, use `beforeEach`/`afterEach`.
**When to use:** E2E tests that build up state progressively should use `before`; tests that each need a clean slate use `beforeEach`.
**Example:**
```javascript
// Source: tests/routing.test.cjs (established pattern — shared fixture)
describe('ROUTE-02: init phase-op with --milestone', () => {
  let tmpDir;
  before(() => { tmpDir = createConcurrentProject('v2.0'); /* scaffold once */ });
  after(() => { cleanup(tmpDir); });
  test('...', () => { /* read-only assertions */ });
});
```

### Pattern 5: E2E Test Structure (TEST-06)
**What:** Test the full plan→execute→verify lifecycle by scaffolding a minimal project, running real CLI commands, and asserting file system state.
**When to use:** TEST-06 only. The E2E test must cover both legacy mode and milestone-scoped mode.
**Example approach:**
```javascript
// tests/e2e.test.cjs — new file
// Legacy mode: createLegacyProject() or createTempProject() with STATE.md + ROADMAP.md
// Milestone mode: createConcurrentProject('v2.0') with workspace STATE.md + ROADMAP.md
// Test flow per mode:
//   1. init plan-phase → verify returns correct layout_style and paths
//   2. init execute-phase → verify returns correct plans/paths
//   3. Create PLAN.md + SUMMARY.md in correct directory
//   4. phase complete → verify ROADMAP.md updated in correct location
//   5. Assert: legacy mode writes to .planning/, milestone mode writes to .planning/milestones/v2.0/
```

### Branch Coverage Gaps in core.cjs and commands.cjs

These are the uncovered branches identified from reading the source code. Phase 13 tests must close them.

**`planningRoot` in core.cjs (lines 402-408):**
| Branch | Covered By | Gap? |
|--------|-----------|------|
| `milestoneScope` is null | `core.test.cjs` | No gap |
| `milestoneScope` is undefined | `core.test.cjs` | No gap |
| `milestoneScope` is empty string `''` | None | GAP — truthy check fails for empty string |
| `milestoneScope` is 'v2.0' | `core.test.cjs` | No gap |
| `milestoneScope` is 'v1.1' | `core.test.cjs` | No gap |

**`detectLayoutStyle` in core.cjs (lines 410-422):**
| Branch | Covered By | Gap? |
|--------|-----------|------|
| config.json does not exist (catch block) | `core.test.cjs` | No gap |
| `concurrent === true` | `core.test.cjs` | No gap |
| valid JSON, no `concurrent` key | `core.test.cjs` | No gap |
| `concurrent: false` | `core.test.cjs` | No gap |
| invalid JSON (catch block) | `core.test.cjs` | No gap |
| `concurrent` is a non-boolean truthy value (e.g. `"yes"`) | None | GAP — === true check, non-boolean truthy falls to 'legacy' |

**`cmdProgressRenderMulti` in commands.cjs (lines 469-512):**
| Branch | Covered By | Gap? |
|--------|-----------|------|
| `layoutStyle !== 'milestone-scoped'` → delegates to `cmdProgressRender` | `dashboard.test.cjs` | No gap |
| milestone-scoped with STATUS.md present, JSON format | `dashboard.test.cjs` | No gap |
| milestone-scoped with STATUS.md present, table format | `dashboard.test.cjs` | No gap |
| milestone-scoped with NO STATUS.md (empty milestones array) | None | GAP — milestone dir exists but no STATUS.md |
| milestones dir does not exist | None | GAP — catch block returns empty array |

### Anti-Patterns to Avoid
- **Direct require of output-calling modules in test process:** `require('../get-shit-done/bin/lib/commands.cjs').cmdProgressRenderMulti(...)` will call `process.exit()` and kill the test runner. Use `spawnSync` subprocess pattern instead.
- **Mutating shared before() fixture:** If tests in a `before/after` suite modify the temp dir, subsequent tests will see stale state. Use `beforeEach/afterEach` when tests write files.
- **Hardcoding cwd as process.cwd():** Tests run from the project root. Always pass `tmpDir` as cwd to `runGsdToolsFull` and `runGsdTools`.
- **Asserting planning_root by string contains alone:** Use `path.join` for cross-platform correctness. The existing pattern `output.planning_root.includes('milestones/v2.0')` is acceptable but fragile on Windows (not a concern here — macOS only).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Temp directory creation | Custom mkdtemp logic | `createTempProject()` / `createLegacyProject()` / `createConcurrentProject()` from helpers.cjs | Helpers already handle os.tmpdir, directory structure, cleanup |
| CLI invocation | Custom spawn wrapper | `runGsdTools` / `runGsdToolsFull` from helpers.cjs | Handles stdio capture, exit code, spawnSync/execSync selection |
| Branch coverage measurement | Custom instrumentation | `node --test` with manual branch analysis | No coverage tool is in use; coverage is validated by test count and branch enumeration |

**Key insight:** All test infrastructure already exists. The entire Phase 13 implementation is writing new test cases using existing helpers, not building new tools.

## Common Pitfalls

### Pitfall 1: Testing Milestone-Scoped Path Resolution Without --milestone Flag
**What goes wrong:** Test sends `init plan-phase 1` without `--milestone v2.0` and expects milestone-scoped paths. The command returns legacy paths because `--milestone` must precede the subcommand.
**Why it happens:** CLI flag order matters — `--milestone` is a global flag parsed before the command name. `node gsd-tools.cjs --milestone v2.0 init plan-phase 1` is correct; `node gsd-tools.cjs init plan-phase 1 --milestone v2.0` may not work.
**How to avoid:** Always use `['--milestone', 'v2.0', 'init', 'plan-phase', '1', '--raw']` array format. See routing.test.cjs for verified examples.
**Warning signs:** `output.milestone_scope === null` when you expected `'v2.0'`; `output.planning_root` doesn't contain `milestones/v2.0`.

### Pitfall 2: Concurrent Project Missing Required Workspace Files
**What goes wrong:** `createConcurrentProject('v2.0')` creates STATE.md and ROADMAP.md in the workspace but not REQUIREMENTS.md. Some init commands may look for REQUIREMENTS.md.
**Why it happens:** `createConcurrentProject` scaffolds a minimal workspace. Tests that need full workspace content must add files explicitly (as routing.test.cjs does: `fs.writeFileSync(path.join(workspaceDir, 'ROADMAP.md'), ROADMAP_CONTENT, 'utf-8')`).
**How to avoid:** Check what scaffold files the command under test requires before writing assertions. Follow the pattern in routing.test.cjs Group 6 which explicitly writes ROADMAP.md and STATE.md.
**Warning signs:** Commands return `roadmap_exists: false` or fail with 'ROADMAP.md not found'.

### Pitfall 3: Phase Complete Test Interference (shared fixture)
**What goes wrong:** The `phase complete --milestone v2.0` command marks ROADMAP.md's phase as `[x]`. A second call in a different test will see the already-completed phase and may behave differently.
**Why it happens:** routing.test.cjs Group 6 uses `before()` shared fixture. The phase complete test modifies ROADMAP.md. Subsequent test calls see `[x]` already present.
**How to avoid:** For tests that modify shared state, use `beforeEach/afterEach` or accept idempotent behavior explicitly (as routing.test.cjs does with the comment "already marked complete is idempotent-ish").
**Warning signs:** Second phase-complete call returns unexpected values; ROADMAP.md already has `[x]`.

### Pitfall 4: E2E Test Executing Real Workflows That Need Git
**What goes wrong:** `phase complete` calls `execGit` internally for ROADMAP.md updates. Without a git repo in the temp dir, some git-related operations fail silently (the code catches git errors).
**Why it happens:** `execGit` in core.cjs wraps git calls in try/catch and returns exit code — it doesn't throw. Phase complete doesn't require git for its core function (updating ROADMAP.md), so it succeeds even without a git repo.
**How to avoid:** E2E tests don't need a git repo in tmpDir. The ROADMAP.md update via `phase complete` works without git because it's a file write, not a git operation.
**Warning signs:** `phase complete` fails with git-related error in stderr (check `result.stderr` on failure).

### Pitfall 5: 3 Pre-existing Test Failures
**What goes wrong:** `config quality section` and `config auto-migration` suites have 3 failing tests expecting `quality.level === 'fast'` but getting `'standard'`. These are pre-existing failures unrelated to Phase 13.
**Why it happens:** The project's own config.json has `quality: { level: 'standard' }` which may be leaking into test execution.
**How to avoid:** Do not attempt to fix these failures in Phase 13. They are out of scope. Do not write tests that depend on the default quality level being 'fast' in a fresh project without explicit config setup.
**Warning signs:** Tests that call `config-ensure-section` without explicitly setting up a clean config first.

## Code Examples

Verified patterns from existing test files:

### Create a Concurrent Project and Run a Milestone-Scoped Init Command
```javascript
// Source: tests/routing.test.cjs, Group 1
const { createConcurrentProject, runGsdToolsFull, cleanup } = require('./helpers.cjs');

describe('ROUTE-02: init phase-op with --milestone', () => {
  let tmpDir;

  before(() => {
    tmpDir = createConcurrentProject('v2.0');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'milestones', 'v2.0', 'phases', '01-test'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-test'), { recursive: true });
  });

  after(() => { cleanup(tmpDir); });

  test('returns milestone_scope when --milestone provided', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'phase-op', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.milestone_scope, 'v2.0');
  });
});
```

### Direct Library Function Test for Branch Coverage
```javascript
// Source: tests/core.test.cjs
const { planningRoot, detectLayoutStyle } = require('../get-shit-done/bin/lib/core.cjs');

test('returns legacy path when second arg is empty string', () => {
  // Empty string is falsy — should behave same as null
  const result = planningRoot(tmpDir, '');
  assert.strictEqual(result, path.join(tmpDir, '.planning'));
});

test('non-boolean truthy concurrent value returns legacy', () => {
  const configPath = path.join(tmpDir, '.planning', 'config.json');
  fs.writeFileSync(configPath, JSON.stringify({ concurrent: 'yes' }), 'utf-8');
  const result = detectLayoutStyle(tmpDir);
  assert.strictEqual(result, 'legacy', 'only boolean true triggers milestone-scoped');
});
```

### E2E Legacy Mode Flow
```javascript
// Source: NEW — tests/e2e.test.cjs
describe('E2E: legacy mode plan→execute→verify', () => {
  let tmpDir;

  before(() => {
    tmpDir = createLegacyProject();
    // Scaffold minimal legacy project
    const ROADMAP = `# Roadmap\n\n- [ ] Phase 1: E2E Test Phase\n\n### Phase 1: E2E Test Phase\n**Goal:** E2E test\n**Requirements:** [E2E-01]\n**Plans:** 0 plans\n`;
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), ROADMAP, 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n', 'utf-8');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-e2e-test-phase'), { recursive: true });
  });

  after(() => { cleanup(tmpDir); });

  test('init plan-phase returns legacy layout_style', () => {
    const result = runGsdToolsFull(['init', 'plan-phase', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Failed: ${result.stderr}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.layout_style, 'legacy');
    assert.ok(out.planning_root.endsWith('/.planning'), `planning_root wrong: ${out.planning_root}`);
    assert.strictEqual(out.milestone_scope, null);
  });

  test('init execute-phase returns legacy paths', () => {
    const result = runGsdToolsFull(['init', 'execute-phase', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Failed: ${result.stderr}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.layout_style, 'legacy');
    assert.strictEqual(out.state_path, '.planning/STATE.md');
  });
});
```

### E2E Milestone-Scoped Mode Flow
```javascript
// Source: NEW — tests/e2e.test.cjs
describe('E2E: milestone-scoped mode plan→execute→verify', () => {
  let tmpDir;

  before(() => {
    tmpDir = createConcurrentProject('v2.0');
    const workspaceDir = path.join(tmpDir, '.planning', 'milestones', 'v2.0');
    const ROADMAP = `# Roadmap\n\n- [ ] Phase 1: E2E Test Phase\n\n### Phase 1: E2E Test Phase\n**Goal:** E2E test\n**Requirements:** [E2E-01]\n**Plans:** 1 plans\n\n| Phase | Status | Date |\n|-------|--------|------|\n| 1. E2E Test Phase | Planned | - |\n`;
    fs.writeFileSync(path.join(workspaceDir, 'ROADMAP.md'), ROADMAP, 'utf-8');
    fs.writeFileSync(
      path.join(workspaceDir, 'STATE.md'),
      '# State\n\n**Current Phase:** 1\n**Current Plan:** 01\n**Status:** Active\n**Current Phase Name:** E2E Test Phase\n**Last Activity:** 2026-01-01\n**Last Activity Description:** Testing\n',
      'utf-8'
    );
    const phaseDir = path.join(workspaceDir, 'phases', '01-e2e-test-phase');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '---\nphase: 1\nplan: 01\n---\n# Plan\n', 'utf-8');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary\n', 'utf-8');
    // Also create root phases dir for --milestone routing (phase-op needs phases dir at root too)
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-e2e-test-phase'), { recursive: true });
  });

  after(() => { cleanup(tmpDir); });

  test('init plan-phase with --milestone returns milestone-scoped layout_style', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'plan-phase', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Failed: ${result.stderr}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.layout_style, 'milestone-scoped');
    assert.ok(out.planning_root.includes('milestones/v2.0'), `planning_root wrong: ${out.planning_root}`);
    assert.strictEqual(out.milestone_scope, 'v2.0');
  });

  test('init execute-phase with --milestone returns milestone workspace paths', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'execute-phase', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Failed: ${result.stderr}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.layout_style, 'milestone-scoped');
    assert.ok(out.state_path.includes('milestones/v2.0'), `state_path wrong: ${out.state_path}`);
  });

  test('phase complete with --milestone updates milestone workspace ROADMAP.md', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'phase', 'complete', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Failed: ${result.stderr}`);
    const roadmap = fs.readFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v2.0', 'ROADMAP.md'), 'utf-8'
    );
    assert.ok(roadmap.includes('[x]'), 'milestone workspace ROADMAP.md must show [x] completion');
  });

  test('phase complete with --milestone does NOT modify root ROADMAP.md', () => {
    const rootRoadmap = path.join(tmpDir, '.planning', 'ROADMAP.md');
    // Root ROADMAP.md should not exist (concurrent project has no root ROADMAP)
    // or if it does exist, must be unmodified
    if (fs.existsSync(rootRoadmap)) {
      const content = fs.readFileSync(rootRoadmap, 'utf-8');
      assert.ok(!content.includes('[x]'), 'root ROADMAP.md must not be modified');
    }
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All tests in one file | Separate test files per domain | From start | Better isolation, faster to find related tests |
| `execSync` only (runGsdTools) | `spawnSync` (runGsdToolsFull) added | Phase 09 | Required for commands that call `process.exit()` — cannot use execSync which throws on nonzero exit |
| Single layout mode (`createTempProject`) | Three helpers: Temp/Legacy/Concurrent | Phase 10 → Phase 13 | Explicit layout semantics in test scaffolding |

**Deprecated/outdated:**
- Using `execSync`-based `runGsdTools` for commands that can exit with code 1: These tests succeed but cannot capture stderr. Use `runGsdToolsFull` for any command that may fail.

## Open Questions

1. **Should the E2E test also validate `write-status` checkpoint behavior?**
   - What we know: Phase 14 wired `write-status` calls into execute-phase.md and plan-phase.md workflows (bash files, not CLI commands). The CLI command `milestone write-status` is already tested in `dashboard.test.cjs`.
   - What's unclear: TEST-06 says "end-to-end test executing plan→execute→verify" — this likely means the init commands and phase complete, not the workflow files themselves (which are bash templates run by Claude).
   - Recommendation: Test the CLI commands (init plan-phase, init execute-phase, phase complete) in both modes. Do not attempt to simulate full bash workflow execution.

2. **Should Phase 13 fix the 3 pre-existing test failures?**
   - What we know: 3 tests in `init.test.cjs` fail with `quality.level` returning 'standard' instead of 'fast'. These are pre-existing, unrelated to Phase 13 requirements.
   - What's unclear: Whether the planner will be asked to include a fix for these.
   - Recommendation: Scope Phase 13 to TEST-01 through TEST-06 only. Document the pre-existing failures. Do not fix them unless explicitly added to scope.

3. **What constitutes 90%+ branch coverage for TEST-05?**
   - What we know: No coverage tooling (c8, nyc, istanbul) is configured. The requirement is stated as a goal, not enforced by tooling.
   - What's unclear: How to measure. Manual branch enumeration is the only option.
   - Recommendation: Enumerate all branches in `planningRoot` and `detectLayoutStyle` (done above in Architecture Patterns), write tests for each identified gap, and declare coverage complete by inspection.

## Validation Architecture

> Skipped — `workflow.nyquist_validation` is not set in `.planning/config.json` (only `workflow.research`, `workflow.plan_check`, and `workflow.verifier` are present).

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/core.cjs` — branch analysis of `planningRoot` and `detectLayoutStyle`
- Direct code inspection: `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/commands.cjs` — branch analysis of `cmdProgressRenderMulti`
- Direct code inspection: `/Users/tmac/Projects/gsdup/tests/helpers.cjs` — confirmed `createConcurrentProject` exists and is exported
- Direct code inspection: `/Users/tmac/Projects/gsdup/tests/routing.test.cjs` — confirmed milestone-scoped routing tests cover ROUTE-02 and PHASE-03
- Direct code inspection: `/Users/tmac/Projects/gsdup/tests/compat.test.cjs` — confirmed three-state detection coverage
- Direct code inspection: `/Users/tmac/Projects/gsdup/tests/dashboard.test.cjs` — confirmed conflict manifest overlap detection coverage
- Test run: `node --test tests/*.test.cjs` — 224 tests, 221 pass, 3 fail (pre-existing, unrelated to Phase 13)
- `.planning/config.json` — confirmed `workflow.nyquist_validation` absent; Validation Architecture section skipped

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — requirement text for TEST-01 through TEST-06
- `.planning/phases/14-integration-wiring-fix/14-01-SUMMARY.md` — confirmed Phase 14 is complete; code under test is stable

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — built-in Node.js test runner, existing test patterns directly inspected
- Architecture: HIGH — existing test files confirm all patterns; branch gaps identified by direct source reading
- Pitfalls: HIGH — pre-existing failures confirmed by test run; process.exit pitfall confirmed by Phase 09 decisions in STATE.md

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable — test infrastructure is established; source code under test is complete post-Phase-14)
