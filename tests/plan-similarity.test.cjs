'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function createFixtureIndex() {
  return {
    built_at: new Date().toISOString(),
    plan_count: 2,
    idf: { implement: 0.5, lib: 0.3, module: 0.2 },
    plans: [
      {
        plan_id: '90-01', phase_slug: '90-plan-indexer', milestone: 'v14.0',
        tfidf_vector: { implement: 0.5, lib: 0.3 }, tokens: ['implement', 'lib', 'module'],
        tags: ['indexer'], task_pattern: ['lib-module'], file_patterns: ['get-shit-done/bin/lib/*.cjs'],
        files_modified: ['get-shit-done/bin/lib/plan-indexer.cjs'],
        correction_count: 0, correction_rate: 0, age_weight: 1.0, superseded_by: null,
      },
      {
        plan_id: '88-01', phase_slug: '88-old-feature', milestone: 'v13.0',
        tfidf_vector: { refactor: 0.8 }, tokens: ['refactor', 'cleanup'],
        tags: [], task_pattern: ['refactor'], file_patterns: ['src/*.ts'],
        files_modified: ['src/old.ts'],
        correction_count: 3, correction_rate: 3, age_weight: 0.4, superseded_by: null,
      },
    ],
  };
}

function writeTempIndex(tmpDir, indexData) {
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  fs.writeFileSync(path.join(planningDir, 'plan-index.json'), JSON.stringify(indexData));
}

function createTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-sim-test-'));
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// ─── plan-similarity ──────────────────────────────────────────────────────────

describe('plan-similarity', () => {
  // SIM-01: hybrid formula weights
  test('scoreQuery returns composite between 0 and 1 for any non-empty goal', () => {
    assert.ok(false, 'TODO');
  });

  test('hybrid formula applies weights 0.70 tfidf, 0.20 jaccard, 0.10 tag_overlap', () => {
    assert.ok(false, 'TODO');
  });

  // SIM-02: threshold gating (integration with full searchSimilarPlans)
  test('searchSimilarPlans returns empty array when index file does not exist', () => {
    assert.ok(false, 'TODO');
  });

  test('searchSimilarPlans returns empty array when no plans exceed threshold', () => {
    assert.ok(false, 'TODO');
  });

  // SIM-03: plan_suggestions is metadata not rendered markdown (tested via init integration in 91-03)

  // SIM-04: skeleton adapter
  test('adaptSkeleton substitutes phase-plan prefix in files_modified paths', () => {
    assert.ok(false, 'TODO');
  });

  test('adaptSkeleton sets adapted_requirements to provided req IDs', () => {
    assert.ok(false, 'TODO');
  });

  // SIM-05: superseded and age_weight
  test('entries with superseded_by non-null are excluded from results', () => {
    assert.ok(false, 'TODO');
  });

  test('age_weight multiplier is applied to lower scores for older plans', () => {
    assert.ok(false, 'TODO');
  });
});
