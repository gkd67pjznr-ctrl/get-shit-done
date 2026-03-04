/**
 * GSD Tools Tests - End-to-end lifecycle (TEST-06)
 * Tests plan→execute→verify flow in both legacy and milestone-scoped modes.
 */
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdToolsFull, createLegacyProject, createConcurrentProject, cleanup } = require('./helpers.cjs');

// ─────────────────────────────────────────────────────────────────────────────
// E2E: legacy mode plan→execute→verify
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E: legacy mode plan→execute→verify', () => {
  let tmpDir;

  before(() => {
    tmpDir = createLegacyProject();

    // Write ROADMAP.md
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\n- [ ] Phase 1: E2E Test Phase\n\n### Phase 1: E2E Test Phase\n**Goal:** E2E test\n**Requirements:** [E2E-01]\n**Plans:** 1 plans\n\n| Phase | Status |\n|-------|--------|\n| 1. E2E Test Phase | Planned |\n',
      'utf-8'
    );

    // Write STATE.md
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# State\n',
      'utf-8'
    );

    // Create phase directory
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-e2e-test-phase');
    fs.mkdirSync(phaseDir, { recursive: true });

    // Write PLAN.md
    fs.writeFileSync(
      path.join(phaseDir, '01-01-PLAN.md'),
      '---\nphase: 01-e2e-test-phase\nplan: 01\n---\n# Plan\n',
      'utf-8'
    );

    // Write SUMMARY.md
    fs.writeFileSync(
      path.join(phaseDir, '01-01-SUMMARY.md'),
      '# Summary\n',
      'utf-8'
    );
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('init plan-phase returns flat planning_root and null milestone_scope', () => {
    const result = runGsdToolsFull(['init', 'plan-phase', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const out = JSON.parse(result.output);
    assert.ok(out.planning_root.endsWith('/.planning'), `planning_root should end with /.planning, got: ${out.planning_root}`);
    assert.strictEqual(out.milestone_scope, null);
  });

  test('init execute-phase returns flat state_path', () => {
    const result = runGsdToolsFull(['init', 'execute-phase', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.state_path, '.planning/STATE.md');
  });

  test('phase complete updates legacy ROADMAP.md', () => {
    const result = runGsdToolsFull(['phase', 'complete', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(content.includes('[x]'), 'ROADMAP.md should contain [x] after phase complete');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E2E: milestone-scoped mode plan→execute→verify
// ─────────────────────────────────────────────────────────────────────────────

describe('E2E: milestone-scoped mode plan→execute→verify', () => {
  let tmpDir;

  before(() => {
    tmpDir = createConcurrentProject('v2.0');
    const workspaceDir = path.join(tmpDir, '.planning', 'milestones', 'v2.0');

    // Write ROADMAP.md to milestone workspace
    fs.writeFileSync(
      path.join(workspaceDir, 'ROADMAP.md'),
      '# Roadmap\n\n- [ ] Phase 1: E2E Test Phase\n\n### Phase 1: E2E Test Phase\n**Goal:** E2E test\n**Requirements:** [E2E-01]\n**Plans:** 1 plans\n\n| Phase | Status |\n|-------|--------|\n| 1. E2E Test Phase | Planned |\n',
      'utf-8'
    );

    // Write STATE.md to milestone workspace with structured content
    fs.writeFileSync(
      path.join(workspaceDir, 'STATE.md'),
      '# State\n\n**Current Phase:** 1\n**Current Plan:** 01\n**Status:** Active\n**Current Phase Name:** E2E Test Phase\n**Last Activity:** 2026-01-01\n**Last Activity Description:** Testing\n',
      'utf-8'
    );

    // Create phase directory in milestone workspace
    const milestonePhasesDir = path.join(workspaceDir, 'phases', '01-e2e-test-phase');
    fs.mkdirSync(milestonePhasesDir, { recursive: true });

    // Also create root phases dir for phase lookup
    const rootPhasesDir = path.join(tmpDir, '.planning', 'phases', '01-e2e-test-phase');
    fs.mkdirSync(rootPhasesDir, { recursive: true });

    // Write PLAN.md and SUMMARY.md in milestone workspace
    fs.writeFileSync(
      path.join(milestonePhasesDir, '01-01-PLAN.md'),
      '---\nphase: 01-e2e-test-phase\nplan: 01\n---\n# Plan\n',
      'utf-8'
    );
    fs.writeFileSync(
      path.join(milestonePhasesDir, '01-01-SUMMARY.md'),
      '# Summary\n',
      'utf-8'
    );
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('init plan-phase with --milestone returns milestone workspace planning_root', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'plan-phase', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const out = JSON.parse(result.output);
    assert.ok(out.planning_root.includes('milestones/v2.0'), `planning_root should contain milestones/v2.0, got: ${out.planning_root}`);
    assert.strictEqual(out.milestone_scope, 'v2.0');
  });

  test('init execute-phase with --milestone returns milestone workspace paths', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'init', 'execute-phase', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const out = JSON.parse(result.output);
    assert.ok(out.state_path.includes('milestones/v2.0'), `state_path should include milestones/v2.0, got: ${out.state_path}`);
  });

  test('phase complete with --milestone updates milestone workspace ROADMAP.md', () => {
    const result = runGsdToolsFull(['--milestone', 'v2.0', 'phase', 'complete', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const content = fs.readFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v2.0', 'ROADMAP.md'),
      'utf-8'
    );
    assert.ok(content.includes('[x]'), 'Milestone workspace ROADMAP.md should contain [x] after phase complete');
  });

  test('phase complete with --milestone does not modify root ROADMAP.md', () => {
    const rootRoadmapPath = path.join(tmpDir, '.planning', 'ROADMAP.md');
    if (fs.existsSync(rootRoadmapPath)) {
      const content = fs.readFileSync(rootRoadmapPath, 'utf-8');
      assert.ok(!content.includes('[x]'), 'Root ROADMAP.md should not be modified by milestone-scoped phase complete');
    }
    // If root ROADMAP.md does not exist, that's also acceptable for a concurrent project
  });
});
