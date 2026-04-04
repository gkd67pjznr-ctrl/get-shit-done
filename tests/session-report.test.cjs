'use strict';
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

/**
 * Write lines to a patterns or observations file in tmpDir.
 */
function writePatternsFile(tmpDir, subdir, filename, lines) {
  const dir = path.join(tmpDir, '.planning', subdir);
  fs.mkdirSync(dir, { recursive: true });
  const content = lines.map(l => JSON.stringify(l)).join('\n') + '\n';
  fs.writeFileSync(path.join(dir, filename), content, 'utf-8');
}

describe('session-report module — SRPT-01', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('cmdSessionReport returns rows with correction_count, gate_fire_count, skills fields', () => {
    writePatternsFile(tmpDir, 'patterns', 'sessions.jsonl', [
      { timestamp: '2026-04-01T10:00:00Z', type: 'wrapper_execution', phase: '40', skills_loaded: ['gsd-workflow'], commits_during: 1 },
    ]);
    writePatternsFile(tmpDir, 'observations', 'gate-executions.jsonl', [
      { phase: '40', plan: '01', gate: 'quality', outcome: 'pass' },
    ]);
    writePatternsFile(tmpDir, 'patterns', 'corrections.jsonl', [
      { phase: '40', correction: 'a', retired_at: null },
    ]);

    const result = runGsdTools(['session-report', '--last', '5', '--raw'], tmpDir);
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(Array.isArray(output.sessions), 'sessions should be an array');
    assert.strictEqual(output.sessions.length, 1, 'should have 1 session');

    const session = output.sessions[0];
    assert.strictEqual(typeof session.correction_count, 'number', 'correction_count should be a number');
    assert.strictEqual(typeof session.gate_fire_count, 'number', 'gate_fire_count should be a number');
    assert.ok(Array.isArray(session.skills), 'skills should be an array');
    assert.strictEqual(session.correction_count, 1, 'correction_count should be 1');
    assert.strictEqual(session.gate_fire_count, 1, 'gate_fire_count should be 1');
    assert.deepStrictEqual(session.skills, ['gsd-workflow'], 'skills should equal ["gsd-workflow"]');
  });

  test('session with no corrections returns correction_count: 0', () => {
    writePatternsFile(tmpDir, 'patterns', 'sessions.jsonl', [
      { timestamp: '2026-04-01T10:00:00Z', type: 'wrapper_execution', phase: '39', skills_loaded: [] },
    ]);

    const result = runGsdTools(['session-report', '--last', '5', '--raw'], tmpDir);
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.sessions[0].correction_count, 0, 'correction_count should be 0');
  });

  test('session with no gate entries returns gate_fire_count: 0', () => {
    writePatternsFile(tmpDir, 'patterns', 'sessions.jsonl', [
      { timestamp: '2026-04-01T10:00:00Z', type: 'wrapper_execution', phase: '39', skills_loaded: [] },
    ]);

    const result = runGsdTools(['session-report', '--last', '5', '--raw'], tmpDir);
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.sessions[0].gate_fire_count, 0, 'gate_fire_count should be 0');
  });

  test('skills field is empty array when skills_loaded is absent', () => {
    writePatternsFile(tmpDir, 'patterns', 'sessions.jsonl', [
      { timestamp: '2026-04-01T10:00:00Z', type: 'wrapper_execution', phase: '39' },
    ]);

    const result = runGsdTools(['session-report', '--last', '5', '--raw'], tmpDir);
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error}`);

    const output = JSON.parse(result.output);
    const row = output.sessions[0];
    assert.ok(Array.isArray(row.skills), 'skills should be an array');
    assert.strictEqual(row.skills.length, 0, 'skills should be empty array');
  });
});

describe('session-report module — SRPT-02', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('--last N slices to N most recent wrapper entries', () => {
    writePatternsFile(tmpDir, 'patterns', 'sessions.jsonl', [
      { timestamp: '2026-01-01T00:00:00Z', type: 'wrapper_execution', phase: '35' },
      { timestamp: '2026-01-02T00:00:00Z', type: 'wrapper_execution', phase: '36' },
      { timestamp: '2026-01-03T00:00:00Z', type: 'wrapper_execution', phase: '37' },
      { timestamp: '2026-01-04T00:00:00Z', type: 'wrapper_execution', phase: '38' },
      { timestamp: '2026-01-05T00:00:00Z', type: 'wrapper_execution', phase: '39' },
    ]);

    const result = runGsdTools(['session-report', '--last', '3', '--raw'], tmpDir);
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.sessions.length, 3, 'should return exactly 3 sessions');

    // Should be the 3 most recent (sorted descending by timestamp)
    const phases = output.sessions.map(s => s.phase);
    assert.ok(phases.includes('39'), 'most recent phase 39 should be included');
    assert.ok(phases.includes('38'), 'phase 38 should be included');
    assert.ok(phases.includes('37'), 'phase 37 should be included');
  });

  test('non-wrapper entries are excluded from session list', () => {
    writePatternsFile(tmpDir, 'patterns', 'sessions.jsonl', [
      { timestamp: '2026-04-01T10:00:00Z', type: 'wrapper_execution', phase: '40' },
      { timestamp: '2026-04-01T11:00:00Z', type: 'observation', phase: '40' },
    ]);

    const result = runGsdTools(['session-report', '--last', '10', '--raw'], tmpDir);
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.sessions.length, 1, 'should only include wrapper entry');
  });

  test('--last defaults to 10 when omitted', () => {
    const entries = [];
    for (let i = 1; i <= 15; i++) {
      entries.push({ timestamp: `2026-01-${String(i).padStart(2, '0')}T00:00:00Z`, type: 'wrapper_execution', phase: String(i) });
    }
    writePatternsFile(tmpDir, 'patterns', 'sessions.jsonl', entries);

    const result = runGsdTools(['session-report', '--raw'], tmpDir);
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.sessions.length, 10, 'default --last should be 10');
  });
});

describe('session-report module — SRPT-03', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('benchmark trends section present when phase-benchmarks.jsonl has entries', () => {
    writePatternsFile(tmpDir, 'patterns', 'sessions.jsonl', [
      { timestamp: '2026-04-01T10:00:00Z', type: 'wrapper_execution', phase: '40' },
    ]);
    writePatternsFile(tmpDir, 'patterns', 'phase-benchmarks.jsonl', [
      { phase: '40', plan: '01', phase_type: 'implementation', quality_level: 'standard', correction_count: 2, gate_fire_count: 1, timestamp: '2026-04-01T10:00:00Z' },
    ]);

    const result = runGsdTools(['session-report', '--last', '5', '--raw'], tmpDir);
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(Array.isArray(output.benchmarks), 'benchmarks should be an array');
    assert.ok(output.benchmarks.length >= 1, 'benchmarks should have at least 1 entry');
    assert.ok(output.benchmark_trends !== undefined && output.benchmark_trends !== null, 'benchmark_trends should be present');
    assert.ok(typeof output.benchmark_trends.avg_corrections === 'number', 'benchmark_trends should have avg_corrections field');
  });

  test('benchmark trends omitted when phase-benchmarks.jsonl is absent', () => {
    writePatternsFile(tmpDir, 'patterns', 'sessions.jsonl', [
      { timestamp: '2026-04-01T10:00:00Z', type: 'wrapper_execution', phase: '40' },
    ]);

    const result = runGsdTools(['session-report', '--last', '5', '--raw'], tmpDir);
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error}`);

    const output = JSON.parse(result.output);
    const hasBenchmarks = output.benchmarks !== undefined && Array.isArray(output.benchmarks) && output.benchmarks.length > 0;
    assert.ok(!hasBenchmarks, 'benchmarks should be absent or empty when file is missing');
    assert.ok(output.benchmark_trends == null, 'benchmark_trends should be absent or null');
  });
});

module.exports = {};
