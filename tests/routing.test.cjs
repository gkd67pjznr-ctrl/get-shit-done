/**
 * GSD Tools Tests - Milestone-Scoped Routing (Phase 12)
 * ROUTE-02: All init commands return milestone fields when --milestone is provided.
 * PHASE-03: cmdPhaseComplete routes to milestone workspace paths.
 */

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createConcurrentProject, runGsdToolsFull, cleanup } = require('./helpers.cjs');

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

  test('returns layout_style milestone-scoped when --milestone provided', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'phase-op', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.layout_style, 'milestone-scoped');
  });

  test('returns milestone_scope null without --milestone', () => {
    const result = runGsdToolsFull(['init', 'phase-op', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.milestone_scope, null);
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

  test('returns layout_style milestone-scoped', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'verify-work', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.layout_style, 'milestone-scoped');
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

  test('returns layout_style milestone-scoped', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'milestone-op', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.layout_style, 'milestone-scoped');
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
