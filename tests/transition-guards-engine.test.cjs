'use strict';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { verifyAssertions } = require('../get-shit-done/bin/lib/transition-guards.cjs');

// Helper: make a minimal assertion object
function makeAssertion(overrides) {
  return {
    type: 'file-exists',
    raw: 'test bullet',
    taskId: '1',
    taskTitle: 'Test Task',
    planFile: '99-01-PLAN.md',
    ...overrides,
  };
}

describe('verifyAssertions — file-exists', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-engine-'));
    fs.writeFileSync(path.join(tmpDir, 'present.cjs'), "'use strict';\n", 'utf-8');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  test('pass when file exists', () => {
    const assertions = [
      makeAssertion({ type: 'file-exists', filePath: 'present.cjs' }),
    ];
    const results = verifyAssertions(assertions, tmpDir);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].outcome, 'pass');
  });

  test('fail when file does not exist', () => {
    const assertions = [
      makeAssertion({ type: 'file-exists', filePath: 'missing.cjs' }),
    ];
    const results = verifyAssertions(assertions, tmpDir);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].outcome, 'fail');
    assert.ok(results[0].detail, 'should have detail explaining failure');
  });

  test('needs-human when no filePath extracted', () => {
    const assertions = [
      makeAssertion({ type: 'file-exists', filePath: undefined }),
    ];
    const results = verifyAssertions(assertions, tmpDir);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].outcome, 'needs-human');
  });

  test('resolves relative path against cwd', () => {
    const subDir = path.join(tmpDir, 'sub');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, 'nested.cjs'), '', 'utf-8');

    const assertions = [
      makeAssertion({ type: 'file-exists', filePath: 'sub/nested.cjs' }),
    ];
    const results = verifyAssertions(assertions, tmpDir);
    assert.strictEqual(results[0].outcome, 'pass');
  });
});

describe('verifyAssertions — grep-for-export', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-grep-'));
    fs.writeFileSync(
      path.join(tmpDir, 'module.cjs'),
      "'use strict';\nconst VALID_GATES = new Set(['eslint_gate', 'test_gate']);\nmodule.exports = {};\n",
      'utf-8'
    );
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  test('pass when pattern found in file', () => {
    const assertions = [
      makeAssertion({ type: 'grep-for-export', filePath: 'module.cjs', pattern: 'eslint_gate' }),
    ];
    const results = verifyAssertions(assertions, tmpDir);
    assert.strictEqual(results[0].outcome, 'pass');
  });

  test('fail when pattern not found in file', () => {
    const assertions = [
      makeAssertion({ type: 'grep-for-export', filePath: 'module.cjs', pattern: 'unknown_gate' }),
    ];
    const results = verifyAssertions(assertions, tmpDir);
    assert.strictEqual(results[0].outcome, 'fail');
    assert.ok(results[0].detail);
  });

  test('fail when file does not exist', () => {
    const assertions = [
      makeAssertion({ type: 'grep-for-export', filePath: 'ghost.cjs', pattern: 'something' }),
    ];
    const results = verifyAssertions(assertions, tmpDir);
    assert.strictEqual(results[0].outcome, 'fail');
    assert.ok(results[0].detail.includes('not found'));
  });

  test('needs-human when filePath missing', () => {
    const assertions = [
      makeAssertion({ type: 'grep-for-export', filePath: undefined, pattern: 'something' }),
    ];
    const results = verifyAssertions(assertions, tmpDir);
    assert.strictEqual(results[0].outcome, 'needs-human');
  });

  test('needs-human when pattern missing', () => {
    const assertions = [
      makeAssertion({ type: 'grep-for-export', filePath: 'module.cjs', pattern: undefined }),
    ];
    const results = verifyAssertions(assertions, tmpDir);
    assert.strictEqual(results[0].outcome, 'needs-human');
  });
});

describe('verifyAssertions — test-passes', () => {
  test('needs-human when runTests=false (default)', () => {
    const assertions = [
      makeAssertion({ type: 'test-passes' }),
    ];
    const results = verifyAssertions(assertions, process.cwd());
    assert.strictEqual(results[0].outcome, 'needs-human');
    assert.ok(results[0].detail.includes('runTests=false'));
  });

  test('needs-human when runTests=true but no test file in criterion', () => {
    const assertions = [
      makeAssertion({ type: 'test-passes', raw: 'All tests pass' }),
    ];
    const results = verifyAssertions(assertions, process.cwd(), { runTests: true });
    assert.strictEqual(results[0].outcome, 'needs-human');
  });

  test('fail when runTests=true and named test file does not exist', () => {
    const assertions = [
      makeAssertion({
        type: 'test-passes',
        raw: 'All tests in `tests/nonexistent.test.cjs` pass',
      }),
    ];
    const results = verifyAssertions(assertions, process.cwd(), { runTests: true });
    assert.strictEqual(results[0].outcome, 'fail');
    assert.ok(results[0].detail.includes('not found'));
  });
});

describe('verifyAssertions — human-check', () => {
  test('always returns needs-human', () => {
    const assertions = [
      makeAssertion({ type: 'human-check', raw: 'The UI looks correct' }),
    ];
    const results = verifyAssertions(assertions, process.cwd());
    assert.strictEqual(results[0].outcome, 'needs-human');
    assert.strictEqual(results[0].detail, 'requires human judgment');
  });
});

describe('verifyAssertions — mixed batch', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-mixed-'));
    fs.writeFileSync(path.join(tmpDir, 'exists.cjs'), '', 'utf-8');
    fs.writeFileSync(
      path.join(tmpDir, 'searchable.cjs'),
      'const EXPORT_NAME = "guard";\n',
      'utf-8'
    );
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  test('returns one result per assertion in input order', () => {
    const assertions = [
      makeAssertion({ type: 'file-exists', filePath: 'exists.cjs' }),
      makeAssertion({ type: 'grep-for-export', filePath: 'searchable.cjs', pattern: 'EXPORT_NAME' }),
      makeAssertion({ type: 'human-check', raw: 'Verify visually' }),
      makeAssertion({ type: 'file-exists', filePath: 'missing.cjs' }),
    ];
    const results = verifyAssertions(assertions, tmpDir);
    assert.strictEqual(results.length, 4);
    assert.strictEqual(results[0].outcome, 'pass');
    assert.strictEqual(results[1].outcome, 'pass');
    assert.strictEqual(results[2].outcome, 'needs-human');
    assert.strictEqual(results[3].outcome, 'fail');
  });

  test('returns empty array for empty input', () => {
    const results = verifyAssertions([], tmpDir);
    assert.deepStrictEqual(results, []);
  });
});
