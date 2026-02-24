/**
 * GSD Tools Tests - Compatibility Layer (Phase 10)
 * Three-state detection, layout_style in init commands, no-migration guarantee.
 */

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTempProject, createLegacyProject, createConcurrentProject, runGsdToolsFull, cleanup } = require('./helpers.cjs');
const { detectLayoutStyle } = require('../get-shit-done/bin/lib/core.cjs');

// Shared ROADMAP.md content for init CLI tests
const ROADMAP_CONTENT = `# Roadmap

### Phase 1: Test Phase
**Goal:** Test goal
**Requirements:** [TEST-01]
**Plans:** 0 plans
`;

// Helper: scaffold a legacy project with STATE/ROADMAP + phase directory for CLI tests
function scaffoldLegacyForCli(tmpDir) {
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n', 'utf-8');
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), ROADMAP_CONTENT, 'utf-8');
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-test-phase'), { recursive: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: detectLayoutStyle three-state coverage (COMPAT-02)
// ─────────────────────────────────────────────────────────────────────────────

describe('detectLayoutStyle three-state coverage (COMPAT-02)', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempProject();
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('returns uninitialized when no config.json exists', () => {
    const result = detectLayoutStyle(tmpDir);
    assert.strictEqual(result, 'uninitialized');
  });

  test('returns legacy when config.json has no concurrent key', () => {
    const legacyDir = createLegacyProject();
    try {
      const result = detectLayoutStyle(legacyDir);
      assert.strictEqual(result, 'legacy');
    } finally {
      cleanup(legacyDir);
    }
  });

  test('returns legacy when config.json has concurrent: false', () => {
    const dir = createTempProject();
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
    const concurrentDir = createConcurrentProject();
    try {
      const result = detectLayoutStyle(concurrentDir);
      assert.strictEqual(result, 'milestone-scoped');
    } finally {
      cleanup(concurrentDir);
    }
  });

  test('returns legacy for old-style project with milestone archive directories (COMPAT-02 key pitfall)', () => {
    // Simulate an old-style project that ran milestone complete: it has archive dirs
    // but config.json never had concurrent:true — must still return 'legacy'
    const legacyDir = createLegacyProject();
    try {
      // Add archive directory structure (like what milestone complete leaves behind)
      fs.mkdirSync(path.join(legacyDir, '.planning', 'milestones', 'v1.0-phases'), { recursive: true });
      fs.writeFileSync(
        path.join(legacyDir, '.planning', 'milestones', 'v1.0-ROADMAP.md'),
        '# Old Roadmap\n',
        'utf-8'
      );

      const result = detectLayoutStyle(legacyDir);
      assert.strictEqual(
        result,
        'legacy',
        'archive directories must NOT influence layout detection — only config.json concurrent:true matters'
      );
    } finally {
      cleanup(legacyDir);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: init plan-phase layout_style output (COMPAT-01)
// ─────────────────────────────────────────────────────────────────────────────

describe('init plan-phase returns layout_style (COMPAT-01)', () => {
  let tmpDir;

  before(() => {
    tmpDir = createLegacyProject();
    scaffoldLegacyForCli(tmpDir);
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('returns layout_style legacy for old-style project', () => {
    const result = runGsdToolsFull(['init', 'plan-phase', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.layout_style, 'legacy');
  });

  test('returns layout_style uninitialized for project without config.json', () => {
    const uninitDir = createTempProject();
    try {
      const result = runGsdToolsFull(['init', 'plan-phase', '1', '--raw'], uninitDir);
      assert.ok(result.success, `Command failed: ${result.error}`);

      const output = JSON.parse(result.output);
      assert.strictEqual(output.layout_style, 'uninitialized');
    } finally {
      cleanup(uninitDir);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: init execute-phase layout_style output (COMPAT-01)
// ─────────────────────────────────────────────────────────────────────────────

describe('init execute-phase returns layout_style (COMPAT-01)', () => {
  let tmpDir;

  before(() => {
    tmpDir = createLegacyProject();
    scaffoldLegacyForCli(tmpDir);
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('returns layout_style legacy for old-style project', () => {
    const result = runGsdToolsFull(['init', 'execute-phase', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.layout_style, 'legacy');
  });

  test('returns layout_style uninitialized for project without config.json', () => {
    const uninitDir = createTempProject();
    try {
      const result = runGsdToolsFull(['init', 'execute-phase', '1', '--raw'], uninitDir);
      assert.ok(result.success, `Command failed: ${result.error}`);

      const output = JSON.parse(result.output);
      assert.strictEqual(output.layout_style, 'uninitialized');
    } finally {
      cleanup(uninitDir);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 4: No-migration guarantee (COMPAT-03)
// ─────────────────────────────────────────────────────────────────────────────

describe('no-migration guarantee for legacy projects (COMPAT-03)', () => {
  let tmpDir;

  before(() => {
    tmpDir = createLegacyProject();
    scaffoldLegacyForCli(tmpDir);
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('old-style project paths are root-level, not milestone-scoped', () => {
    const result = runGsdToolsFull(['init', 'plan-phase', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.ok(
      output.planning_root.endsWith('/.planning'),
      `planning_root should end with /.planning, got: ${output.planning_root}`
    );
    assert.ok(
      !output.planning_root.includes('milestones'),
      `planning_root must NOT contain 'milestones' for legacy projects, got: ${output.planning_root}`
    );
  });

  test('legacy project init outputs have no milestone_scope', () => {
    const result = runGsdToolsFull(['init', 'plan-phase', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(
      output.milestone_scope,
      null,
      'milestone_scope must be null for legacy projects — no migration should have occurred'
    );
  });

  test('legacy execute-phase paths are root-level, not milestone-scoped', () => {
    const result = runGsdToolsFull(['init', 'execute-phase', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.ok(
      output.planning_root.endsWith('/.planning'),
      `planning_root should end with /.planning, got: ${output.planning_root}`
    );
    assert.ok(
      !output.planning_root.includes('milestones'),
      `planning_root must NOT contain 'milestones' for legacy projects, got: ${output.planning_root}`
    );
  });
});
