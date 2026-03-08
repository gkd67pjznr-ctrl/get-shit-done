/**
 * GSD Tools Tests - Compatibility Layer (Phase 10)
 * Three-state detection, layout_style in init commands, no-migration guarantee.
 */

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cleanup } = require('./helpers.cjs');
const { detectLayoutStyle } = require('../get-shit-done/bin/lib/migrate.cjs');

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: detectLayoutStyle three-state coverage (COMPAT-02)
// ─────────────────────────────────────────────────────────────────────────────

describe('detectLayoutStyle three-state coverage (COMPAT-02)', () => {
  // These tests create bare directories (no milestone workspace) to test layout detection

  function createBareDir() {
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    return tmpDir;
  }

  test('returns uninitialized when no config.json exists', () => {
    const dir = createBareDir();
    try {
      const result = detectLayoutStyle(dir);
      assert.strictEqual(result, 'uninitialized');
    } finally {
      cleanup(dir);
    }
  });

  test('returns legacy when config.json has no concurrent key', () => {
    const dir = createBareDir();
    try {
      fs.writeFileSync(
        path.join(dir, '.planning', 'config.json'),
        JSON.stringify({ mode: 'yolo', commit_docs: true }),
        'utf-8'
      );
      const result = detectLayoutStyle(dir);
      assert.strictEqual(result, 'legacy');
    } finally {
      cleanup(dir);
    }
  });

  test('returns legacy when config.json has concurrent: false', () => {
    const dir = createBareDir();
    try {
      fs.writeFileSync(
        path.join(dir, '.planning', 'config.json'),
        JSON.stringify({ concurrent: false }),
        'utf-8'
      );
      const result = detectLayoutStyle(dir);
      assert.strictEqual(result, 'legacy');
    } finally {
      cleanup(dir);
    }
  });

  test('returns milestone-scoped when config.json has concurrent: true', () => {
    const dir = createBareDir();
    try {
      fs.writeFileSync(
        path.join(dir, '.planning', 'config.json'),
        JSON.stringify({ concurrent: true }),
        'utf-8'
      );
      const result = detectLayoutStyle(dir);
      assert.strictEqual(result, 'milestone-scoped');
    } finally {
      cleanup(dir);
    }
  });

  test('returns legacy for old-style project with milestone archive directories (COMPAT-02 key pitfall)', () => {
    // Simulate an old-style project that ran milestone complete: it has archive dirs
    // but config.json never had concurrent:true — must still return 'legacy'
    const dir = createBareDir();
    try {
      fs.writeFileSync(
        path.join(dir, '.planning', 'config.json'),
        JSON.stringify({ mode: 'yolo', commit_docs: true }),
        'utf-8'
      );
      // Add archive directory structure (like what milestone complete leaves behind)
      fs.mkdirSync(path.join(dir, '.planning', 'milestones', 'v1.0-phases'), { recursive: true });
      fs.writeFileSync(
        path.join(dir, '.planning', 'milestones', 'v1.0-ROADMAP.md'),
        '# Old Roadmap\n',
        'utf-8'
      );

      const result = detectLayoutStyle(dir);
      assert.strictEqual(
        result,
        'legacy',
        'archive directories must NOT influence layout detection — only config.json concurrent:true matters'
      );
    } finally {
      cleanup(dir);
    }
  });
});

