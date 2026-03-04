/**
 * GSD Tools Tests - Milestone-Scoped Routing (Phase 12)
 * ROUTE-02: All init commands return milestone fields when --milestone is provided.
 * PHASE-03: cmdPhaseComplete routes to milestone workspace paths.
 */

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTempProject, createConcurrentProject, runGsdToolsFull, cleanup } = require('./helpers.cjs');
const { resolveActiveMilestone } = require('../get-shit-done/bin/lib/core.cjs');

// Shared ROADMAP content for phase-complete tests
const ROADMAP_CONTENT = `# Roadmap

- [ ] Phase 1: Test Phase

### Phase 1: Test Phase
**Goal:** Test goal
**Requirements:** [TEST-01]
**Plans:** 1 plans

| Phase | Status | Date |
|-------|--------|------|
| 1. Test Phase | Planned | - |
`;

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: init phase-op with --milestone (ROUTE-02)
// ─────────────────────────────────────────────────────────────────────────────

describe('ROUTE-02: init phase-op with --milestone', () => {
  let tmpDir;

  before(() => {
    tmpDir = createConcurrentProject('v2.0');
    // Add a phase dir in milestone workspace so phase-op can find it
    fs.mkdirSync(path.join(tmpDir, '.planning', 'milestones', 'v2.0', 'phases', '01-test'), { recursive: true });
    // Also add in root phases so legacy path works
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-test'), { recursive: true });
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('returns milestone_scope when --milestone provided', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'phase-op', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.milestone_scope, 'v2.0');
  });

  test('returns planning_root containing milestones/v2.0 when --milestone provided', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'phase-op', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    assert.ok(
      output.planning_root.includes('milestones/v2.0'),
      `planning_root should contain milestones/v2.0, got: ${output.planning_root}`
    );
  });

  test('succeeds with --milestone flag provided', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'phase-op', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.milestone_scope, 'v2.0');
  });

  test('auto-detects milestone_scope without --milestone in milestone-scoped layout', () => {
    const result = runGsdToolsFull(['init', 'phase-op', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.milestone_scope, 'v2.0');
  });

  test('state_path uses milestone workspace path when --milestone provided', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'phase-op', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    assert.ok(
      output.state_path.includes('milestones/v2.0'),
      `state_path should include milestones/v2.0, got: ${output.state_path}`
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: init verify-work with --milestone (ROUTE-02)
// ─────────────────────────────────────────────────────────────────────────────

describe('ROUTE-02: init verify-work with --milestone', () => {
  let tmpDir;

  before(() => {
    tmpDir = createConcurrentProject('v2.0');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-test'), { recursive: true });
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('returns milestone_scope when --milestone provided', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'verify-work', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.milestone_scope, 'v2.0');
  });

  test('returns planning_root containing milestones/v2.0', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'verify-work', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    assert.ok(
      output.planning_root.includes('milestones/v2.0'),
      `planning_root should contain milestones/v2.0, got: ${output.planning_root}`
    );
  });

  test('succeeds with --milestone flag', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'verify-work', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.milestone_scope, 'v2.0');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: init progress with --milestone (ROUTE-02)
// ─────────────────────────────────────────────────────────────────────────────

describe('ROUTE-02: init progress with --milestone', () => {
  let tmpDir;

  before(() => {
    tmpDir = createConcurrentProject('v2.0');
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('returns milestone_scope when --milestone provided', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'progress', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.milestone_scope, 'v2.0');
  });

  test('returns planning_root containing milestones/v2.0', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'progress', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    assert.ok(
      output.planning_root.includes('milestones/v2.0'),
      `planning_root should contain milestones/v2.0, got: ${output.planning_root}`
    );
  });

  test('state_path uses milestone workspace path', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'progress', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    assert.ok(
      output.state_path.includes('milestones/v2.0'),
      `state_path should include milestones/v2.0, got: ${output.state_path}`
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 4: init resume with --milestone (ROUTE-02)
// ─────────────────────────────────────────────────────────────────────────────

describe('ROUTE-02: init resume with --milestone', () => {
  let tmpDir;

  before(() => {
    tmpDir = createConcurrentProject('v2.0');
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('returns milestone_scope when --milestone provided', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'resume', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.milestone_scope, 'v2.0');
  });

  test('returns planning_root containing milestones/v2.0', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'resume', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    assert.ok(
      output.planning_root.includes('milestones/v2.0'),
      `planning_root should contain milestones/v2.0, got: ${output.planning_root}`
    );
  });

  test('state_exists checks milestone workspace STATE.md', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'resume', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    // createConcurrentProject creates STATE.md in milestone workspace
    assert.strictEqual(output.state_exists, true);
  });

  test('state_path uses milestone workspace path', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'resume', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    assert.ok(
      output.state_path.includes('milestones/v2.0'),
      `state_path should include milestones/v2.0, got: ${output.state_path}`
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 5: init milestone-op with --milestone (ROUTE-02)
// ─────────────────────────────────────────────────────────────────────────────

describe('ROUTE-02: init milestone-op with --milestone', () => {
  let tmpDir;

  before(() => {
    tmpDir = createConcurrentProject('v2.0');
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('returns milestone_scope when --milestone provided', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'milestone-op', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.milestone_scope, 'v2.0');
  });

  test('returns planning_root containing milestones/v2.0', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'milestone-op', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    assert.ok(
      output.planning_root.includes('milestones/v2.0'),
      `planning_root should contain milestones/v2.0, got: ${output.planning_root}`
    );
  });

  test('succeeds with --milestone flag', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'milestone-op', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.milestone_scope, 'v2.0');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 6: phase complete with --milestone (PHASE-03)
// ─────────────────────────────────────────────────────────────────────────────

describe('PHASE-03: phase complete with --milestone routes to milestone workspace', () => {
  let tmpDir;

  before(() => {
    tmpDir = createConcurrentProject('v2.0');
    const workspaceDir = path.join(tmpDir, '.planning', 'milestones', 'v2.0');

    // Write ROADMAP.md to milestone workspace
    fs.writeFileSync(path.join(workspaceDir, 'ROADMAP.md'), ROADMAP_CONTENT, 'utf-8');

    // Write STATE.md to milestone workspace
    fs.writeFileSync(
      path.join(workspaceDir, 'STATE.md'),
      '# State\n\n**Current Phase:** 1\n**Current Plan:** 01\n**Status:** Active\n**Current Phase Name:** Test Phase\n**Last Activity:** 2026-01-01\n**Last Activity Description:** Testing\n',
      'utf-8'
    );

    // Create a phase dir with a PLAN.md and SUMMARY.md in milestone workspace
    const phaseDir = path.join(workspaceDir, 'phases', '01-test-phase');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '---\nphase: 1\nplan: 01\n---\n# Plan\n', 'utf-8');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary\n', 'utf-8');

    // Also create root ROADMAP.md to prove it does NOT get updated
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Root Roadmap\n\n- [ ] Phase 1: Should Not Be Touched\n',
      'utf-8'
    );
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('phase complete with --milestone updates milestone workspace ROADMAP.md', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'phase', 'complete', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);

    // Verify milestone workspace ROADMAP.md was updated
    const roadmapContent = fs.readFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v2.0', 'ROADMAP.md'),
      'utf-8'
    );
    assert.ok(
      roadmapContent.includes('[x]'),
      'Milestone workspace ROADMAP.md should have been updated with [x]'
    );
  });

  test('phase complete with --milestone does NOT touch root ROADMAP.md', () => {
    // Root ROADMAP was set before the test and should remain unchanged
    const rootRoadmap = fs.readFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      'utf-8'
    );
    assert.ok(
      rootRoadmap.includes('Should Not Be Touched'),
      'Root ROADMAP.md should not be modified by milestone-scoped phase complete'
    );
    assert.ok(
      !rootRoadmap.includes('[x]'),
      'Root ROADMAP.md should not have [x] completion markers'
    );
  });

  test('phase complete with --milestone returns success result', () => {
    // Re-scaffold to allow a second complete call (phase still has summary)
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'phase', 'complete', '1', '--raw'], tmpDir);
    // Even if called twice, should succeed (already marked complete is idempotent-ish)
    const output = JSON.parse(result.output);
    assert.strictEqual(output.completed_phase, '1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 7: resolveActiveMilestone unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveActiveMilestone', () => {
  let tmpDir;

  after(() => {
    if (tmpDir) cleanup(tmpDir);
  });

  test('returns active milestone from conflict.json', () => {
    tmpDir = createConcurrentProject('v3.0');
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v3.0', 'conflict.json'),
      JSON.stringify({ status: 'active' }),
      'utf-8'
    );
    assert.strictEqual(resolveActiveMilestone(tmpDir), 'v3.0');
    cleanup(tmpDir);
    tmpDir = null;
  });

  test('skips completed milestones', () => {
    tmpDir = createConcurrentProject('v2.0');
    // v2.0 is complete, v3.0 is active
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v2.0', 'conflict.json'),
      JSON.stringify({ status: 'complete' }),
      'utf-8'
    );
    const v3Dir = path.join(tmpDir, '.planning', 'milestones', 'v3.0');
    fs.mkdirSync(path.join(v3Dir, 'phases'), { recursive: true });
    fs.writeFileSync(
      path.join(v3Dir, 'conflict.json'),
      JSON.stringify({ status: 'active' }),
      'utf-8'
    );
    assert.strictEqual(resolveActiveMilestone(tmpDir), 'v3.0');
    cleanup(tmpDir);
    tmpDir = null;
  });

  test('picks newest when multiple active', () => {
    tmpDir = createConcurrentProject('v2.0');
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v2.0', 'conflict.json'),
      JSON.stringify({ status: 'active' }),
      'utf-8'
    );
    const v3Dir = path.join(tmpDir, '.planning', 'milestones', 'v3.0');
    fs.mkdirSync(path.join(v3Dir, 'phases'), { recursive: true });
    fs.writeFileSync(
      path.join(v3Dir, 'conflict.json'),
      JSON.stringify({ status: 'active' }),
      'utf-8'
    );
    assert.strictEqual(resolveActiveMilestone(tmpDir), 'v3.0');
    cleanup(tmpDir);
    tmpDir = null;
  });

  test('falls back to newest with STATE.md when no conflict.json', () => {
    tmpDir = createConcurrentProject('v2.0');
    // createConcurrentProject already writes STATE.md in v2.0
    // Add v3.0 with STATE.md but no conflict.json
    const v3Dir = path.join(tmpDir, '.planning', 'milestones', 'v3.0');
    fs.mkdirSync(path.join(v3Dir, 'phases'), { recursive: true });
    fs.writeFileSync(path.join(v3Dir, 'STATE.md'), '# State\n', 'utf-8');
    assert.strictEqual(resolveActiveMilestone(tmpDir), 'v3.0');
    cleanup(tmpDir);
    tmpDir = null;
  });

  test('returns null for legacy layout (no milestones dir)', () => {
    tmpDir = createTempProject();
    assert.strictEqual(resolveActiveMilestone(tmpDir), null);
    cleanup(tmpDir);
    tmpDir = null;
  });

  test('returns null for empty milestones dir', () => {
    tmpDir = createTempProject();
    fs.mkdirSync(path.join(tmpDir, '.planning', 'milestones'), { recursive: true });
    assert.strictEqual(resolveActiveMilestone(tmpDir), null);
    cleanup(tmpDir);
    tmpDir = null;
  });

  test('numeric sort strategy 1: returns v14.0 over v2.0 when both conflict.json have status:active', () => {
    tmpDir = createConcurrentProject('v2.0');
    // v2.0 conflict.json with status:active
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v2.0', 'conflict.json'),
      JSON.stringify({ status: 'active' }),
      'utf-8'
    );
    // v14.0 dir with conflict.json status:active
    const v14Dir = path.join(tmpDir, '.planning', 'milestones', 'v14.0');
    fs.mkdirSync(path.join(v14Dir, 'phases'), { recursive: true });
    fs.writeFileSync(path.join(v14Dir, 'STATE.md'), '# State\n', 'utf-8');
    fs.writeFileSync(
      path.join(v14Dir, 'conflict.json'),
      JSON.stringify({ status: 'active' }),
      'utf-8'
    );
    assert.strictEqual(resolveActiveMilestone(tmpDir), 'v14.0', 'should return v14.0 not v2.0 (numeric sort, not lexicographic)');
    cleanup(tmpDir);
    tmpDir = null;
  });

  test('numeric sort strategy 2: returns v10.0 over v2.0 when both have STATE.md but no conflict.json', () => {
    tmpDir = createConcurrentProject('v2.0');
    // v2.0 already has STATE.md from createConcurrentProject, no conflict.json
    const v10Dir = path.join(tmpDir, '.planning', 'milestones', 'v10.0');
    fs.mkdirSync(path.join(v10Dir, 'phases'), { recursive: true });
    fs.writeFileSync(path.join(v10Dir, 'STATE.md'), '# State\n', 'utf-8');
    assert.strictEqual(resolveActiveMilestone(tmpDir), 'v10.0', 'should return v10.0 not v2.0 (numeric sort on STATE.md strategy)');
    cleanup(tmpDir);
    tmpDir = null;
  });

  test('numeric sort strategy 3: returns v9.0 over v1.0 when both are bare dirs with no STATE.md or conflict.json', () => {
    tmpDir = createTempProject();
    const milestonesDir = path.join(tmpDir, '.planning', 'milestones');
    // Create bare dirs — no STATE.md, no conflict.json
    fs.mkdirSync(path.join(milestonesDir, 'v1.0'), { recursive: true });
    fs.mkdirSync(path.join(milestonesDir, 'v9.0'), { recursive: true });
    assert.strictEqual(resolveActiveMilestone(tmpDir), 'v9.0', 'should return v9.0 not v1.0 (numeric sort on all dirs strategy)');
    cleanup(tmpDir);
    tmpDir = null;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 8: CLI auto-detection integration (find-phase without --milestone)
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: Groups 9-11 are below group 8 (appended at bottom of file)

describe('CLI auto-detection: find-phase without --milestone', () => {
  let tmpDir;

  before(() => {
    tmpDir = createConcurrentProject('v3.0');
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v3.0', 'conflict.json'),
      JSON.stringify({ status: 'active' }),
      'utf-8'
    );
    fs.mkdirSync(
      path.join(tmpDir, '.planning', 'milestones', 'v3.0', 'phases', '05-deploy'),
      { recursive: true }
    );
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('find-phase resolves without --milestone flag', () => {
    const result = runGsdToolsFull(['find-phase', '5'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, true);
    assert.strictEqual(output.phase_number, '05');
    assert.ok(
      output.directory.includes('milestones/v3.0'),
      `directory should contain milestones/v3.0, got: ${output.directory}`
    );
  });

  test('explicit --milestone overrides auto-detection', () => {
    // Create a v2.0 milestone with a different phase
    const v2Dir = path.join(tmpDir, '.planning', 'milestones', 'v2.0');
    fs.mkdirSync(path.join(v2Dir, 'phases', '05-old-deploy'), { recursive: true });
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'find-phase', '5'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    assert.ok(
      output.directory.includes('milestones/v2.0'),
      `directory should contain milestones/v2.0, got: ${output.directory}`
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 9: BUG-01 — cmdInitPlanPhase auto-creates phase directory from ROADMAP
// ─────────────────────────────────────────────────────────────────────────────

const ROADMAP_WITH_PHASE_77 = `# Roadmap

- [ ] Phase 77: Deploy Infrastructure

### Phase 77: Deploy Infrastructure
**Goal:** Deploy the infrastructure
**Requirements:** [INFRA-01]
**Plans:** TBD

| Phase | Status | Date |
|-------|--------|------|
| 77. Deploy Infrastructure | Planned | - |
`;

describe('BUG-01: cmdInitPlanPhase auto-creates phase directory from ROADMAP', () => {
  let tmpDir;

  before(() => {
    tmpDir = createConcurrentProject('v12.0');
    // Write ROADMAP with Phase 77 but do NOT create any phase directory
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v12.0', 'ROADMAP.md'),
      ROADMAP_WITH_PHASE_77,
      'utf-8'
    );
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('returns phase_found: true when phase exists in ROADMAP but has no directory', () => {
    const result = runGsdToolsFull(['--milestone', 'v12.0', 'init', 'plan-phase', '77', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.phase_found, true, `Expected phase_found: true, got: ${out.phase_found}`);
  });

  test('returns a non-null phase_dir containing milestones/v12.0', () => {
    const result = runGsdToolsFull(['--milestone', 'v12.0', 'init', 'plan-phase', '77', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const out = JSON.parse(result.output);
    assert.ok(out.phase_dir !== null, 'Expected phase_dir to be non-null');
    assert.ok(
      out.phase_dir.includes('milestones/v12.0'),
      `phase_dir should contain milestones/v12.0, got: ${out.phase_dir}`
    );
  });

  test('auto-created directory actually exists on disk', () => {
    const result = runGsdToolsFull(['--milestone', 'v12.0', 'init', 'plan-phase', '77', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const out = JSON.parse(result.output);
    const fullPath = path.join(tmpDir, out.phase_dir);
    assert.ok(
      fs.existsSync(fullPath),
      `Expected directory to exist on disk: ${fullPath}`
    );
  });

  test('auto-created directory contains .gitkeep', () => {
    const result = runGsdToolsFull(['--milestone', 'v12.0', 'init', 'plan-phase', '77', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const out = JSON.parse(result.output);
    const gitkeepPath = path.join(tmpDir, out.phase_dir, '.gitkeep');
    assert.ok(
      fs.existsSync(gitkeepPath),
      `Expected .gitkeep to exist in auto-created directory: ${gitkeepPath}`
    );
  });

  test('auto-created directory name follows normalized pattern (77-deploy-infrastructure)', () => {
    const result = runGsdToolsFull(['--milestone', 'v12.0', 'init', 'plan-phase', '77', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const out = JSON.parse(result.output);
    const dirName = path.basename(out.phase_dir);
    assert.ok(
      dirName.startsWith('77-'),
      `Directory name should start with '77-', got: ${dirName}`
    );
  });

  test('returns non-null phase_name derived from directory slug', () => {
    // phase_name is extracted from the directory slug (e.g., "deploy-infrastructure")
    // not from the ROADMAP human-readable name — this is established behavior in findPhaseInternal
    const result = runGsdToolsFull(['--milestone', 'v12.0', 'init', 'plan-phase', '77', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const out = JSON.parse(result.output);
    assert.ok(out.phase_name !== null, 'Expected phase_name to be non-null');
    assert.ok(
      out.phase_name.includes('deploy'),
      `Expected phase_name to contain 'deploy', got: ${out.phase_name}`
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 10: BUG-01 — cmdInitExecutePhase auto-creates phase directory from ROADMAP
// ─────────────────────────────────────────────────────────────────────────────

describe('BUG-01: cmdInitExecutePhase auto-creates phase directory from ROADMAP', () => {
  let tmpDir;

  before(() => {
    tmpDir = createConcurrentProject('v12.0');
    // Write ROADMAP with Phase 77 but do NOT create any phase directory
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v12.0', 'ROADMAP.md'),
      ROADMAP_WITH_PHASE_77,
      'utf-8'
    );
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('returns phase_found: true when phase exists in ROADMAP but has no directory', () => {
    const result = runGsdToolsFull(['--milestone', 'v12.0', 'init', 'execute-phase', '77', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.phase_found, true, `Expected phase_found: true, got: ${out.phase_found}`);
  });

  test('returns a non-null phase_dir', () => {
    const result = runGsdToolsFull(['--milestone', 'v12.0', 'init', 'execute-phase', '77', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const out = JSON.parse(result.output);
    assert.ok(out.phase_dir !== null, 'Expected phase_dir to be non-null');
  });

  test('auto-created directory actually exists on disk', () => {
    const result = runGsdToolsFull(['--milestone', 'v12.0', 'init', 'execute-phase', '77', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const out = JSON.parse(result.output);
    const fullPath = path.join(tmpDir, out.phase_dir);
    assert.ok(
      fs.existsSync(fullPath),
      `Expected directory to exist on disk: ${fullPath}`
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 10b: BUG-01 — auto-detection without --milestone flag
// ─────────────────────────────────────────────────────────────────────────────

describe('BUG-01: auto-creates phase directory WITHOUT --milestone flag (auto-detect)', () => {
  let tmpDir;

  before(() => {
    tmpDir = createConcurrentProject('v12.0');
    // Write ROADMAP with Phase 77 in the v12.0 milestone workspace
    const roadmapPath = path.join(tmpDir, '.planning', 'milestones', 'v12.0', 'ROADMAP.md');
    fs.writeFileSync(roadmapPath, `# Roadmap v12.0\n\n### Phase 77: Deploy Infrastructure\n\n**Goal:** Deploy the infra\n`);
    // Do NOT create the 77-deploy-infrastructure directory
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('cmdInitPlanPhase finds phase 77 without --milestone flag', () => {
    // No --milestone flag — should auto-detect v12.0
    const result = runGsdToolsFull(['init', 'plan-phase', '77', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.phase_found, true, 'Expected phase_found to be true (auto-detected)');
    assert.ok(out.phase_dir, 'Expected phase_dir to be non-null');
    assert.ok(out.phase_dir.includes('v12.0'), `Expected phase_dir to include v12.0, got: ${out.phase_dir}`);
    assert.strictEqual(out.milestone_scope, 'v12.0', 'Expected auto-detected milestone_scope to be v12.0');
  });

  test('cmdInitExecutePhase finds phase 77 without --milestone flag', () => {
    const result = runGsdToolsFull(['init', 'execute-phase', '77', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.phase_found, true, 'Expected phase_found to be true (auto-detected)');
    assert.ok(out.phase_dir, 'Expected phase_dir to be non-null');
    assert.strictEqual(out.milestone_scope, 'v12.0', 'Expected auto-detected milestone_scope to be v12.0');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 11: BUG-02 — cmdInitProgress sorts phases numerically
// ─────────────────────────────────────────────────────────────────────────────

describe('BUG-02: cmdInitProgress sorts phases numerically not alphabetically', () => {
  let tmpDir;

  before(() => {
    tmpDir = createConcurrentProject('v5.0');
    // Create phase directories that sort differently alphabetically vs numerically
    // Alphabetical: 10-beta, 2-alpha, 3-gamma
    // Numeric:       2-alpha, 3-gamma, 10-beta
    const phasesDir = path.join(tmpDir, '.planning', 'milestones', 'v5.0', 'phases');
    fs.mkdirSync(path.join(phasesDir, '2-alpha'), { recursive: true });
    fs.mkdirSync(path.join(phasesDir, '10-beta'), { recursive: true });
    fs.mkdirSync(path.join(phasesDir, '3-gamma'), { recursive: true });
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('phases are sorted numerically: 2 before 3 before 10', () => {
    const result = runGsdToolsFull(['--milestone', 'v5.0', 'init', 'progress', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.phases[0].number, '2', `Expected phases[0].number to be '2', got: ${out.phases[0].number}`);
    assert.strictEqual(out.phases[1].number, '3', `Expected phases[1].number to be '3', got: ${out.phases[1].number}`);
    assert.strictEqual(out.phases[2].number, '10', `Expected phases[2].number to be '10', got: ${out.phases[2].number}`);
  });
});
