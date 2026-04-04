'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseDoneCriteria, parseSinglePlan } = require('../get-shit-done/bin/lib/transition-guards.cjs');

// Helper: write a temp PLAN.md with given tasks XML
function writeTempPlan(tasks) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-'));
  const content = `---\nphase: 99\nplan: 01\n---\n\n# Test Plan\n\n## Tasks\n\n${tasks}\n`;
  const filePath = path.join(dir, '99-01-PLAN.md');
  fs.writeFileSync(filePath, content, 'utf-8');
  return { dir, filePath };
}

describe('parseDoneCriteria — empty and missing', () => {
  test('returns empty array for non-existent directory', () => {
    const result = parseDoneCriteria('/non/existent/dir/xyz');
    assert.deepStrictEqual(result, []);
  });

  test('returns empty array when directory has no PLAN.md files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tg-empty-'));
    fs.writeFileSync(path.join(dir, 'VERIFICATION.md'), '# V', 'utf-8');
    const result = parseDoneCriteria(dir);
    assert.deepStrictEqual(result, []);
    fs.rmSync(dir, { recursive: true });
  });

  test('returns empty array for plan with no task blocks', () => {
    const { dir, filePath } = writeTempPlan('');
    const result = parseDoneCriteria(dir);
    assert.deepStrictEqual(result, []);
    fs.rmSync(dir, { recursive: true });
  });

  test('returns empty array for task with no done block', () => {
    const { dir } = writeTempPlan(
      '<task id="1"><title>No done block</title><action>Do something</action></task>'
    );
    const result = parseDoneCriteria(dir);
    assert.deepStrictEqual(result, []);
    fs.rmSync(dir, { recursive: true });
  });
});

describe('parseDoneCriteria — file-exists classification', () => {
  test('classifies "file X exists" as file-exists', () => {
    const { dir } = writeTempPlan(
      '<task id="1"><title>Create module</title><done>\n- File `get-shit-done/bin/lib/foo.cjs` exists\n</done></task>'
    );
    const result = parseDoneCriteria(dir);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].type, 'file-exists');
    assert.strictEqual(result[0].filePath, 'get-shit-done/bin/lib/foo.cjs');
    assert.strictEqual(result[0].taskId, '1');
    fs.rmSync(dir, { recursive: true });
  });

  test('classifies "loads without error" as file-exists', () => {
    const { dir } = writeTempPlan(
      '<task id="2"><title>Wire hook</title><done>\n- `write-gate-execution.cjs` loads without error\n</done></task>'
    );
    const result = parseDoneCriteria(dir);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].type, 'file-exists');
    assert.ok(result[0].filePath);
    fs.rmSync(dir, { recursive: true });
  });

  test('classifies "created" as file-exists', () => {
    const { dir } = writeTempPlan(
      '<task id="3"><title>Scaffold</title><done>\n- `tests/my-module.test.cjs` created\n</done></task>'
    );
    const result = parseDoneCriteria(dir);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].type, 'file-exists');
    fs.rmSync(dir, { recursive: true });
  });
});

describe('parseDoneCriteria — grep-for-export classification', () => {
  test('classifies "X appears in file" as grep-for-export', () => {
    const { dir } = writeTempPlan(
      '<task id="1"><title>Add gate</title><done>\n- `eslint_gate` appears in the VALID_GATES set in `write-gate-execution.cjs`\n</done></task>'
    );
    const result = parseDoneCriteria(dir);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].type, 'grep-for-export');
    assert.strictEqual(result[0].pattern, 'eslint_gate');
    fs.rmSync(dir, { recursive: true });
  });

  test('classifies "set includes X" as grep-for-export', () => {
    const { dir } = writeTempPlan(
      '<task id="2"><title>Check set</title><done>\n- VALID_GATES set includes `eslint_gate` in `write-gate-execution.cjs`\n</done></task>'
    );
    const result = parseDoneCriteria(dir);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].type, 'grep-for-export');
    fs.rmSync(dir, { recursive: true });
  });

  test('classifies "contains" as grep-for-export', () => {
    const { dir } = writeTempPlan(
      '<task id="3"><title>Verify export</title><done>\n- `gate-runner.cjs` contains `module.exports`\n</done></task>'
    );
    const result = parseDoneCriteria(dir);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].type, 'grep-for-export');
    fs.rmSync(dir, { recursive: true });
  });
});

describe('parseDoneCriteria — test-passes classification', () => {
  test('classifies "zero test failures" as test-passes', () => {
    const { dir } = writeTempPlan(
      '<task id="1"><title>Run tests</title><done>\n- Zero test failures across both test files\n</done></task>'
    );
    const result = parseDoneCriteria(dir);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].type, 'test-passes');
    fs.rmSync(dir, { recursive: true });
  });

  test('classifies "all tests pass" as test-passes', () => {
    const { dir } = writeTempPlan(
      '<task id="2"><title>Verify suite</title><done>\n- All tests in the file pass\n</done></task>'
    );
    const result = parseDoneCriteria(dir);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].type, 'test-passes');
    fs.rmSync(dir, { recursive: true });
  });
});

describe('parseDoneCriteria — human-check classification', () => {
  test('classifies unrecognized criterion as human-check', () => {
    const { dir } = writeTempPlan(
      '<task id="1"><title>Manual</title><done>\n- The UI renders correctly at 1440px\n</done></task>'
    );
    const result = parseDoneCriteria(dir);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].type, 'human-check');
    fs.rmSync(dir, { recursive: true });
  });

  test('classifies runtime assertion as human-check', () => {
    const { dir } = writeTempPlan(
      '<task id="2"><title>Runtime check</title><done>\n- `detectGate("Write", { file_path: "/tmp/foo.ts" })` returns an object with `gate: "eslint_gate"`\n</done></task>'
    );
    const result = parseDoneCriteria(dir);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].type, 'human-check');
    fs.rmSync(dir, { recursive: true });
  });
});

describe('parseDoneCriteria — multi-task and multi-plan', () => {
  test('extracts assertions from multiple tasks in one plan', () => {
    const { dir } = writeTempPlan(
      `<task id="1"><title>Task 1</title><done>
- File \`foo.cjs\` exists
- All tests pass
</done></task>
<task id="2"><title>Task 2</title><done>
- \`bar\` appears in \`baz.cjs\`
</done></task>`
    );
    const result = parseDoneCriteria(dir);
    assert.strictEqual(result.length, 3);
    const types = result.map(a => a.type);
    assert.ok(types.includes('file-exists'), 'should have file-exists');
    assert.ok(types.includes('test-passes'), 'should have test-passes');
    assert.ok(types.includes('grep-for-export'), 'should have grep-for-export');
    fs.rmSync(dir, { recursive: true });
  });

  test('parseSinglePlan returns assertions for a specific plan file', () => {
    const { filePath, dir } = writeTempPlan(
      '<task id="1"><title>Single</title><done>\n- File `x.cjs` exists\n</done></task>'
    );
    const result = parseSinglePlan(filePath);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].type, 'file-exists');
    fs.rmSync(dir, { recursive: true });
  });

  test('each assertion has taskId, taskTitle, and planFile fields', () => {
    const { dir } = writeTempPlan(
      '<task id="42"><title>My Task</title><done>\n- `foo.cjs` exists\n</done></task>'
    );
    const result = parseDoneCriteria(dir);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].taskId, '42');
    assert.strictEqual(result[0].taskTitle, 'My Task');
    assert.ok(result[0].planFile.endsWith('-PLAN.md'), 'planFile should end with -PLAN.md');
    fs.rmSync(dir, { recursive: true });
  });
});
