'use strict';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { createTempProject, cleanup } = require('./helpers.cjs');
const { detectGate, evaluateGate } = require('../.claude/hooks/lib/gate-runner.cjs');

describe('eslint_gate detection', () => {
  test('detectGate returns eslint_gate for .ts Write', () => {
    const result = detectGate('Write', { file_path: '/some/project/src/foo.ts' });
    assert.ok(result, 'result must not be null');
    assert.strictEqual(result.gate, 'eslint_gate');
    assert.strictEqual(result.filePath, '/some/project/src/foo.ts');
  });

  test('detectGate returns eslint_gate for .js Write', () => {
    const result = detectGate('Write', { file_path: '/some/project/src/bar.js' });
    assert.ok(result, 'result must not be null');
    assert.strictEqual(result.gate, 'eslint_gate');
  });

  test('detectGate returns eslint_gate for .cjs Write', () => {
    const result = detectGate('Write', { file_path: '/some/project/lib/helper.cjs' });
    assert.ok(result, 'result must not be null');
    assert.strictEqual(result.gate, 'eslint_gate');
  });

  test('detectGate returns null for .md Write', () => {
    const result = detectGate('Write', { file_path: '/some/project/README.md' });
    assert.strictEqual(result, null);
  });

  test('detectGate returns null for .json Write', () => {
    const result = detectGate('Write', { file_path: '/some/project/config.json' });
    assert.strictEqual(result, null);
  });

  test('detectGate returns test_gate for Bash test command', () => {
    const result = detectGate('Bash', { command: 'npm test' });
    assert.ok(result, 'result must not be null');
    assert.strictEqual(result.gate, 'test_gate');
  });
});

describe('eslint_gate evaluation — quality level gating', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempProject();
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('fast mode skips eslint_gate', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ quality: { level: 'fast' } }),
      'utf-8'
    );
    const result = evaluateGate(
      'Write',
      { file_path: path.join(tmpDir, 'src', 'foo.ts') },
      '',
      { cwd: tmpDir, sessionId: 'test' }
    );
    assert.strictEqual(result.evaluated, false);
    assert.strictEqual(result.reason, 'fast_mode_skip');
  });

  test('standard mode evaluates eslint_gate', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ quality: { level: 'standard' } }),
      'utf-8'
    );
    // Write a real JS file to lint (contents do not matter for gate trigger)
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'foo.ts'), 'const x = 1;\n', 'utf-8');

    const result = evaluateGate(
      'Write',
      { file_path: path.join(srcDir, 'foo.ts') },
      '',
      { cwd: tmpDir, sessionId: 'test' }
    );
    // evaluated must be true regardless of ESLint availability
    assert.strictEqual(result.evaluated, true);
    assert.strictEqual(result.gate, 'eslint_gate');
    // outcome is one of: passed, warned, blocked
    assert.ok(
      ['passed', 'warned', 'blocked'].includes(result.outcome),
      `outcome must be passed/warned/blocked, got: ${result.outcome}`
    );
  });

  test('entry has correct gate_type field when written', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ quality: { level: 'standard' } }),
      'utf-8'
    );
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'bar.js'), 'const y = 2;\n', 'utf-8');

    const result = evaluateGate(
      'Write',
      { file_path: path.join(srcDir, 'bar.js') },
      '',
      { cwd: tmpDir, sessionId: 'test' }
    );
    assert.strictEqual(result.evaluated, true);
    assert.ok(result.entry, 'entry must be present');
    assert.strictEqual(result.entry.gate, 'eslint_gate');
    assert.ok(result.entry.timestamp, 'timestamp must be present');
    assert.ok(result.entry.quality_level, 'quality_level must be present');
  });

  test('eslint_unavailable detail set when eslint not found', () => {
    // This test validates that degradation path is reachable via the entry detail field.
    // If ESLint IS installed in the test environment, this will not exercise the path —
    // in that case the test passes trivially (outcome will be passed or blocked).
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ quality: { level: 'standard' } }),
      'utf-8'
    );
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'baz.cjs'), "'use strict';\n", 'utf-8');

    const result = evaluateGate(
      'Write',
      { file_path: path.join(srcDir, 'baz.cjs') },
      '',
      { cwd: tmpDir, sessionId: 'test' }
    );
    assert.strictEqual(result.evaluated, true);
    // If degraded: outcome is 'warned', detail includes 'eslint_unavailable'
    // If ESLint present: outcome is 'passed' or 'blocked'
    if (result.outcome === 'warned') {
      assert.ok(
        result.entry && result.entry.detail && result.entry.detail.includes('eslint_unavailable'),
        'degraded outcome must have eslint_unavailable in detail'
      );
    }
  });
});
