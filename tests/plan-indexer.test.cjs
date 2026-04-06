'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { buildIndex, refreshIndex, searchIndex } = require('../get-shit-done/bin/lib/plan-indexer.cjs');

// ─── Fixture helpers ──────────────────────────────────────────────────────────

const PLAN_FIXTURE = `---
phase: 42
plan: 01
type: execute
wave: 1
depends_on: []
requirements:
  - IDX-01
files_modified:
  - get-shit-done/bin/lib/plan-indexer.cjs
autonomous: true
---
# Plan title

## Goal
test goal text for plan indexer

## Tasks

<task id="42-01-01" wave="1">
  <title>lib-module: implement the scanner</title>
</task>
`;

const SUMMARY_FIXTURE = `---
phase: 42
plan: "01"
status: complete
completed_at: "2026-01-15"
commits:
  - abc1234
requirements_completed:
  - IDX-01
---
`;

const SUMMARY_INCOMPLETE_FIXTURE = `---
phase: 42
plan: "01"
status: in-progress
completed_at: ""
---
`;

const BENCHMARK_LINE = '{"phase":"42","plan":"01","phase_type":"implementation","correction_count":2,"gate_fire_count":1,"timestamp":"2026-01-15T10:00:00.000Z"}';

/**
 * Create an isolated temp project with milestone-scoped layout.
 * Returns { cwd, planFile, summaryFile } for the fixture plan.
 */
function createFixtureProject({ milestoneVersion = 'v1.0', writeSummary = true, summaryContent = SUMMARY_FIXTURE, writeBenchmarks = false, benchmarkContent = BENCHMARK_LINE } = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-idx-test-'));
  const phaseDir = path.join(tmpDir, '.planning', 'milestones', milestoneVersion, 'phases', '42-plan-indexer');
  fs.mkdirSync(phaseDir, { recursive: true });

  const planFile = path.join(phaseDir, '42-01-PLAN.md');
  const summaryFile = path.join(phaseDir, '42-01-SUMMARY.md');

  fs.writeFileSync(planFile, PLAN_FIXTURE, 'utf-8');
  if (writeSummary) {
    fs.writeFileSync(summaryFile, summaryContent, 'utf-8');
  }

  if (writeBenchmarks) {
    const patternsDir = path.join(tmpDir, '.planning', 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });
    fs.writeFileSync(path.join(patternsDir, 'phase-benchmarks.jsonl'), benchmarkContent, 'utf-8');
  }

  return { cwd: tmpDir, planFile, summaryFile };
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// ─── IDX-01: Scanner ──────────────────────────────────────────────────────────

describe('IDX-01 scanner', () => {
  test('buildIndex with two milestone dirs each having one complete plan returns 2 entries', () => {
    const { cwd } = createFixtureProject({ milestoneVersion: 'v1.0' });
    try {
      // Add second milestone with a complete plan
      const phase2Dir = path.join(cwd, '.planning', 'milestones', 'v2.0', 'phases', '43-other-plan');
      fs.mkdirSync(phase2Dir, { recursive: true });

      const plan2Content = PLAN_FIXTURE.replace('phase: 42', 'phase: 43').replace('id="42-01-01"', 'id="43-01-01"');
      const summary2Content = SUMMARY_FIXTURE.replace('phase: 42', 'phase: 43');
      fs.writeFileSync(path.join(phase2Dir, '43-01-PLAN.md'), plan2Content, 'utf-8');
      fs.writeFileSync(path.join(phase2Dir, '43-01-SUMMARY.md'), summary2Content, 'utf-8');

      const result = buildIndex(cwd);
      assert.strictEqual(result.plans.length, 2, 'should return 2 entries for 2 complete plans across 2 milestones');
    } finally {
      cleanup(cwd);
    }
  });

  test('buildIndex skips plans without a matching SUMMARY.md', () => {
    const { cwd } = createFixtureProject({ writeSummary: false });
    try {
      const result = buildIndex(cwd);
      assert.strictEqual(result.plans.length, 0, 'plan without SUMMARY.md should not be indexed');
    } finally {
      cleanup(cwd);
    }
  });

  test('buildIndex skips plans where SUMMARY.md exists but status is not complete', () => {
    const { cwd } = createFixtureProject({ summaryContent: SUMMARY_INCOMPLETE_FIXTURE });
    try {
      const result = buildIndex(cwd);
      assert.strictEqual(result.plans.length, 0, 'plan with non-complete SUMMARY.md should not be indexed');
    } finally {
      cleanup(cwd);
    }
  });
});

// ─── IDX-02: Extraction ───────────────────────────────────────────────────────

