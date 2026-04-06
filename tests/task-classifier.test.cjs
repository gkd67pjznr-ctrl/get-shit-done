'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createTempProject, cleanup } = require('./helpers.cjs');
const { buildTypePerformanceTable, getBestExampleByType } = require('../get-shit-done/bin/lib/task-classifier.cjs');

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function createFixturePlans() {
  return [
    {
      plan_id: '90-01',
      phase_slug: '90-plan-indexer',
      milestone: 'v14.0',
      task_pattern: ['lib-module', 'test-setup'],
      correction_count: 0,
      correction_rate: 0,
      age_weight: 1.0,
      superseded_by: null,
      files_modified: ['get-shit-done/bin/lib/plan-indexer.cjs'],
    },
    {
      plan_id: '88-01',
      phase_slug: '88-old',
      milestone: 'v13.0',
      task_pattern: ['lib-module'],
      correction_count: 4,
      correction_rate: 4,
      age_weight: 0.6,
      superseded_by: null,
      files_modified: ['src/old.ts'],
    },
    {
      plan_id: '85-01',
      phase_slug: '85-superseded',
      milestone: 'v12.0',
      task_pattern: ['cli-wiring'],
      correction_count: 0,
      correction_rate: 0,
      age_weight: 0.3,
      superseded_by: 'v14.0',
      files_modified: [],
    },
  ];
}

