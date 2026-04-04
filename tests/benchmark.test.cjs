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

describe('benchmark-plan CLI subcommand', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('benchmark-plan writes entry to phase-benchmarks.jsonl', () => {
    const result = runGsdTools(
      ['state', 'benchmark-plan',
        '--phase', '39', '--plan', '01',
        '--type', 'implementation', '--quality-level', 'standard',
        '--duration', '45'],
      tmpDir
    );
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error}`);

    const filePath = path.join(tmpDir, '.planning', 'patterns', 'phase-benchmarks.jsonl');
    assert.ok(fs.existsSync(filePath), 'phase-benchmarks.jsonl should exist');

    const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n').filter(Boolean);
    assert.strictEqual(lines.length, 1, 'Should have one entry');

    const entry = JSON.parse(lines[0]);
    assert.strictEqual(String(entry.phase), '39', 'phase should be 39');
    assert.strictEqual(entry.plan, '01', 'plan should be "01"');
    assert.strictEqual(entry.phase_type, 'implementation', 'phase_type should match');
    assert.strictEqual(entry.quality_level, 'standard', 'quality_level should match');
    assert.strictEqual(entry.duration_min, 45, 'duration_min should be 45');
    assert.ok(typeof entry.correction_count === 'number' && entry.correction_count >= 0, 'correction_count should be >= 0');
    assert.ok(typeof entry.gate_fire_count === 'number' && entry.gate_fire_count >= 0, 'gate_fire_count should be >= 0');
    assert.ok(entry.timestamp && entry.timestamp.length > 0, 'timestamp should be non-empty');
  });

  test('benchmark-plan entry has phase_type and quality_level fields', () => {
    const result = runGsdTools(
      ['state', 'benchmark-plan',
        '--phase', '39', '--plan', '01',
        '--type', 'implementation', '--quality-level', 'standard',
        '--duration', '10'],
      tmpDir
    );
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error}`);

    const filePath = path.join(tmpDir, '.planning', 'patterns', 'phase-benchmarks.jsonl');
    const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n').filter(Boolean);
    const entry = JSON.parse(lines[0]);

    assert.strictEqual(entry.phase_type, 'implementation', 'phase_type field equals "implementation"');
    assert.strictEqual(entry.quality_level, 'standard', 'quality_level field equals "standard"');
  });

  test('benchmark-plan correction_count is 0 when corrections.jsonl is absent', () => {
    const result = runGsdTools(
      ['state', 'benchmark-plan',
        '--phase', '39', '--plan', '01',
        '--type', 'implementation', '--quality-level', 'standard'],
      tmpDir
    );
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error}`);

    const filePath = path.join(tmpDir, '.planning', 'patterns', 'phase-benchmarks.jsonl');
    const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n').filter(Boolean);
    const entry = JSON.parse(lines[0]);

    assert.strictEqual(entry.correction_count, 0, 'correction_count should be 0 when file absent');
  });

  test('benchmark-plan correction_count counts only matching phase corrections', () => {
    // 3 active corrections for phase 39, 2 for phase 40
    writePatternsFile(tmpDir, 'patterns', 'corrections.jsonl', [
      { phase: 39, correction: 'a', retired_at: null },
      { phase: 39, correction: 'b', retired_at: null },
      { phase: 39, correction: 'c', retired_at: null },
      { phase: 40, correction: 'd', retired_at: null },
      { phase: 40, correction: 'e', retired_at: null },
    ]);

    const result = runGsdTools(
      ['state', 'benchmark-plan',
        '--phase', '39', '--plan', '01',
        '--type', 'implementation', '--quality-level', 'standard'],
      tmpDir
    );
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error}`);

    const filePath = path.join(tmpDir, '.planning', 'patterns', 'phase-benchmarks.jsonl');
    const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n').filter(Boolean);
    const entry = JSON.parse(lines[0]);

    assert.strictEqual(entry.correction_count, 3, 'Should count exactly 3 corrections for phase 39');
  });

  test('benchmark-plan gate_fire_count counts matching gate entries', () => {
    // 2 matching phase=39 plan=01, 2 non-matching
    writePatternsFile(tmpDir, 'observations', 'gate-executions.jsonl', [
      { phase: 39, plan: '01', gate: 'x' },
      { phase: 39, plan: '01', gate: 'y' },
      { phase: 39, plan: '02', gate: 'z' },
      { phase: 40, plan: '01', gate: 'w' },
    ]);

    const result = runGsdTools(
      ['state', 'benchmark-plan',
        '--phase', '39', '--plan', '01',
        '--type', 'implementation', '--quality-level', 'standard'],
      tmpDir
    );
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error}`);

    const filePath = path.join(tmpDir, '.planning', 'patterns', 'phase-benchmarks.jsonl');
    const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n').filter(Boolean);
    const entry = JSON.parse(lines[0]);

    assert.strictEqual(entry.gate_fire_count, 2, 'Should count exactly 2 matching gate entries');
  });
});