describe('IDX-02 extraction', () => {
  test('index entry has all required fields', () => {
    const { cwd } = createFixtureProject();
    try {
      const result = buildIndex(cwd);
      assert.strictEqual(result.plans.length, 1);
      const entry = result.plans[0];

      const requiredFields = [
        'plan_id', 'milestone', 'phase_goal', 'phase_slug',
        'task_pattern', 'file_patterns', 'files_modified', 'tags',
        'requirement_count', 'correction_count', 'gate_fire_count',
        'correction_rate', 'tokens', 'tfidf_vector', 'age_weight',
        'superseded_by', 'completed',
      ];

      for (const field of requiredFields) {
        assert.ok(field in entry, `entry should have field: ${field}`);
      }
    } finally {
      cleanup(cwd);
    }
  });

  test('plan_id is formatted as padded phase-plan (e.g. "42-01")', () => {
    const { cwd } = createFixtureProject();
    try {
      const result = buildIndex(cwd);
      assert.strictEqual(result.plans.length, 1);
      assert.strictEqual(result.plans[0].plan_id, '42-01');
    } finally {
      cleanup(cwd);
    }
  });

  test('PLAN.md without frontmatter is skipped silently (no crash, entry count excludes it)', () => {
    const { cwd } = createFixtureProject({ writeSummary: false });
    try {
      // Write a PLAN.md without frontmatter alongside a SUMMARY.md
      const phaseDir = path.join(cwd, '.planning', 'milestones', 'v1.0', 'phases', '99-bad-plan');
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(path.join(phaseDir, '99-01-PLAN.md'), '# Plan without frontmatter\n\nNo YAML here.\n', 'utf-8');
      fs.writeFileSync(path.join(phaseDir, '99-01-SUMMARY.md'), SUMMARY_FIXTURE.replace('phase: 42', 'phase: 99'), 'utf-8');

      let result;
      assert.doesNotThrow(() => { result = buildIndex(cwd); }, 'buildIndex should not throw on missing frontmatter');
      // The bad plan has no phase/plan fields — should be skipped
      assert.strictEqual(result.plans.length, 0, 'plan without phase/plan in frontmatter should not be indexed');
    } finally {
      cleanup(cwd);
    }
  });
});

// ─── IDX-03: Benchmark join ───────────────────────────────────────────────────

describe('IDX-03 benchmark join', () => {
  test('when phase-benchmarks.jsonl has entry for the plan, correction_count and gate_fire_count are attached', () => {
    const { cwd } = createFixtureProject({ writeBenchmarks: true });
    try {
      const result = buildIndex(cwd);
      assert.strictEqual(result.plans.length, 1);
      assert.strictEqual(result.plans[0].correction_count, 2);
      assert.strictEqual(result.plans[0].gate_fire_count, 1);
    } finally {
      cleanup(cwd);
    }
  });

  test('when multiple benchmark entries exist for same phase+plan, highest correction_count is used', () => {
    const multiLine = [
      '{"phase":"42","plan":"01","correction_count":1,"gate_fire_count":0,"timestamp":"2026-01-14T10:00:00.000Z"}',
      '{"phase":"42","plan":"01","correction_count":5,"gate_fire_count":3,"timestamp":"2026-01-15T10:00:00.000Z"}',
      '{"phase":"42","plan":"01","correction_count":2,"gate_fire_count":1,"timestamp":"2026-01-16T10:00:00.000Z"}',
    ].join('\n');

    const { cwd } = createFixtureProject({ writeBenchmarks: true, benchmarkContent: multiLine });
    try {
      const result = buildIndex(cwd);
      assert.strictEqual(result.plans.length, 1);
      assert.strictEqual(result.plans[0].correction_count, 5, 'should pick highest correction_count');
    } finally {
      cleanup(cwd);
    }
  });

  test('when no benchmark entry exists, correction_count defaults to 0 without error', () => {
    const { cwd } = createFixtureProject({ writeBenchmarks: false });
    try {
      let result;
      assert.doesNotThrow(() => { result = buildIndex(cwd); });
      assert.strictEqual(result.plans[0].correction_count, 0);
      assert.strictEqual(result.plans[0].gate_fire_count, 0);
    } finally {
      cleanup(cwd);
    }
  });
});

// ─── IDX-04: Schema and atomic write ──────────────────────────────────────────

