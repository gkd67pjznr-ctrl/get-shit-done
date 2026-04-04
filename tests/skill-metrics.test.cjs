'use strict';
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

/**
 * Write lines to a patterns or observations file in tmpDir.
 * @param {string} tmpDir
 * @param {'patterns'|'observations'} subdir
 * @param {string} filename
 * @param {object[]} lines - array of objects to serialize as JSONL
 */
function writePatternsFile(tmpDir, subdir, filename, lines) {
  const dir = path.join(tmpDir, '.planning', subdir);
  fs.mkdirSync(dir, { recursive: true });
  const content = lines.map(l => JSON.stringify(l)).join('\n') + '\n';
  fs.writeFileSync(path.join(dir, filename), content, 'utf-8');
}

describe('skill-metrics module — SQLQ-01 attribution', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('corrections are attributed via CATEGORY_SKILL_MAP, not session co-presence', () => {
    writePatternsFile(tmpDir, 'patterns', 'corrections.jsonl', [
      { phase: '22', diagnosis_category: 'process.convention_violation', retired_at: null },
      { phase: '23', diagnosis_category: 'code.wrong_pattern', retired_at: null },
      { phase: '24', diagnosis_category: 'process.convention_violation', retired_at: null },
    ]);
    writePatternsFile(tmpDir, 'patterns', 'sessions.jsonl', [
      { type: 'wrapper_execution', phase: '22', skills_loaded: ['gsd-workflow', 'code-review'] },
    ]);
    const result = runGsdTools(['skill-metrics', 'compute', '--raw'], tmpDir);
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.skills['session-awareness'].correction_count, 2,
      'two process.convention_violation entries should map to session-awareness');
    assert.strictEqual(output.skills['typescript-patterns'].correction_count, 1,
      'one code.wrong_pattern should map to typescript-patterns');
    const gwf = output.skills['gsd-workflow'];
    assert.ok(!gwf || gwf.correction_count === 0,
      'gsd-workflow should have no attributed corrections despite being in sessions.jsonl');
  });

  test('retired corrections are excluded from attribution', () => {
    writePatternsFile(tmpDir, 'patterns', 'corrections.jsonl', [
      { phase: '22', diagnosis_category: 'process.convention_violation', retired_at: null },
      { phase: '23', diagnosis_category: 'process.convention_violation', retired_at: '2026-04-01T00:00:00Z' },
    ]);
    const result = runGsdTools(['skill-metrics', 'compute', '--raw'], tmpDir);
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.skills['session-awareness'].correction_count, 1,
      'only the non-retired correction should be counted');
  });

  test('unmapped diagnosis_category is excluded without error and counted in metadata', () => {
    writePatternsFile(tmpDir, 'patterns', 'corrections.jsonl', [
      { phase: '22', diagnosis_category: 'unknown.future_category', retired_at: null },
      { phase: '23', diagnosis_category: 'process.convention_violation', retired_at: null },
    ]);
    const result = runGsdTools(['skill-metrics', 'compute', '--raw'], tmpDir);
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.metadata.unmapped_correction_count, 1,
      'unmapped correction should be counted in metadata');
    assert.strictEqual(output.skills['session-awareness'].correction_count, 1,
      'mapped correction should still be counted');
  });
});

