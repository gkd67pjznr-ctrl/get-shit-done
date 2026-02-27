/**
 * GSD Tools Tests - DEBT.md Initialization and TO-DOS.md Cleanup
 *
 * FIX-03: config-ensure-section creates DEBT.md alongside config.json
 * FIX-04: migrate --apply creates DEBT.md for existing projects that lack it
 * FIX-05: migrate --apply removes stale TO-DOS.md from .planning/ root
 */

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTempProject, runGsdToolsFull, cleanup } = require('./helpers.cjs');

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: FIX-03 — config-ensure-section creates DEBT.md
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX-03: config-ensure-section creates DEBT.md', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempProject();
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('DEBT.md is created when config-ensure-section runs on new project', () => {
    const result = runGsdToolsFull(['config-ensure-section'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);

    const debtPath = path.join(tmpDir, '.planning', 'DEBT.md');
    assert.ok(fs.existsSync(debtPath), 'DEBT.md should exist after config-ensure-section');

    const content = fs.readFileSync(debtPath, 'utf-8');
    assert.ok(content.includes('# DEBT.md'), 'DEBT.md should contain the heading');
    assert.ok(content.includes('| id | type |'), 'DEBT.md should contain the table header row');
  });

  test('DEBT.md is not overwritten when config-ensure-section runs again', () => {
    const debtPath = path.join(tmpDir, '.planning', 'DEBT.md');
    assert.ok(fs.existsSync(debtPath), 'DEBT.md should already exist from previous test');

    // Append a custom entry row to simulate real usage
    const customLine = '| TD-001 | test | low | init | idempotent check | 2026-02-27 | tester | open | - | - |\n';
    fs.appendFileSync(debtPath, customLine, 'utf-8');

    // Run config-ensure-section again
    const result = runGsdToolsFull(['config-ensure-section'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);

    const contentAfter = fs.readFileSync(debtPath, 'utf-8');
    assert.ok(contentAfter.includes('TD-001'), 'DEBT.md custom entry should still be present (idempotent)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: FIX-04 — migrate --apply creates DEBT.md for existing projects
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX-04: migrate --apply creates DEBT.md for existing projects', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempProject();
    // Simulate legacy project: write config.json but no DEBT.md
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced', commit_docs: true }),
      'utf-8'
    );
    // Ensure DEBT.md does not exist (simulate pre-init project)
    const debtPath = path.join(tmpDir, '.planning', 'DEBT.md');
    if (fs.existsSync(debtPath)) {
      fs.unlinkSync(debtPath);
    }
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('migrate --dry-run reports missing DEBT.md', () => {
    const result = runGsdToolsFull(['migrate', '--dry-run'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);

    const data = JSON.parse(result.output);
    assert.ok(Array.isArray(data.changes), 'Response should have a changes array');

    const debtChange = data.changes.find(c => c.path && c.path.endsWith('DEBT.md'));
    assert.ok(debtChange, 'changes should include an entry for DEBT.md');
    assert.equal(debtChange.type, 'create_file', 'DEBT.md change type should be create_file');
  });

  test('migrate --apply creates DEBT.md', () => {
    const result = runGsdToolsFull(['migrate', '--apply'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);

    const debtPath = path.join(tmpDir, '.planning', 'DEBT.md');
    assert.ok(fs.existsSync(debtPath), 'DEBT.md should exist after migrate --apply');

    const content = fs.readFileSync(debtPath, 'utf-8');
    assert.ok(content.includes('# DEBT.md'), 'DEBT.md should contain the heading');
    assert.ok(content.includes('| id | type |'), 'DEBT.md should contain the table header row');
  });

  test('migrate --apply is idempotent for DEBT.md', () => {
    // Run apply again — DEBT.md should not be overwritten
    const debtPath = path.join(tmpDir, '.planning', 'DEBT.md');
    const before = fs.readFileSync(debtPath, 'utf-8');

    const result = runGsdToolsFull(['migrate', '--apply'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);

    const after = fs.readFileSync(debtPath, 'utf-8');
    assert.equal(after, before, 'DEBT.md content should not change on second apply run');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: FIX-05 — migrate --apply removes stale TO-DOS.md
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX-05: migrate --apply removes stale TO-DOS.md', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempProject();
    // Simulate legacy project with config.json and stale TO-DOS.md
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'balanced', commit_docs: true }),
      'utf-8'
    );
    // Create stale TO-DOS.md
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'TO-DOS.md'),
      '# TO-DOs\n\n- Some stale todo entry\n',
      'utf-8'
    );
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('migrate --dry-run reports stale TO-DOS.md', () => {
    const result = runGsdToolsFull(['migrate', '--dry-run'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);

    const data = JSON.parse(result.output);
    assert.ok(Array.isArray(data.changes), 'Response should have a changes array');

    const todosChange = data.changes.find(
      c => c.path && c.path.endsWith('TO-DOS.md') && c.type === 'remove_stale'
    );
    assert.ok(todosChange, 'changes should include an entry with type remove_stale for TO-DOS.md');
  });

  test('migrate --apply removes stale TO-DOS.md', () => {
    const result = runGsdToolsFull(['migrate', '--apply'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);

    const todosPath = path.join(tmpDir, '.planning', 'TO-DOS.md');
    assert.ok(!fs.existsSync(todosPath), 'TO-DOS.md should not exist after migrate --apply');
  });
});
