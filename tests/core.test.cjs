/**
 * GSD Tools Tests - Core utility functions
 * Tests for planningRoot and detectLayoutStyle
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { createTempProject, cleanup } = require('./helpers.cjs');
const { planningRoot, detectLayoutStyle } = require('../get-shit-done/bin/lib/core.cjs');

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
});
