/**
 * Tests for migrate commands: migrate --dry-run, migrate --apply
 * TDD test suite — RED phase: tests written before implementation
 * Covers: MIGR-01 (dry-run inspection), MIGR-02 (additive-only apply + manifest), MIGR-03 (idempotency)
 */

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  runGsdTools,
  runGsdToolsFull,
  createTempProject,
  createLegacyProject,
  createConcurrentProject,
  cleanup,
} = require('./helpers.cjs');

describe('migrate commands', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  // ─── migrate --dry-run (MIGR-01) ────────────────────────────────────────────

  describe('migrate --dry-run', () => {
    test('dry-run on bare project (has .planning/phases/ but no config.json) reports create_file for config.json', () => {
      // createTempProject creates .planning/ and .planning/phases/ but NO config.json
      const result = runGsdTools('migrate --dry-run', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const out = JSON.parse(result.output);
      assert.strictEqual(out.dry_run, true);

      const configChange = out.changes.find(c => c.type === 'create_file' && c.path.includes('config.json'));
      assert.ok(configChange, 'Should report create_file for config.json');
      assert.ok(configChange.reason, 'Change should have a reason');
      assert.ok(configChange.content, 'create_file change should have content');
    });

    test('dry-run on bare project reports manual_actions for ROADMAP.md, STATE.md, PROJECT.md', () => {
      const result = runGsdTools('migrate --dry-run', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const out = JSON.parse(result.output);

      const manualActions = out.changes.filter(c => c.type === 'manual_action');
      const manualPaths = manualActions.map(c => c.path);

      const hasRoadmap = manualPaths.some(p => p.includes('ROADMAP.md'));
      const hasState = manualPaths.some(p => p.includes('STATE.md'));
      const hasProject = manualPaths.some(p => p.includes('PROJECT.md'));

      assert.ok(hasRoadmap, 'Should report manual_action for ROADMAP.md');
      assert.ok(hasState, 'Should report manual_action for STATE.md');
      assert.ok(hasProject, 'Should report manual_action for PROJECT.md');
    });

    test('dry-run on bare project reports changes-needed raw value', () => {
      const result = runGsdTools('migrate --dry-run --raw', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      assert.strictEqual(result.output.trim(), 'changes-needed');
    });

    test('dry-run on fully-configured legacy project reports 0 changes (up-to-date)', () => {
      // createLegacyProject adds config.json but no ROADMAP/STATE/PROJECT
      // We need a fully-configured project for truly 0 changes:
      // .planning/, .planning/phases/, config.json, ROADMAP.md, STATE.md, PROJECT.md, DEBT.md
      const planningDir = path.join(tmpDir, '.planning');
      fs.writeFileSync(path.join(planningDir, 'config.json'), JSON.stringify({ model_profile: 'balanced', commit_docs: true }, null, 2), 'utf-8');
      fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'), '# Roadmap\n', 'utf-8');
      fs.writeFileSync(path.join(planningDir, 'STATE.md'), '# State\n', 'utf-8');
      fs.writeFileSync(path.join(planningDir, 'PROJECT.md'), '# Project\n', 'utf-8');
      fs.writeFileSync(path.join(planningDir, 'DEBT.md'), '# DEBT.md\n', 'utf-8');

      const result = runGsdTools('migrate --dry-run', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const out = JSON.parse(result.output);
      assert.strictEqual(out.dry_run, true);
      assert.strictEqual(out.changes.length, 0, `Expected 0 changes, got: ${JSON.stringify(out.changes)}`);
    });

    test('dry-run on fully-configured project reports up-to-date raw value', () => {
      const planningDir = path.join(tmpDir, '.planning');
      fs.writeFileSync(path.join(planningDir, 'config.json'), JSON.stringify({ model_profile: 'balanced', commit_docs: true }, null, 2), 'utf-8');
      fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'), '# Roadmap\n', 'utf-8');
      fs.writeFileSync(path.join(planningDir, 'STATE.md'), '# State\n', 'utf-8');
      fs.writeFileSync(path.join(planningDir, 'PROJECT.md'), '# Project\n', 'utf-8');
      fs.writeFileSync(path.join(planningDir, 'DEBT.md'), '# DEBT.md\n', 'utf-8');

      const result = runGsdTools('migrate --dry-run --raw', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      assert.strictEqual(result.output.trim(), 'up-to-date');
    });

    test('dry-run on fully-configured concurrent project reports 0 changes', () => {
      // createConcurrentProject adds config.json with concurrent:true + milestone workspace
      // We still need the top-level ROADMAP/STATE/PROJECT/DEBT.md
      const concurrentDir = createConcurrentProject('v3.0');
      try {
        const planningDir = path.join(concurrentDir, '.planning');
        fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'), '# Roadmap\n', 'utf-8');
        fs.writeFileSync(path.join(planningDir, 'STATE.md'), '# State\n', 'utf-8');
        fs.writeFileSync(path.join(planningDir, 'PROJECT.md'), '# Project\n', 'utf-8');
        fs.writeFileSync(path.join(planningDir, 'DEBT.md'), '# DEBT.md\n', 'utf-8');

        const result = runGsdTools('migrate --dry-run', concurrentDir);
        assert.ok(result.success, `Command failed: ${result.error}`);
        const out = JSON.parse(result.output);
        assert.strictEqual(out.dry_run, true);
        assert.strictEqual(out.changes.length, 0, `Expected 0 changes, got: ${JSON.stringify(out.changes)}`);
      } finally {
        cleanup(concurrentDir);
      }
    });

    test('dry-run on project with no .planning/ at all returns error exit', () => {
      // Create a temp dir with no .planning/ at all
      const emptyDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-nomigrate-'));
      try {
        const result = runGsdToolsFull('migrate --dry-run', emptyDir);
        assert.strictEqual(result.success, false, 'Should exit with failure when .planning/ missing');
      } finally {
        fs.rmSync(emptyDir, { recursive: true, force: true });
      }
    });

    test('dry-run output has summary with layout field', () => {
      const result = runGsdTools('migrate --dry-run', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const out = JSON.parse(result.output);
      assert.ok(out.summary, 'Output should have summary field');
      assert.ok('layout' in out.summary, 'summary should have layout field');
      assert.ok('changes_needed' in out.summary, 'summary should have changes_needed field');
      assert.ok('manual_actions' in out.summary, 'summary should have manual_actions field');
    });
  });

  // ─── migrate --apply (MIGR-02, MIGR-03) ─────────────────────────────────────

  describe('migrate --apply', () => {
    test('apply on bare project creates config.json', () => {
      const result = runGsdTools('migrate --apply', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);

      const configPath = path.join(tmpDir, '.planning', 'config.json');
      assert.ok(fs.existsSync(configPath), 'config.json should be created by apply');

      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      assert.ok('model_profile' in config, 'config.json should have model_profile');
      assert.ok('commit_docs' in config, 'config.json should have commit_docs');
    });

    test('apply creates missing phases/ directory', () => {
      // Remove phases/ dir from the temp project
      fs.rmSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true, force: true });

      const result = runGsdTools('migrate --apply', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);

      const phasesPath = path.join(tmpDir, '.planning', 'phases');
      assert.ok(fs.existsSync(phasesPath), 'phases/ directory should be created by apply');
    });

    test('apply writes migrate-undo.json manifest to .planning/', () => {
      const result = runGsdTools('migrate --apply', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);

      const manifestPath = path.join(tmpDir, '.planning', 'migrate-undo.json');
      assert.ok(fs.existsSync(manifestPath), 'migrate-undo.json should be created');

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      assert.ok('applied' in manifest, 'manifest should have applied timestamp');
      assert.ok(Array.isArray(manifest.actions), 'manifest should have actions array');
      // Check timestamp looks like ISO format
      assert.ok(manifest.applied.includes('T'), 'applied should be ISO timestamp');
    });

    test('apply manifest_path in output points to .planning/migrate-undo.json', () => {
      const result = runGsdTools('migrate --apply', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const out = JSON.parse(result.output);
      assert.ok(out.manifest_path, 'Output should have manifest_path');
      assert.ok(out.manifest_path.endsWith('migrate-undo.json'), 'manifest_path should end with migrate-undo.json');
    });

    test('apply output has applied: true, actions_taken, actions, skipped_manual fields', () => {
      const result = runGsdTools('migrate --apply', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const out = JSON.parse(result.output);
      assert.strictEqual(out.applied, true);
      assert.ok(typeof out.actions_taken === 'number', 'actions_taken should be a number');
      assert.ok(Array.isArray(out.actions), 'actions should be an array');
      assert.ok(Array.isArray(out.skipped_manual), 'skipped_manual should be an array');
    });

    test('apply never overwrites existing config.json (additive-only)', () => {
      // Write a custom config.json with a marker
      const configPath = path.join(tmpDir, '.planning', 'config.json');
      const customContent = JSON.stringify({ custom_marker: 'do-not-overwrite', model_profile: 'custom' }, null, 2);
      fs.writeFileSync(configPath, customContent, 'utf-8');

      runGsdTools('migrate --apply', tmpDir);

      const afterContent = fs.readFileSync(configPath, 'utf-8');
      const afterConfig = JSON.parse(afterContent);
      assert.strictEqual(afterConfig.custom_marker, 'do-not-overwrite', 'Existing config.json should NOT be overwritten');
      assert.strictEqual(afterConfig.model_profile, 'custom', 'Existing config.json content should be preserved');
    });

    test('apply raw flag returns applied-N-changes when actions taken', () => {
      const result = runGsdTools('migrate --apply --raw', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const raw = result.output.trim();
      // When bare project has missing config.json, should return applied-N-changes
      assert.ok(raw.startsWith('applied-') || raw === 'already-up-to-date', `Raw value should be 'applied-N-changes' or 'already-up-to-date', got: ${raw}`);
    });

    test('apply on bare project raw value indicates changes applied', () => {
      // Bare project has no config.json — apply should create it
      const result = runGsdTools('migrate --apply --raw', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      assert.ok(result.output.trim().startsWith('applied-'), `Should start with 'applied-', got: ${result.output.trim()}`);
    });

    test('idempotency: applying twice produces same filesystem state (MIGR-03)', () => {
      // First apply
      const result1 = runGsdTools('migrate --apply', tmpDir);
      assert.ok(result1.success, `First apply failed: ${result1.error}`);
      const out1 = JSON.parse(result1.output);

      // Capture filesystem state after first apply
      const configPath = path.join(tmpDir, '.planning', 'config.json');
      const content1 = fs.readFileSync(configPath, 'utf-8');

      // Second apply
      const result2 = runGsdTools('migrate --apply', tmpDir);
      assert.ok(result2.success, `Second apply failed: ${result2.error}`);
      const out2 = JSON.parse(result2.output);

      // config.json content should be unchanged
      const content2 = fs.readFileSync(configPath, 'utf-8');
      assert.strictEqual(content1, content2, 'config.json should not change on second apply');

      // Second apply should report 0 actions taken
      assert.strictEqual(out2.actions_taken, 0, 'Second apply should take 0 actions');
    });

    test('idempotency: second apply raw value is already-up-to-date (MIGR-03)', () => {
      // First apply
      runGsdTools('migrate --apply', tmpDir);

      // Second apply with --raw
      const result2 = runGsdTools('migrate --apply --raw', tmpDir);
      assert.ok(result2.success, `Second apply failed: ${result2.error}`);
      assert.strictEqual(result2.output.trim(), 'already-up-to-date');
    });

    test('idempotency: manifest is overwritten (not appended) on second apply (MIGR-03)', () => {
      // First apply — creates actions in manifest
      runGsdTools('migrate --apply', tmpDir);

      const manifestPath = path.join(tmpDir, '.planning', 'migrate-undo.json');
      const manifest1 = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      assert.ok(manifest1.actions.length > 0, 'First apply should have actions');

      // Second apply — manifest should be overwritten with 0 actions, not appended
      runGsdTools('migrate --apply', tmpDir);
      const manifest2 = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      assert.strictEqual(manifest2.actions.length, 0, 'Second apply manifest should have 0 actions (overwritten, not appended)');
    });

    test('apply on project with no .planning/ at all returns error exit', () => {
      const emptyDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-nomigrate-'));
      try {
        const result = runGsdToolsFull('migrate --apply', emptyDir);
        assert.strictEqual(result.success, false, 'Should exit with failure when .planning/ missing');
      } finally {
        fs.rmSync(emptyDir, { recursive: true, force: true });
      }
    });
  });

  // ─── router dispatch ────────────────────────────────────────────────────────

  describe('router dispatch', () => {
    test('migrate --dry-run dispatches correctly (not error)', () => {
      const result = runGsdTools('migrate --dry-run', tmpDir);
      assert.ok(result.success, `migrate --dry-run should succeed: ${result.error}`);
    });

    test('migrate --apply dispatches correctly (not error)', () => {
      const result = runGsdTools('migrate --apply', tmpDir);
      assert.ok(result.success, `migrate --apply should succeed: ${result.error}`);
    });

    test('migrate without flags returns usage error', () => {
      const result = runGsdToolsFull('migrate', tmpDir);
      assert.strictEqual(result.success, false, 'migrate without flags should fail');
      assert.ok(result.stderr.includes('Usage') || result.stderr.includes('migrate'), `stderr should mention usage, got: ${result.stderr}`);
    });
  });
});