function writeTempIndex(tmpDir, plans) {
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  fs.writeFileSync(
    path.join(planningDir, 'plan-index.json'),
    JSON.stringify({ built_at: new Date().toISOString(), plan_count: plans.length, idf: {}, plans })
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('task-classifier', () => {

  // ── TASK-01: type recognition via index consumption ────────────────────────

  test('recognizes lib-module from fixture data', () => {
    const tmpDir = createTempProject();
    try {
      writeTempIndex(tmpDir, [
        {
          plan_id: '01-01', phase_slug: 'test', milestone: 'v1.0',
          task_pattern: ['lib-module'], correction_count: 0, correction_rate: 0,
          age_weight: 1.0, superseded_by: null, files_modified: [],
        },
      ]);
      const table = buildTypePerformanceTable(tmpDir);
      const types = table.map(e => e.type);
      assert.ok(types.includes('lib-module'), `expected lib-module in [${types.join(', ')}]`);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('recognizes test-setup from fixture data', () => {
    const tmpDir = createTempProject();
    try {
      writeTempIndex(tmpDir, [
        {
          plan_id: '01-01', phase_slug: 'test', milestone: 'v1.0',
          task_pattern: ['test-setup'], correction_count: 0, correction_rate: 0,
          age_weight: 1.0, superseded_by: null, files_modified: [],
        },
      ]);
      const table = buildTypePerformanceTable(tmpDir);
      const types = table.map(e => e.type);
      assert.ok(types.includes('test-setup'), `expected test-setup in [${types.join(', ')}]`);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('recognizes cli-wiring from fixture data', () => {
    const tmpDir = createTempProject();
    try {
      // cli-wiring entry is NOT superseded here
      writeTempIndex(tmpDir, [
        {
          plan_id: '01-01', phase_slug: 'test', milestone: 'v1.0',
          task_pattern: ['cli-wiring'], correction_count: 0, correction_rate: 0,
          age_weight: 1.0, superseded_by: null, files_modified: [],
        },
      ]);
      const table = buildTypePerformanceTable(tmpDir);
      const types = table.map(e => e.type);
      assert.ok(types.includes('cli-wiring'), `expected cli-wiring in [${types.join(', ')}]`);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('omits superseded entries for type aggregation', () => {
    const tmpDir = createTempProject();
    try {
      // cli-wiring entry IS superseded — should not appear in table
      writeTempIndex(tmpDir, [
        {
          plan_id: '01-01', phase_slug: 'test', milestone: 'v1.0',
          task_pattern: ['cli-wiring'], correction_count: 0, correction_rate: 0,
          age_weight: 1.0, superseded_by: 'v99', files_modified: [],
        },
      ]);
      const table = buildTypePerformanceTable(tmpDir);
      const types = table.map(e => e.type);
      assert.ok(!types.includes('cli-wiring'), `cli-wiring should be excluded but found in [${types.join(', ')}]`);
    } finally {
      cleanup(tmpDir);
    }
  });

  // ── TASK-02: performance table ─────────────────────────────────────────────

  test('buildTypePerformanceTable returns types sorted by ascending median correction rate', () => {
    const tmpDir = createTempProject();
    try {
      writeTempIndex(tmpDir, createFixturePlans());
      const table = buildTypePerformanceTable(tmpDir);

      // test-setup only has one entry: correction_rate=0 → median=0
      // lib-module has two entries: rates 0 and 4 → median=2
      // cli-wiring is superseded → excluded
      const testSetupEntry = table.find(e => e.type === 'test-setup');
      const libModuleEntry = table.find(e => e.type === 'lib-module');

      assert.ok(testSetupEntry, 'expected test-setup in table');
      assert.ok(libModuleEntry, 'expected lib-module in table');

      // test-setup median=0, lib-module median=2; test-setup should come first
      const testSetupIdx = table.findIndex(e => e.type === 'test-setup');
      const libModuleIdx = table.findIndex(e => e.type === 'lib-module');
      assert.ok(testSetupIdx < libModuleIdx, 'test-setup (median=0) should appear before lib-module (median=2)');

      // Verify exact median values
      assert.equal(testSetupEntry.median_correction_rate, 0);
      assert.ok(libModuleEntry.median_correction_rate > 0 && libModuleEntry.median_correction_rate <= 4,
        `lib-module median should be between 0 and 4, got ${libModuleEntry.median_correction_rate}`);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('buildTypePerformanceTable excludes superseded_by entries', () => {
    const tmpDir = createTempProject();
    try {
      // One lib-module entry superseded, one not; only non-superseded should contribute
      writeTempIndex(tmpDir, [
        {
          plan_id: '10-01', phase_slug: 'a', milestone: 'v10.0',
          task_pattern: ['lib-module'], correction_count: 8, correction_rate: 8,
          age_weight: 0.5, superseded_by: 'v15', files_modified: [],
        },
        {
          plan_id: '11-01', phase_slug: 'b', milestone: 'v11.0',
          task_pattern: ['lib-module'], correction_count: 2, correction_rate: 2,
          age_weight: 0.8, superseded_by: null, files_modified: [],
        },
      ]);
      const table = buildTypePerformanceTable(tmpDir);
      const libEntry = table.find(e => e.type === 'lib-module');
      assert.ok(libEntry, 'expected lib-module in table');
      // Only the non-superseded entry (rate=2) contributes — median of [2] = 2
      assert.equal(libEntry.median_correction_rate, 2,
        `expected median=2 (only non-superseded entry), got ${libEntry.median_correction_rate}`);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('buildTypePerformanceTable returns empty array when index missing', () => {
    const tmpDir = createTempProject();
    try {
      // No plan-index.json written — directory only has milestone workspace
      const table = buildTypePerformanceTable(tmpDir);
      assert.deepEqual(table, []);
    } finally {
      cleanup(tmpDir);
    }
  });

  // ── TASK-03: best example ──────────────────────────────────────────────────

  test('getBestExampleByType returns lowest-correction-rate entry for each type', () => {
    const tmpDir = createTempProject();
    try {
      writeTempIndex(tmpDir, createFixturePlans());
      // lib-module has plan_id='90-01' (rate=0) and plan_id='88-01' (rate=4)
      // best should be '90-01'
      const result = getBestExampleByType(tmpDir, ['lib-module']);
      assert.ok(result['lib-module'], 'expected lib-module key in result');
      assert.equal(result['lib-module'].plan_id, '90-01',
        `expected plan_id='90-01' (lowest rate), got '${result['lib-module'].plan_id}'`);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('getBestExampleByType omits types with no historical entries', () => {
    const tmpDir = createTempProject();
    try {
      writeTempIndex(tmpDir, createFixturePlans());
      // 'schema' type has no entries in fixture
      const result = getBestExampleByType(tmpDir, ['lib-module', 'schema']);
      assert.ok('lib-module' in result, 'expected lib-module key in result');
      assert.ok(!('schema' in result), 'schema should be omitted (no entries)');
    } finally {
      cleanup(tmpDir);
    }
  });
});