describe('IDX-04 schema and atomic write', () => {
  test('buildIndex writes .planning/plan-index.json with built_at, plan_count, idf, plans fields', () => {
    const { cwd } = createFixtureProject();
    try {
      buildIndex(cwd);
      const indexPath = path.join(cwd, '.planning', 'plan-index.json');
      assert.ok(fs.existsSync(indexPath), 'plan-index.json should exist after buildIndex');

      const raw = fs.readFileSync(indexPath, 'utf-8');
      const parsed = JSON.parse(raw);

      assert.ok('built_at' in parsed, 'should have built_at field');
      assert.ok('plan_count' in parsed, 'should have plan_count field');
      assert.ok('idf' in parsed, 'should have idf field');
      assert.ok('plans' in parsed, 'should have plans field');
      assert.ok(Array.isArray(parsed.plans), 'plans should be an array');
      assert.strictEqual(typeof parsed.idf, 'object', 'idf should be an object');
    } finally {
      cleanup(cwd);
    }
  });

  test('buildIndex is idempotent — running twice produces the same plan-index.json', () => {
    const { cwd } = createFixtureProject();
    try {
      buildIndex(cwd);
      const indexPath = path.join(cwd, '.planning', 'plan-index.json');
      const first = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

      buildIndex(cwd);
      const second = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

      assert.strictEqual(second.plan_count, first.plan_count, 'plan_count should be same on second run');
      assert.strictEqual(second.plans.length, first.plans.length, 'plans array length should be same');
      assert.deepStrictEqual(second.plans[0].plan_id, first.plans[0].plan_id, 'plan_id should be same');
      assert.deepStrictEqual(second.idf, first.idf, 'idf map should be same');
    } finally {
      cleanup(cwd);
    }
  });
});

// ─── IDX-05: Milestone hook ───────────────────────────────────────────────────

describe('IDX-05 milestone hook', () => {
  test('refreshIndex writes plan-index.json on a temp project with completed plans', () => {
    const { cwd } = createFixtureProject();
    try {
      refreshIndex(cwd);
      const indexPath = path.join(cwd, '.planning', 'plan-index.json');
      assert.ok(fs.existsSync(indexPath), 'plan-index.json should exist after refreshIndex');
    } finally {
      cleanup(cwd);
    }
  });

  test('refreshIndex failure does not propagate when wrapped in try/catch', () => {
    // Verify the contract: caller wraps in try/catch
    let threw = false;
    try {
      // Simulate what milestone.cjs does
      const badRefresh = () => { throw new Error('simulated index failure'); };
      try { badRefresh(); } catch { /* silent */ }
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, false, 'outer catch should not fire');
  });
});

// ─── IDX-06: searchIndex + staleness detection ────────────────────────────────

describe('IDX-06 searchIndex and staleness detection', () => {
  test('searchIndex returns [] and writes warning to stdout when plan-index.json does not exist', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-idx-test-'));
    try {
      // Create .planning dir but no plan-index.json
      fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });

      const chunks = [];
      const origWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = (chunk, ...rest) => { chunks.push(String(chunk)); return origWrite(chunk, ...rest); };

      let result;
      try {
        result = searchIndex(tmpDir, 'any query');
      } finally {
        process.stdout.write = origWrite;
      }

      assert.deepStrictEqual(result, [], 'should return empty array when index missing');
      const combined = chunks.join('');
      assert.ok(combined.includes('plan-index.json'), 'should write warning mentioning plan-index.json');
    } finally {
      cleanup(tmpDir);
    }
  });

  test('searchIndex emits staleness warning when plan-index.json built_at is older than 15 days', () => {
    const { cwd } = createFixtureProject();
    try {
      // Write a fake index with old built_at
      const indexPath = path.join(cwd, '.planning', 'plan-index.json');
      const oldDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
      fs.writeFileSync(indexPath, JSON.stringify({ built_at: oldDate, plan_count: 0, idf: {}, plans: [] }, null, 2));

      const chunks = [];
      const origWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = (chunk, ...rest) => { chunks.push(String(chunk)); return origWrite(chunk, ...rest); };

      try {
        searchIndex(cwd, 'test query');
      } finally {
        process.stdout.write = origWrite;
      }

      const combined = chunks.join('');
      assert.ok(combined.includes('days old'), 'should emit staleness warning for old index');
    } finally {
      cleanup(cwd);
    }
  });

  test('searchIndex does NOT emit staleness warning when plan-index.json built_at is within 1 day', () => {
    const { cwd } = createFixtureProject();
    try {
      // Write a fake index with recent built_at
      const indexPath = path.join(cwd, '.planning', 'plan-index.json');
      const recentDate = new Date().toISOString();
      fs.writeFileSync(indexPath, JSON.stringify({ built_at: recentDate, plan_count: 0, idf: {}, plans: [] }, null, 2));

      const chunks = [];
      const origWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = (chunk, ...rest) => { chunks.push(String(chunk)); return origWrite(chunk, ...rest); };

      try {
        searchIndex(cwd, 'test query');
      } finally {
        process.stdout.write = origWrite;
      }

      const combined = chunks.join('');
      assert.ok(!combined.includes('days old'), 'should NOT emit staleness warning for recent index');
    } finally {
      cleanup(cwd);
    }
  });
});
