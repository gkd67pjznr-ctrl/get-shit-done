/**
 * GSD Tools Tests - Core utility functions
 * Tests for planningRoot and detectLayoutStyle
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { createTempProject, createConcurrentProject, cleanup } = require('./helpers.cjs');
const { planningRoot, detectLayoutStyle, findPhaseInternal, getRoadmapPhaseInternal, normalizePhaseName } = require('../get-shit-done/bin/lib/core.cjs');

// ─────────────────────────────────────────────────────────────────────────────
// planningRoot
// ─────────────────────────────────────────────────────────────────────────────

describe('planningRoot', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns legacy path when second arg is null', () => {
    const result = planningRoot(tmpDir, null);
    assert.strictEqual(result, path.join(tmpDir, '.planning'));
  });

  test('returns legacy path when second arg is undefined', () => {
    const result = planningRoot(tmpDir, undefined);
    assert.strictEqual(result, path.join(tmpDir, '.planning'));
  });

  test('returns legacy path when called with no second arg', () => {
    const result = planningRoot(tmpDir);
    assert.strictEqual(result, path.join(tmpDir, '.planning'));
  });

  test('returns milestone-scoped path for v2.0', () => {
    const result = planningRoot(tmpDir, 'v2.0');
    assert.strictEqual(result, path.join(tmpDir, '.planning', 'milestones', 'v2.0'));
  });

  test('returns milestone-scoped path for v1.1', () => {
    const result = planningRoot(tmpDir, 'v1.1');
    assert.strictEqual(result, path.join(tmpDir, '.planning', 'milestones', 'v1.1'));
  });

  test('return value is always an absolute path', () => {
    const legacy = planningRoot(tmpDir, null);
    const scoped = planningRoot(tmpDir, 'v2.0');
    assert.ok(path.isAbsolute(legacy), 'legacy path should be absolute');
    assert.ok(path.isAbsolute(scoped), 'milestone-scoped path should be absolute');
  });

  test('returns legacy path when second arg is empty string', () => {
    const result = planningRoot(tmpDir, '');
    assert.strictEqual(result, path.join(tmpDir, '.planning'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// detectLayoutStyle
// ─────────────────────────────────────────────────────────────────────────────

describe('detectLayoutStyle', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns uninitialized when config.json does not exist', () => {
    const result = detectLayoutStyle(tmpDir);
    assert.strictEqual(result, 'uninitialized');
  });

  test('returns legacy when config.json exists with no concurrent key', () => {
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ mode: 'yolo' }), 'utf-8');
    const result = detectLayoutStyle(tmpDir);
    assert.strictEqual(result, 'legacy');
  });

  test('returns legacy when config.json has concurrent: false', () => {
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ concurrent: false }), 'utf-8');
    const result = detectLayoutStyle(tmpDir);
    assert.strictEqual(result, 'legacy');
  });

  test('returns milestone-scoped when config.json has concurrent: true', () => {
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ concurrent: true }), 'utf-8');
    const result = detectLayoutStyle(tmpDir);
    assert.strictEqual(result, 'milestone-scoped');
  });

  test('returns uninitialized when config.json contains invalid JSON', () => {
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, '{ not valid json }', 'utf-8');
    const result = detectLayoutStyle(tmpDir);
    assert.strictEqual(result, 'uninitialized');
  });

  test('returns legacy when concurrent is non-boolean truthy value', () => {
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ concurrent: 'yes' }), 'utf-8');
    const result = detectLayoutStyle(tmpDir);
    assert.strictEqual(result, 'legacy');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// milestone-scoped core functions
// ─────────────────────────────────────────────────────────────────────────────

describe('milestone-scoped core functions', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createConcurrentProject('v3.0');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('findPhaseInternal with milestoneScope finds phase in workspace', () => {
    // Create a phase directory inside the milestone workspace
    fs.mkdirSync(
      path.join(tmpDir, '.planning', 'milestones', 'v3.0', 'phases', '3.1-test-phase'),
      { recursive: true }
    );

    const result = findPhaseInternal(tmpDir, '3.1', 'v3.0');
    assert.ok(result, 'should return a result object');
    assert.strictEqual(result.found, true, 'should be found');
    assert.strictEqual(result.phase_number, '3.1', 'phase_number should be 3.1');
    assert.ok(
      result.directory.includes('milestones/v3.0'),
      `directory should be in milestone workspace, got: ${result.directory}`
    );
  });

  test('findPhaseInternal with milestoneScope returns null for missing phase', () => {
    const result = findPhaseInternal(tmpDir, '99', 'v3.0');
    assert.ok(!result || result.found === false, 'should return null or not found for missing phase');
  });

  test('getRoadmapPhaseInternal with milestoneScope reads milestone ROADMAP', () => {
    // Write a ROADMAP in the milestone workspace
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v3.0', 'ROADMAP.md'),
      '# Roadmap v3.0\n\n### Phase 3.1: Test Phase\n**Goal:** Test milestone scope\n'
    );

    const result = getRoadmapPhaseInternal(tmpDir, '3.1', 'v3.0');
    assert.ok(result, 'should return a result object');
    assert.strictEqual(result.found, true, 'phase should be found');
    assert.strictEqual(result.phase_name, 'Test Phase', 'phase_name should be Test Phase');
    assert.strictEqual(result.goal, 'Test milestone scope', 'goal should match');
  });

  test('normalizePhaseName with milestone-style dot-hierarchy', () => {
    assert.strictEqual(normalizePhaseName('3.1'), '3.1', '3.1 should not be padded');
    assert.strictEqual(normalizePhaseName('3.2.1'), '3.2.1', '3.2.1 should remain unchanged');
    assert.strictEqual(normalizePhaseName('15'), '15', '2-digit integers should not change');
  });
});
