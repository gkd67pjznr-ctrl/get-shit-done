/**
 * Tests for debt commands: debt log, debt list, debt resolve
 * TDD test suite — RED phase: all tests fail until debt.cjs is implemented
 */

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, runGsdToolsFull, createTempProject, cleanup } = require('./helpers.cjs');

describe('debt commands', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  // ─── debt log ──────────────────────────────────────────────────────────────

  describe('debt log', () => {
    test('creates DEBT.md with 10-column header and returns TD-001', () => {
      const result = runGsdTools(
        'debt log --type code --severity high --component debt.cjs --description "Test entry" --logged-by test --source-phase 16 --source-plan 16-01',
        tmpDir
      );
      assert.ok(result.success, `Command failed: ${result.error}`);
      const out = JSON.parse(result.output);
      assert.strictEqual(out.id, 'TD-001');
      assert.strictEqual(out.logged, true);

      // DEBT.md must exist
      const debtPath = path.join(tmpDir, '.planning', 'DEBT.md');
      assert.ok(fs.existsSync(debtPath), 'DEBT.md should be created');

      // Header must contain 10-column header row
      const content = fs.readFileSync(debtPath, 'utf-8');
      assert.ok(content.includes('| id | type | severity | component | description | date_logged | logged_by | status | source_phase | source_plan |'),
        'DEBT.md should have 10-column header');

      // Must have separator row
      assert.ok(content.includes('|----|'), 'DEBT.md should have separator row');

      // Must contain the TD-001 entry
      assert.ok(content.includes('TD-001'), 'DEBT.md should contain TD-001 row');
    });

    test('second log returns TD-002 with sequential ID', () => {
      runGsdTools(
        'debt log --type code --severity high --component debt.cjs --description "First entry" --logged-by test --source-phase 16 --source-plan 16-01',
        tmpDir
      );
      const result = runGsdTools(
        'debt log --type test --severity medium --component debt.test.cjs --description "Second entry" --logged-by test --source-phase 16 --source-plan 16-01',
        tmpDir
      );
      assert.ok(result.success, `Command failed: ${result.error}`);
      const out = JSON.parse(result.output);
      assert.strictEqual(out.id, 'TD-002');
      assert.strictEqual(out.logged, true);

      // Both entries must be in file
      const content = fs.readFileSync(path.join(tmpDir, '.planning', 'DEBT.md'), 'utf-8');
      assert.ok(content.includes('TD-001'), 'DEBT.md should contain TD-001');
      assert.ok(content.includes('TD-002'), 'DEBT.md should contain TD-002');
    });

    test('sanitizes pipe characters in description to forward slashes', () => {
      const result = runGsdTools(
        'debt log --type code --severity low --component foo.cjs --description "Fix foo | bar parsing" --logged-by test --source-phase 16 --source-plan 16-01',
        tmpDir
      );
      assert.ok(result.success, `Command failed: ${result.error}`);
      const out = JSON.parse(result.output);
      assert.strictEqual(out.id, 'TD-001');

      const content = fs.readFileSync(path.join(tmpDir, '.planning', 'DEBT.md'), 'utf-8');
      // Pipe should be replaced by forward slash
      assert.ok(content.includes('Fix foo / bar parsing'), 'Pipe chars should be sanitized to /');
      // No raw pipe in description cell
      const lines = content.split('\n');
      const dataLine = lines.find(l => l.includes('TD-001'));
      assert.ok(dataLine, 'Should have TD-001 row');
      // Count pipes: a valid 10-column row has exactly 11 pipes (|col|col...|)
      const pipeCount = (dataLine.match(/\|/g) || []).length;
      assert.strictEqual(pipeCount, 11, `TD-001 row should have exactly 11 pipes (10 columns), got ${pipeCount}: ${dataLine}`);
    });

    test('debt log with minimal fields still creates valid entry', () => {
      const result = runGsdTools(
        'debt log',
        tmpDir
      );
      assert.ok(result.success, `Command failed: ${result.error}`);
      const out = JSON.parse(result.output);
      assert.strictEqual(out.id, 'TD-001');
      assert.strictEqual(out.logged, true);
    });
  });

  // ─── debt list ─────────────────────────────────────────────────────────────

  describe('debt list', () => {
    test('returns empty result when DEBT.md does not exist', () => {
      const result = runGsdTools('debt list', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const out = JSON.parse(result.output);
      assert.deepStrictEqual(out.entries, []);
      assert.strictEqual(out.total, 0);
    });

    test('returns all entries after two logs', () => {
      runGsdTools(
        'debt log --type code --severity high --component a.cjs --description "First" --logged-by test --source-phase 16 --source-plan 16-01',
        tmpDir
      );
      runGsdTools(
        'debt log --type test --severity medium --component b.cjs --description "Second" --logged-by test --source-phase 16 --source-plan 16-01',
        tmpDir
      );

      const result = runGsdTools('debt list', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const out = JSON.parse(result.output);
      assert.strictEqual(out.total, 2);
      assert.strictEqual(out.entries.length, 2);
      assert.strictEqual(out.entries[0].id, 'TD-001');
      assert.strictEqual(out.entries[1].id, 'TD-002');
    });

    test('filters by --status', () => {
      // Log two entries (both open by default)
      runGsdTools(
        'debt log --type code --severity high --component a.cjs --description "First" --logged-by test --source-phase 16 --source-plan 16-01',
        tmpDir
      );
      runGsdTools(
        'debt log --type test --severity medium --component b.cjs --description "Second" --logged-by test --source-phase 16 --source-plan 16-01',
        tmpDir
      );
      // Resolve first entry
      runGsdTools('debt resolve --id TD-001 --status resolved', tmpDir);

      // Filter by open
      const openResult = runGsdTools('debt list --status open', tmpDir);
      assert.ok(openResult.success, `Command failed: ${openResult.error}`);
      const openOut = JSON.parse(openResult.output);
      assert.strictEqual(openOut.total, 1);
      assert.strictEqual(openOut.entries[0].id, 'TD-002');

      // Filter by resolved
      const resolvedResult = runGsdTools('debt list --status resolved', tmpDir);
      assert.ok(resolvedResult.success, `Command failed: ${resolvedResult.error}`);
      const resolvedOut = JSON.parse(resolvedResult.output);
      assert.strictEqual(resolvedOut.total, 1);
      assert.strictEqual(resolvedOut.entries[0].id, 'TD-001');
    });

    test('filters by --severity', () => {
      runGsdTools(
        'debt log --type code --severity high --component a.cjs --description "High severity" --logged-by test --source-phase 16 --source-plan 16-01',
        tmpDir
      );
      runGsdTools(
        'debt log --type code --severity medium --component b.cjs --description "Medium severity" --logged-by test --source-phase 16 --source-plan 16-01',
        tmpDir
      );

      const result = runGsdTools('debt list --severity high', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const out = JSON.parse(result.output);
      assert.strictEqual(out.total, 1);
      assert.strictEqual(out.entries[0].severity, 'high');
    });

    test('filters by --type', () => {
      runGsdTools(
        'debt log --type code --severity high --component a.cjs --description "Code debt" --logged-by test --source-phase 16 --source-plan 16-01',
        tmpDir
      );
      runGsdTools(
        'debt log --type test --severity medium --component b.cjs --description "Test debt" --logged-by test --source-phase 16 --source-plan 16-01',
        tmpDir
      );

      const result = runGsdTools('debt list --type code', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const out = JSON.parse(result.output);
      assert.strictEqual(out.total, 1);
      assert.strictEqual(out.entries[0].type, 'code');
    });

    test('returned entries have all 10 expected fields', () => {
      runGsdTools(
        'debt log --type code --severity high --component mymodule.cjs --description "Check all fields" --logged-by agent --source-phase 16 --source-plan 16-01',
        tmpDir
      );

      const result = runGsdTools('debt list', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const out = JSON.parse(result.output);
      assert.strictEqual(out.total, 1);

      const entry = out.entries[0];
      assert.ok('id' in entry, 'entry should have id');
      assert.ok('type' in entry, 'entry should have type');
      assert.ok('severity' in entry, 'entry should have severity');
      assert.ok('component' in entry, 'entry should have component');
      assert.ok('description' in entry, 'entry should have description');
      assert.ok('date_logged' in entry, 'entry should have date_logged');
      assert.ok('logged_by' in entry, 'entry should have logged_by');
      assert.ok('status' in entry, 'entry should have status');
      assert.ok('source_phase' in entry, 'entry should have source_phase');
      assert.ok('source_plan' in entry, 'entry should have source_plan');

      assert.strictEqual(entry.id, 'TD-001');
      assert.strictEqual(entry.type, 'code');
      assert.strictEqual(entry.severity, 'high');
      assert.strictEqual(entry.component, 'mymodule.cjs');
      assert.strictEqual(entry.description, 'Check all fields');
      assert.strictEqual(entry.logged_by, 'agent');
      assert.strictEqual(entry.status, 'open');
      assert.strictEqual(entry.source_phase, '16');
      assert.strictEqual(entry.source_plan, '16-01');
    });
  });

  // ─── debt resolve ──────────────────────────────────────────────────────────

  describe('debt resolve', () => {
    test('transitions status for existing entry and returns updated: true', () => {
      runGsdTools(
        'debt log --type code --severity high --component a.cjs --description "Test resolve" --logged-by test --source-phase 16 --source-plan 16-01',
        tmpDir
      );

      const result = runGsdTools('debt resolve --id TD-001 --status resolved', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const out = JSON.parse(result.output);
      assert.strictEqual(out.id, 'TD-001');
      assert.strictEqual(out.status, 'resolved');
      assert.strictEqual(out.updated, true);

      // Verify in file
      const content = fs.readFileSync(path.join(tmpDir, '.planning', 'DEBT.md'), 'utf-8');
      const dataLine = content.split('\n').find(l => l.includes('TD-001'));
      assert.ok(dataLine && dataLine.includes('resolved'), 'DEBT.md should show resolved status');
    });

    test('returns updated: false for non-existent ID (no error exit)', () => {
      runGsdTools(
        'debt log --type code --severity high --component a.cjs --description "Some entry" --logged-by test --source-phase 16 --source-plan 16-01',
        tmpDir
      );

      const result = runGsdTools('debt resolve --id TD-999 --status resolved', tmpDir);
      assert.ok(result.success, `Should succeed (not error exit): ${result.error}`);
      const out = JSON.parse(result.output);
      assert.strictEqual(out.updated, false);
      assert.ok(out.reason, 'Should have reason field');
      assert.ok(out.reason.includes('TD-999'), 'Reason should mention the missing ID');
    });

    test('errors with exit 1 when --id is missing', () => {
      const result = runGsdToolsFull('debt resolve --status resolved', tmpDir);
      assert.strictEqual(result.success, false, 'Should exit with failure');
      assert.ok(result.stderr.includes('--id required'), `stderr should mention --id required, got: ${result.stderr}`);
    });

    test('errors with exit 1 when --status is missing', () => {
      const result = runGsdToolsFull('debt resolve --id TD-001', tmpDir);
      assert.strictEqual(result.success, false, 'Should exit with failure');
      assert.ok(result.stderr.includes('--status required'), `stderr should mention --status required, got: ${result.stderr}`);
    });

    test('errors with exit 1 for invalid status value', () => {
      runGsdTools(
        'debt log --type code --severity high --component a.cjs --description "Test" --logged-by test --source-phase 16 --source-plan 16-01',
        tmpDir
      );
      const result = runGsdToolsFull('debt resolve --id TD-001 --status invalid', tmpDir);
      assert.strictEqual(result.success, false, 'Should exit with failure');
      assert.ok(result.stderr.includes('Invalid status'), `stderr should mention invalid status, got: ${result.stderr}`);
    });

    test('errors with exit 1 when DEBT.md does not exist', () => {
      const result = runGsdToolsFull('debt resolve --id TD-001 --status resolved', tmpDir);
      assert.strictEqual(result.success, false, 'Should exit with failure');
      assert.ok(result.stderr.includes('DEBT.md not found'), `stderr should mention DEBT.md not found, got: ${result.stderr}`);
    });

    test('transitions to in-progress status', () => {
      runGsdTools(
        'debt log --type code --severity high --component a.cjs --description "Test" --logged-by test --source-phase 16 --source-plan 16-01',
        tmpDir
      );
      const result = runGsdTools('debt resolve --id TD-001 --status in-progress', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const out = JSON.parse(result.output);
      assert.strictEqual(out.status, 'in-progress');
      assert.strictEqual(out.updated, true);
    });

    test('transitions to deferred status', () => {
      runGsdTools(
        'debt log --type code --severity high --component a.cjs --description "Test" --logged-by test --source-phase 16 --source-plan 16-01',
        tmpDir
      );
      const result = runGsdTools('debt resolve --id TD-001 --status deferred', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const out = JSON.parse(result.output);
      assert.strictEqual(out.status, 'deferred');
      assert.strictEqual(out.updated, true);
    });
  });

  // ─── debt impact ──────────────────────────────────────────────────────────

  describe('debt impact', () => {
    test('debt impact outputs ranked entries with link_confidence', () => {
      // Create DEBT.md via debt log calls
      runGsdTools(
        'debt log --type code --severity high --component state.cjs --description "State parser issue" --logged-by test --source-phase 37 --source-plan 37-01',
        tmpDir
      );
      runGsdTools(
        'debt log --type test --severity medium --component debt.cjs --description "Debt test coverage" --logged-by test --source-phase 16 --source-plan 16-01',
        tmpDir
      );

      // Create .planning/patterns/corrections.jsonl with 3 entries all having phase: 37
      const patternsDir = path.join(tmpDir, '.planning', 'patterns');
      fs.mkdirSync(patternsDir, { recursive: true });
      const corrections = [
        { phase: 37, retired_at: null, diagnosis_category: 'logic', component: 'state.cjs' },
        { phase: 37, retired_at: null, diagnosis_category: 'logic', component: 'state.cjs' },
        { phase: 37, retired_at: null, diagnosis_category: 'test', component: 'state.cjs' },
      ];
      fs.writeFileSync(
        path.join(patternsDir, 'corrections.jsonl'),
        corrections.map(c => JSON.stringify(c)).join('\n') + '\n',
        'utf-8'
      );

      const result = runGsdTools('debt impact --raw', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const out = JSON.parse(result.output);

      const entries = Array.isArray(out) ? out : out.entries;
      assert.ok(Array.isArray(entries), 'result should have entries array');
      assert.ok(entries.length >= 2, 'should have at least 2 entries');

      // TD-001 has source_phase 37 — 3 corrections match → high
      const first = entries[0];
      assert.strictEqual(first.id, 'TD-001', 'first entry should be TD-001 (3 corrections)');
      assert.strictEqual(first.link_confidence, 'high', 'TD-001 should have high confidence');

      // TD-002 has source_phase 16 — no matching corrections → low
      const second = entries[1];
      assert.strictEqual(second.id, 'TD-002', 'second entry should be TD-002');
      assert.strictEqual(second.link_confidence, 'low', 'TD-002 should have low confidence');
    });

    test('debt impact link_confidence is medium for 1-2 corrections', () => {
      runGsdTools(
        'debt log --type code --severity high --component state.cjs --description "State parser issue" --logged-by test --source-phase 37 --source-plan 37-01',
        tmpDir
      );

      const patternsDir = path.join(tmpDir, '.planning', 'patterns');
      fs.mkdirSync(patternsDir, { recursive: true });
      const corrections = [
        { phase: 37, retired_at: null, diagnosis_category: 'logic', component: null },
        { phase: 37, retired_at: null, diagnosis_category: 'test', component: null },
      ];
      fs.writeFileSync(
        path.join(patternsDir, 'corrections.jsonl'),
        corrections.map(c => JSON.stringify(c)).join('\n') + '\n',
        'utf-8'
      );

      const result = runGsdTools('debt impact --raw', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const out = JSON.parse(result.output);
      const entries = Array.isArray(out) ? out : out.entries;
      assert.strictEqual(entries[0].link_confidence, 'medium', 'should be medium for 2 corrections');
    });

    test('debt impact entries sorted by correction_count descending', () => {
      // TD-001: source_phase 37 (1 match), TD-002: source_phase 16 (3 matches)
      runGsdTools(
        'debt log --type code --severity high --component state.cjs --description "State issue" --logged-by test --source-phase 37 --source-plan 37-01',
        tmpDir
      );
      runGsdTools(
        'debt log --type test --severity medium --component debt.cjs --description "Debt coverage" --logged-by test --source-phase 16 --source-plan 16-01',
        tmpDir
      );

      const patternsDir = path.join(tmpDir, '.planning', 'patterns');
      fs.mkdirSync(patternsDir, { recursive: true });
      const corrections = [
        { phase: 37, retired_at: null, diagnosis_category: 'logic', component: null },
        { phase: 16, retired_at: null, diagnosis_category: 'logic', component: null },
        { phase: 16, retired_at: null, diagnosis_category: 'test', component: null },
        { phase: 16, retired_at: null, diagnosis_category: 'arch', component: null },
      ];
      fs.writeFileSync(
        path.join(patternsDir, 'corrections.jsonl'),
        corrections.map(c => JSON.stringify(c)).join('\n') + '\n',
        'utf-8'
      );

      const result = runGsdTools('debt impact --raw', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);
      const out = JSON.parse(result.output);
      const entries = Array.isArray(out) ? out : out.entries;

      // TD-002 has 3 corrections (phase 16), TD-001 has 1 correction (phase 37)
      assert.strictEqual(entries[0].id, 'TD-002', 'TD-002 should be first (3 corrections)');
      assert.strictEqual(entries[1].id, 'TD-001', 'TD-001 should be second (1 correction)');
    });

    test('debt impact returns empty array when DEBT.md missing', () => {
      const result = runGsdTools('debt impact --raw', tmpDir);
      assert.ok(result.success, `Command should exit 0, got: ${result.error}`);
      const out = JSON.parse(result.output);
      // Accept either [] or { entries: [], total: 0 }
      if (Array.isArray(out)) {
        assert.strictEqual(out.length, 0, 'should be empty array');
      } else {
        assert.deepStrictEqual(out.entries, [], 'entries should be empty');
        assert.strictEqual(out.total, 0, 'total should be 0');
      }
    });

    test('debt impact is read-only (does not modify DEBT.md)', () => {
      runGsdTools(
        'debt log --type code --severity high --component state.cjs --description "State issue" --logged-by test --source-phase 37 --source-plan 37-01',
        tmpDir
      );

      const debtPath = path.join(tmpDir, '.planning', 'DEBT.md');
      const contentBefore = fs.readFileSync(debtPath, 'utf-8');

      runGsdTools('debt impact --raw', tmpDir);

      const contentAfter = fs.readFileSync(debtPath, 'utf-8');
      assert.strictEqual(contentAfter, contentBefore, 'DEBT.md should not be modified by debt impact');
    });
  });

  // ─── getNextDebtId edge cases ───────────────────────────────────────────────

  describe('getNextDebtId edge cases', () => {
    test('separator row (|---|---) does not match TD-NNN pattern — ID stays at TD-001', () => {
      // Create a DEBT.md with only header (no data rows), which has a separator line
      const debtPath = path.join(tmpDir, '.planning', 'DEBT.md');
      const headerContent = [
        '# DEBT.md — Tech Debt Register',
        '',
        'Project-level tracker for structured tech debt. Entries logged by `gsd-tools debt log`.',
        '',
        '| id | type | severity | component | description | date_logged | logged_by | status | source_phase | source_plan |',
        '|----|------|----------|-----------|-------------|-------------|-----------|--------|--------------|-------------|',
        '',
      ].join('\n');
      fs.writeFileSync(debtPath, headerContent, 'utf-8');

      const result = runGsdTools(
        'debt log --type code --severity low --component test --description "After separator only"',
        tmpDir
      );
      assert.ok(result.success, `Command failed: ${result.error}`);
      const out = JSON.parse(result.output);
      assert.strictEqual(out.id, 'TD-001', 'First entry after separator-only file should be TD-001');
    });
  });
});