describe('skill-metrics module — SQLQ-02 storage format', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('correction_rate is null (not NaN or Infinity) when session_count is 0', () => {
    writePatternsFile(tmpDir, 'patterns', 'corrections.jsonl', [
      { phase: '22', diagnosis_category: 'process.convention_violation', retired_at: null },
    ]);
    // Do NOT write sessions.jsonl — no session data
    const result = runGsdTools(['skill-metrics', 'compute', '--raw'], tmpDir);
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error}`);
    // Must parse without error (no NaN/Infinity in output)
    const output = JSON.parse(result.output);
    assert.strictEqual(output.skills['session-awareness'].correction_rate, null,
      'correction_rate should be null when session_count is 0');
    assert.strictEqual(output.skills['session-awareness'].session_count, 0,
      'session_count should be 0 when no sessions file exists');
  });

  test('attribution_confidence is high when sessionCount >= 10 and correctionCount > 0', () => {
    writePatternsFile(tmpDir, 'patterns', 'corrections.jsonl', [
      { phase: '22', diagnosis_category: 'process.convention_violation', retired_at: null },
    ]);
    writePatternsFile(tmpDir, 'patterns', 'sessions.jsonl',
      Array(10).fill({ type: 'wrapper_execution', phase: '22', skills_loaded: ['session-awareness'] })
    );
    const result = runGsdTools(['skill-metrics', 'compute', '--raw'], tmpDir);
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.skills['session-awareness'].attribution_confidence, 'high');
  });

  test('attribution_confidence is medium when sessionCount >= 3', () => {
    writePatternsFile(tmpDir, 'patterns', 'corrections.jsonl', [
      { phase: '22', diagnosis_category: 'process.convention_violation', retired_at: null },
    ]);
    writePatternsFile(tmpDir, 'patterns', 'sessions.jsonl',
      Array(3).fill({ type: 'wrapper_execution', phase: '22', skills_loaded: ['session-awareness'] })
    );
    const result = runGsdTools(['skill-metrics', 'compute', '--raw'], tmpDir);
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.skills['session-awareness'].attribution_confidence, 'medium');
  });

  test('attribution_confidence is low when sessionCount < 3', () => {
    writePatternsFile(tmpDir, 'patterns', 'corrections.jsonl', [
      { phase: '22', diagnosis_category: 'process.convention_violation', retired_at: null },
    ]);
    writePatternsFile(tmpDir, 'patterns', 'sessions.jsonl', [
      { type: 'wrapper_execution', phase: '22', skills_loaded: ['session-awareness'] },
    ]);
    const result = runGsdTools(['skill-metrics', 'compute', '--raw'], tmpDir);
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.skills['session-awareness'].attribution_confidence, 'low');
  });

  test('skill-metrics.json is written to .planning/patterns/ and is valid JSON', () => {
    writePatternsFile(tmpDir, 'patterns', 'corrections.jsonl', [
      { phase: '22', diagnosis_category: 'process.convention_violation', retired_at: null },
    ]);
    const result = runGsdTools(['skill-metrics', 'compute'], tmpDir);
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error}`);
    const filePath = path.join(tmpDir, '.planning', 'patterns', 'skill-metrics.json');
    assert.ok(fs.existsSync(filePath), 'skill-metrics.json should exist');
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.ok(typeof parsed.metadata === 'object', 'should have metadata key');
    assert.ok(typeof parsed.skills === 'object', 'should have skills key');
  });
});

describe('skill-metrics module — SQLQ-03 CLI output', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('skill-metrics compute --raw outputs valid JSON with correction_count field', () => {
    writePatternsFile(tmpDir, 'patterns', 'corrections.jsonl', [
      { phase: '22', diagnosis_category: 'code.wrong_pattern', retired_at: null },
    ]);
    const result = runGsdTools(['skill-metrics', 'compute', '--raw'], tmpDir);
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.skills['typescript-patterns'].correction_count, 1);
  });

  test('skill-metrics show formats table with absolute counts when file exists', () => {
    writePatternsFile(tmpDir, 'patterns', 'corrections.jsonl', [
      { phase: '22', diagnosis_category: 'process.convention_violation', retired_at: null },
    ]);
    const computeResult = runGsdTools(['skill-metrics', 'compute'], tmpDir);
    assert.strictEqual(computeResult.success, true, `compute should succeed: ${computeResult.error}`);
    const showResult = runGsdTools(['skill-metrics', 'show'], tmpDir);
    assert.strictEqual(showResult.success, true, `show should succeed: ${showResult.error}`);
    assert.ok(showResult.output.includes('Corrections'), 'should include Corrections header');
    assert.ok(showResult.output.includes('Sessions'), 'should include Sessions header');
  });

  test('skill-metrics show returns error message when file does not exist', () => {
    // Do NOT run compute
    const result = runGsdTools(['skill-metrics', 'show'], tmpDir);
    assert.strictEqual(result.success, true, 'command should not exit non-zero');
    assert.ok(result.output.includes('skill-metrics compute'), 'should include guidance to run compute');
  });
});

module.exports = {};
