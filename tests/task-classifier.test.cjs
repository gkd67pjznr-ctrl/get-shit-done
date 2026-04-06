'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createTempProject, cleanup } = require('./helpers.cjs');

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
  const { buildTypePerformanceTable, getBestExampleByType } = require('../get-shit-done/bin/lib/task-classifier.cjs');

  // ── TASK-01: type recognition via index consumption ────────────────────────

  test('recognizes lib-module from fixture data', () => {
    assert.ok(false, 'TODO');
  });

  test('recognizes test-setup from fixture data', () => {
    assert.ok(false, 'TODO');
  });

  test('recognizes cli-wiring from fixture data', () => {
    assert.ok(false, 'TODO');
  });

  test('omits superseded entries for type aggregation', () => {
    assert.ok(false, 'TODO');
  });

  // ── TASK-02: performance table ─────────────────────────────────────────────

  test('buildTypePerformanceTable returns types sorted by ascending median correction rate', () => {
    assert.ok(false, 'TODO');
  });

  test('buildTypePerformanceTable excludes superseded_by entries', () => {
    assert.ok(false, 'TODO');
  });

  test('buildTypePerformanceTable returns empty array when index missing', () => {
    assert.ok(false, 'TODO');
  });

  // ── TASK-03: best example ──────────────────────────────────────────────────

  test('getBestExampleByType returns lowest-correction-rate entry for each type', () => {
    assert.ok(false, 'TODO');
  });

  test('getBestExampleByType omits types with no historical entries', () => {
    assert.ok(false, 'TODO');
  });
});
