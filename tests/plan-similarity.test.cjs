'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { searchSimilarPlans, adaptSkeleton, cosineSimilarity, jaccardTokens } = require('../get-shit-done/bin/lib/plan-similarity.cjs');

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
  // ─── SIM-01: hybrid formula weights ──────────────────────────────────────────

  test('scoreQuery returns composite between 0 and 1 for any non-empty goal', () => {
    const tmpDir = createTempProject();
    try {
      writeTempIndex(tmpDir, createFixtureIndex());
      const results = searchSimilarPlans(tmpDir, { goal: 'implement lib module', limit: 10, threshold: 0.0 });
      for (const entry of results) {
        assert.ok(entry.composite_score >= 0, `composite_score should be >= 0, got ${entry.composite_score}`);
        assert.ok(entry.composite_score <= 1, `composite_score should be <= 1, got ${entry.composite_score}`);
      }
    } finally {
      cleanup(tmpDir);
    }
  });

  test('hybrid formula applies weights 0.70 tfidf, 0.20 jaccard, 0.10 tag_overlap', () => {
    // Test cosineSimilarity: identical vectors => 1.0
    const sim1 = cosineSimilarity({ a: 1 }, { a: 1 });
    assert.strictEqual(sim1, 1.0, 'identical vectors should have cosine similarity 1.0');

    // Test cosineSimilarity: no shared keys => 0
    const sim2 = cosineSimilarity({ a: 1 }, { b: 1 });
    assert.strictEqual(sim2, 0, 'orthogonal vectors should have cosine similarity 0');

    // Test jaccardTokens: {a,b} vs {a,c} => 1/3
    const jac = jaccardTokens(new Set(['a', 'b']), new Set(['a', 'c']));
    assert.ok(Math.abs(jac - 1 / 3) < 1e-10, `jaccard of {a,b} vs {a,c} should be 1/3, got ${jac}`);

    // Verify composite for controlled fixture:
    // tfidf_cosine({implement:0.5, lib:0.3}, {implement:0.5, lib:0.3}) = 1.0
    // jaccard(['implement','lib','module'], ['implement','lib','module']) = 1.0
    // tag_overlap: tokens vs tags['indexer'] — 'indexer' not in ['implement','lib','module'] => 0
    // raw = 0.70 * 1.0 + 0.20 * 1.0 + 0.10 * 0 = 0.90
    // final = 0.90 * 1.0 (age_weight) = 0.90
    const tmpDir = createTempProject();
    try {
      const fixture = {
        built_at: new Date().toISOString(),
        plan_count: 1,
        idf: { implement: 0.5, lib: 0.3, module: 0.2 },
        plans: [{
          plan_id: '90-01', phase_slug: 'test', milestone: 'v14.0',
          tfidf_vector: { implement: 0.5, lib: 0.3 }, tokens: ['implement', 'lib', 'module'],
          tags: ['indexer'], task_pattern: ['lib-module'], file_patterns: [],
          files_modified: [], correction_count: 0, correction_rate: 0,
          age_weight: 1.0, superseded_by: null,
        }],
      };
      writeTempIndex(tmpDir, fixture);
      const results = searchSimilarPlans(tmpDir, { goal: 'implement lib module', threshold: 0.0 });
      // The first (only) result should have composite near 0.90
      assert.ok(results.length === 1, 'should return 1 result');
      const score = results[0].composite_score;
      assert.ok(score > 0.85 && score <= 1.0, `composite should be near 0.90, got ${score}`);
    } finally {
      cleanup(tmpDir);
    }
  });

  // ─── SIM-02: threshold gating ─────────────────────────────────────────────────

  test('searchSimilarPlans returns empty array when index file does not exist', () => {
    const tmpDir = createTempProject();
    try {
      // No plan-index.json written — just an empty .planning dir
      fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
      const result = searchSimilarPlans(tmpDir, { goal: 'implement lib module', limit: 3, threshold: 0.65 });
      assert.deepStrictEqual(result, [], 'should return [] when plan-index.json does not exist');
    } finally {
      cleanup(tmpDir);
    }
  });

  test('searchSimilarPlans returns empty array when no plans exceed threshold', () => {
    const tmpDir = createTempProject();
    try {
      // Fixture with tokens completely unrelated to the query
      const fixture = {
        built_at: new Date().toISOString(),
        plan_count: 1,
        idf: { zymurgy: 0.9 },
        plans: [{
          plan_id: '10-01', phase_slug: 'brewing', milestone: 'v1.0',
          tfidf_vector: { zymurgy: 0.9 }, tokens: ['zymurgy'],
          tags: [], task_pattern: ['docs'], file_patterns: [],
          files_modified: [], correction_count: 0, correction_rate: 0,
          age_weight: 1.0, superseded_by: null,
        }],
      };
      writeTempIndex(tmpDir, fixture);
      const result = searchSimilarPlans(tmpDir, { goal: 'implement lib module', limit: 3, threshold: 0.65 });
      assert.deepStrictEqual(result, [], 'should return [] when no plans meet threshold');
    } finally {
      cleanup(tmpDir);
    }
  });

  // ─── SIM-04: skeleton adapter ─────────────────────────────────────────────────

  test('adaptSkeleton substitutes phase-plan prefix in files_modified paths', () => {
    const entry = {
      plan_id: '90-01',
      files_modified: [
        'get-shit-done/bin/lib/90-01-notes.cjs',
        '.planning/phases/90-01-PLAN.md',
      ],
    };
    const result = adaptSkeleton(entry, '91', ['SIM-01']);
    assert.ok(result.adapted_files[0].includes('91'), `adapted_files[0] should contain '91', got: ${result.adapted_files[0]}`);
    assert.ok(!result.adapted_files[0].includes('90-01'), `adapted_files[0] should not contain '90-01', got: ${result.adapted_files[0]}`);
    assert.ok(result.adapted_files[1].includes('91'), `adapted_files[1] should contain '91', got: ${result.adapted_files[1]}`);
    assert.ok(!result.adapted_files[1].includes('90-01'), `adapted_files[1] should not contain '90-01', got: ${result.adapted_files[1]}`);
  });

  test('adaptSkeleton sets adapted_requirements to provided req IDs', () => {
    const entry = { plan_id: '90-01', files_modified: [] };
    const result = adaptSkeleton(entry, '91', ['SIM-01', 'SIM-02']);
    assert.deepStrictEqual(result.adapted_requirements, ['SIM-01', 'SIM-02']);
    assert.strictEqual(result.adapted_for, '91');
    assert.strictEqual(result.source_plan, '90-01');
  });

  // ─── SIM-05: superseded and age_weight ────────────────────────────────────────

  test('entries with superseded_by non-null are excluded from results', () => {
    const tmpDir = createTempProject();
    try {
      const fixture = {
        built_at: new Date().toISOString(),
        plan_count: 2,
        idf: { implement: 0.5, lib: 0.3 },
        plans: [
          {
            plan_id: '90-01', phase_slug: 'active', milestone: 'v14.0',
            tfidf_vector: { implement: 0.5, lib: 0.3 }, tokens: ['implement', 'lib'],
            tags: [], task_pattern: ['lib-module'], file_patterns: [],
            files_modified: [], correction_count: 0, correction_rate: 0,
            age_weight: 1.0, superseded_by: null,
          },
          {
            plan_id: '89-01', phase_slug: 'superseded', milestone: 'v13.0',
            tfidf_vector: { implement: 0.5, lib: 0.3 }, tokens: ['implement', 'lib'],
            tags: [], task_pattern: ['lib-module'], file_patterns: [],
            files_modified: [], correction_count: 0, correction_rate: 0,
            age_weight: 1.0, superseded_by: 'v15.0',
          },
        ],
      };
      writeTempIndex(tmpDir, fixture);
      const results = searchSimilarPlans(tmpDir, { goal: 'implement lib module', threshold: 0.0 });
      const ids = results.map(r => r.plan_id);
      assert.ok(!ids.includes('89-01'), 'superseded entry should be excluded from results');
    } finally {
      cleanup(tmpDir);
    }
  });

  test('age_weight multiplier is applied to lower scores for older plans', () => {
    const tmpDir = createTempProject();
    try {
      const fixture = {
        built_at: new Date().toISOString(),
        plan_count: 2,
        idf: { implement: 0.5, lib: 0.3 },
        plans: [
          {
            plan_id: '90-01', phase_slug: 'fresh', milestone: 'v14.0',
            tfidf_vector: { implement: 0.5, lib: 0.3 }, tokens: ['implement', 'lib'],
            tags: [], task_pattern: ['lib-module'], file_patterns: [],
            files_modified: [], correction_count: 0, correction_rate: 0,
            age_weight: 1.0, superseded_by: null,
          },
          {
            plan_id: '80-01', phase_slug: 'old', milestone: 'v12.0',
            tfidf_vector: { implement: 0.5, lib: 0.3 }, tokens: ['implement', 'lib'],
            tags: [], task_pattern: ['lib-module'], file_patterns: [],
            files_modified: [], correction_count: 0, correction_rate: 0,
            age_weight: 0.5, superseded_by: null,
          },
        ],
      };
      writeTempIndex(tmpDir, fixture);
      const results = searchSimilarPlans(tmpDir, { goal: 'implement lib module', threshold: 0.0 });
      const fresh = results.find(r => r.plan_id === '90-01');
      const old = results.find(r => r.plan_id === '80-01');
      assert.ok(fresh, 'fresh entry should be in results');
      assert.ok(old, 'old entry should be in results');
      assert.ok(
        fresh.composite_score > old.composite_score,
        `fresh entry (age_weight 1.0) score ${fresh.composite_score} should exceed old entry (age_weight 0.5) score ${old.composite_score}`
      );
    } finally {
      cleanup(tmpDir);
    }
  });
});
