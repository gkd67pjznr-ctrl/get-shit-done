/**
 * GSD Tools Tests - DEBT.md Initialization
 *
 * FIX-03: config-ensure-section creates DEBT.md alongside config.json
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
