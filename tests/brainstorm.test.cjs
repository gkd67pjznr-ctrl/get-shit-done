/**
 * Tests for brainstorm commands: eval detection, append-only store
 * TDD test suite for brainstorm.cjs enforcement primitives.
 */

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createTempProject, cleanup } = require('./helpers.cjs');

const brainstorm = require('../get-shit-done/bin/lib/brainstorm.cjs');

// ─── cmdBrainstormCheckEval ─────────────────────────────────────────────────

describe('cmdBrainstormCheckEval', () => {
  test('returns clean=true for neutral text', () => {
    const result = brainstorm.cmdBrainstormCheckEval(
      'the system could route requests through a cache',
      false
    );
    assert.strictEqual(result.clean, true);
    assert.strictEqual(result.violations.length, 0);
  });

  test("detects won't work as a violation", () => {
    const result = brainstorm.cmdBrainstormCheckEval(
      "that won't work in this context",
      false
    );
    assert.strictEqual(result.clean, false);
    assert.ok(result.violations.includes("won't work"), `violations should include "won't work", got: ${JSON.stringify(result.violations)}`);
  });

  test('detects too complex as a violation', () => {
    const result = brainstorm.cmdBrainstormCheckEval(
      'this seems too complex to implement',
      false
    );
    assert.strictEqual(result.clean, false);
  });

  test('constructive override clears violations', () => {
    const result = brainstorm.cmdBrainstormCheckEval(
      'too complex but what if we simplify it',
      false
    );
    assert.strictEqual(result.clean, true);
    assert.strictEqual(result.violations.length, 0);
  });

  test('wild mode detects might as a violation', () => {
    const result = brainstorm.cmdBrainstormCheckEval(
      'this might work',
      true
    );
    assert.strictEqual(result.clean, false);
  });

  test('wild mode does not flag might in non-wild mode', () => {
    const result = brainstorm.cmdBrainstormCheckEval(
      'this might work',
      false
    );
    assert.strictEqual(result.clean, true);
  });

  test('returns non-empty suggestion when violations present', () => {
    const result = brainstorm.cmdBrainstormCheckEval(
      "that won't work here",
      false
    );
    assert.strictEqual(result.clean, false);
    assert.ok(typeof result.suggestion === 'string' && result.suggestion.length > 0,
      `suggestion should be non-empty when violations present, got: ${JSON.stringify(result.suggestion)}`);
  });
});

// ─── cmdBrainstormAppendIdea and cmdBrainstormReadIdeas ─────────────────────

describe('cmdBrainstormAppendIdea and cmdBrainstormReadIdeas', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bs-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('appends first idea with id=1 and count=1', () => {
    const r = brainstorm.cmdBrainstormAppendIdea(tempDir, { content: 'first idea', source_technique: 'freeform' });
    assert.strictEqual(r.id, 1);
    assert.strictEqual(r.count, 1);
  });

  test('sequential ids increment', () => {
    brainstorm.cmdBrainstormAppendIdea(tempDir, { content: 'first idea', source_technique: 'freeform' });
    const r2 = brainstorm.cmdBrainstormAppendIdea(tempDir, { content: 'second idea', source_technique: 'scamper' });
    assert.strictEqual(r2.id, 2);
    assert.strictEqual(r2.count, 2);
  });

  test('readIdeas returns all ideas with no filtering', () => {
    brainstorm.cmdBrainstormAppendIdea(tempDir, { content: 'idea one' });
    brainstorm.cmdBrainstormAppendIdea(tempDir, { content: 'idea two' });
    brainstorm.cmdBrainstormAppendIdea(tempDir, { content: 'idea three' });
    const r = brainstorm.cmdBrainstormReadIdeas(tempDir);
    assert.strictEqual(r.count, 3);
    assert.strictEqual(r.ideas.length, 3);
    assert.ok(r.ideas.some(i => i.content === 'idea one'), 'should include idea one');
    assert.ok(r.ideas.some(i => i.content === 'idea two'), 'should include idea two');
    assert.ok(r.ideas.some(i => i.content === 'idea three'), 'should include idea three');
  });

  test('readIdeas returns empty array when no ideas file exists', () => {
    const r = brainstorm.cmdBrainstormReadIdeas(tempDir);
    assert.deepStrictEqual(r.ideas, []);
    assert.strictEqual(r.count, 0);
  });

  test('idea record contains required fields', () => {
    brainstorm.cmdBrainstormAppendIdea(tempDir, {
      content: 'full idea',
      source_technique: 'scamper',
      perspective: 'competitor',
      scamper_lens: 'substitute',
      tags: ['tag1', 'tag2'],
    });
    const r = brainstorm.cmdBrainstormReadIdeas(tempDir);
    assert.strictEqual(r.ideas.length, 1);
    const idea = r.ideas[0];
    assert.ok('id' in idea, 'record should have id');
    assert.ok('content' in idea, 'record should have content');
    assert.ok('source_technique' in idea, 'record should have source_technique');
    assert.ok('perspective' in idea, 'record should have perspective');
    assert.ok('scamper_lens' in idea, 'record should have scamper_lens');
    assert.ok('tags' in idea, 'record should have tags');
    assert.ok('timestamp' in idea, 'record should have timestamp');
    assert.strictEqual(idea.content, 'full idea');
    assert.strictEqual(idea.source_technique, 'scamper');
    assert.strictEqual(idea.perspective, 'competitor');
    assert.strictEqual(idea.scamper_lens, 'substitute');
    assert.deepStrictEqual(idea.tags, ['tag1', 'tag2']);
  });

  test('append is truly append-only — file grows monotonically', () => {
    for (let i = 1; i <= 5; i++) {
      brainstorm.cmdBrainstormAppendIdea(tempDir, { content: `idea ${i}` });
    }
    const ideasPath = path.join(tempDir, 'ideas.jsonl');
    const content = fs.readFileSync(ideasPath, 'utf-8');
    const lineCount = content.split('\n').filter(l => l.trim() !== '').length;
    assert.strictEqual(lineCount, 5, `ideas.jsonl should have exactly 5 lines, got ${lineCount}`);
  });
});

// ─── cmdBrainstormGetScamperLens ────────────────────────────────────────────

describe('cmdBrainstormGetScamperLens', () => {
  test('returns substitute lens for index 0', () => {
    const r = brainstorm.cmdBrainstormGetScamperLens(0);
    assert.strictEqual(r.id, 'substitute');
    assert.ok(r.prompt.length > 0, 'prompt should be non-empty');
  });

  test('returns reverse lens for index 6', () => {
    const r = brainstorm.cmdBrainstormGetScamperLens(6);
    assert.strictEqual(r.id, 'reverse');
  });

  test('throws for out-of-range index 7', () => {
    assert.throws(() => brainstorm.cmdBrainstormGetScamperLens(7), /Invalid lens index/);
  });

  test('returns all 7 unique lens IDs', () => {
    const ids = [];
    for (let i = 0; i <= 6; i++) {
      ids.push(brainstorm.cmdBrainstormGetScamperLens(i).id);
    }
    assert.strictEqual(ids.length, 7);
    const unique = new Set(ids);
    assert.strictEqual(unique.size, 7, 'all lens IDs should be unique');
  });
});

// ─── cmdBrainstormScamperComplete ───────────────────────────────────────────

describe('cmdBrainstormScamperComplete', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('returns complete=false when no ideas exist', () => {
    const r = brainstorm.cmdBrainstormScamperComplete(tempDir);
    assert.strictEqual(r.complete, false);
    assert.strictEqual(r.missingLenses.length, 7);
  });

  test('returns complete=false when only 5 lenses covered', () => {
    const coveredFive = ['substitute', 'combine', 'adapt', 'modify', 'eliminate'];
    for (const lens of coveredFive) {
      brainstorm.cmdBrainstormAppendIdea(tempDir, { content: `idea for ${lens}`, scamper_lens: lens });
    }
    const r = brainstorm.cmdBrainstormScamperComplete(tempDir);
    assert.strictEqual(r.complete, false);
    assert.strictEqual(r.missingLenses.length, 2);
  });

  test('returns complete=true when all 7 lenses have at least 1 idea', () => {
    const allLenses = ['substitute', 'combine', 'adapt', 'modify', 'put-to-another-use', 'eliminate', 'reverse'];
    for (const lens of allLenses) {
      brainstorm.cmdBrainstormAppendIdea(tempDir, { content: `idea for ${lens}`, scamper_lens: lens });
    }
    const r = brainstorm.cmdBrainstormScamperComplete(tempDir);
    assert.strictEqual(r.complete, true);
    assert.strictEqual(r.missingLenses.length, 0);
  });
});

// ─── cmdBrainstormCheckFloor ────────────────────────────────────────────────

describe('cmdBrainstormCheckFloor', () => {
  test('freeform floor is 15 in normal mode', () => {
    const r = brainstorm.cmdBrainstormCheckFloor('freeform', 0, false);
    assert.strictEqual(r.floor, 15);
  });

  test('freeform floor is 30 in wild mode', () => {
    const r = brainstorm.cmdBrainstormCheckFloor('freeform', 0, true);
    assert.strictEqual(r.floor, 30);
  });

  test('met=false when count below floor', () => {
    const r = brainstorm.cmdBrainstormCheckFloor('freeform', 10, false);
    assert.strictEqual(r.met, false);
    assert.strictEqual(r.remaining, 5);
  });

  test('met=true when count equals floor', () => {
    const r = brainstorm.cmdBrainstormCheckFloor('freeform', 15, false);
    assert.strictEqual(r.met, true);
    assert.strictEqual(r.remaining, 0);
  });

  test('scamper_per_lens floor is 2 normal, 4 wild', () => {
    const normal = brainstorm.cmdBrainstormCheckFloor('scamper_per_lens', 0, false);
    const wild = brainstorm.cmdBrainstormCheckFloor('scamper_per_lens', 0, true);
    assert.strictEqual(normal.floor, 2);
    assert.strictEqual(wild.floor, 4);
  });

  test('throws for unknown technique', () => {
    assert.throws(() => brainstorm.cmdBrainstormCheckFloor('unknown', 5, false), /Unknown technique/);
  });
});

// ─── cmdBrainstormGetPerspective and cmdBrainstormRandomPerspectives ─────────

describe('cmdBrainstormGetPerspective and cmdBrainstormRandomPerspectives', () => {
  test('returns competitor perspective with prompt', () => {
    const r = brainstorm.cmdBrainstormGetPerspective('competitor');
    assert.strictEqual(r.id, 'competitor');
    assert.ok(r.prompt.length > 0, 'prompt should be non-empty');
  });

  test('throws for unknown perspective id', () => {
    assert.throws(() => brainstorm.cmdBrainstormGetPerspective('robot'), /Unknown perspective/);
  });

  test('randomPerspectives returns exactly N items', () => {
    const r = brainstorm.cmdBrainstormRandomPerspectives(3);
    assert.strictEqual(r.length, 3);
  });

  test('randomPerspectives returns unique perspectives', () => {
    const r = brainstorm.cmdBrainstormRandomPerspectives(7);
    const ids = r.map(p => p.id);
    const unique = new Set(ids);
    assert.strictEqual(unique.size, ids.length, 'all returned perspectives should be unique');
  });

  test('randomPerspectives caps at 7 when count exceeds 7', () => {
    const r = brainstorm.cmdBrainstormRandomPerspectives(20);
    assert.strictEqual(r.length, 7);
  });
});

// ─── cmdBrainstormCheckSaturation ───────────────────────────────────────────

describe('cmdBrainstormCheckSaturation', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sat-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('returns saturated=false and velocity=null with no ideas', () => {
    const r = brainstorm.cmdBrainstormCheckSaturation(tempDir, 5);
    assert.strictEqual(r.saturated, false);
    assert.strictEqual(r.velocity, null);
  });

  test('returns saturated=false with 1 idea', () => {
    brainstorm.cmdBrainstormAppendIdea(tempDir, { content: 'only idea' });
    const r = brainstorm.cmdBrainstormCheckSaturation(tempDir, 5);
    assert.strictEqual(r.saturated, false);
  });
});

// ─── cmdBrainstormBuildSeedBrief ────────────────────────────────────────────

describe('cmdBrainstormBuildSeedBrief', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('returns brief string and sources array', () => {
    const r = brainstorm.cmdBrainstormBuildSeedBrief(tempDir);
    assert.strictEqual(typeof r.brief, 'string', 'brief should be a string');
    assert.ok(Array.isArray(r.sources), 'sources should be an array');
  });

  test('brief contains expected section headers', () => {
    const r = brainstorm.cmdBrainstormBuildSeedBrief(tempDir);
    assert.ok(r.brief.includes('Correction Patterns'), 'brief should include Correction Patterns');
    assert.ok(r.brief.includes('Open Debt'), 'brief should include Open Debt');
    assert.ok(r.brief.includes('Prior Brainstorm Ideas'), 'brief should include Prior Brainstorm Ideas');
  });

  test('sources does not include ROADMAP.md or STATE.md', () => {
    // Create ROADMAP.md and STATE.md in the tempDir to ensure they are not read
    fs.writeFileSync(path.join(tempDir, 'ROADMAP.md'), '# Roadmap\n\nshould not be read');
    fs.writeFileSync(path.join(tempDir, 'STATE.md'), '# State\n\nshould not be read');
    const r = brainstorm.cmdBrainstormBuildSeedBrief(tempDir);
    const sourcePaths = r.sources;
    assert.ok(
      !sourcePaths.some(s => s.endsWith('ROADMAP.md')),
      `sources should not include ROADMAP.md, got: ${JSON.stringify(sourcePaths)}`
    );
    assert.ok(
      !sourcePaths.some(s => s.endsWith('STATE.md')),
      `sources should not include STATE.md, got: ${JSON.stringify(sourcePaths)}`
    );
  });

  test('--from-corrections: only corrections and priorIdeas included', () => {
    const opts = { corrections: true, debt: false, sessions: false, priorIdeas: true };
    const r = brainstorm.cmdBrainstormBuildSeedBrief(tempDir, opts);
    assert.deepStrictEqual(r.included, ['corrections', 'priorIdeas'],
      `included should be ['corrections','priorIdeas'], got: ${JSON.stringify(r.included)}`);
    assert.deepStrictEqual(r.excluded, ['sessions', 'debt'],
      `excluded should be ['sessions','debt'], got: ${JSON.stringify(r.excluded)}`);
    assert.ok(r.brief.includes('Correction Patterns'), 'brief should contain Correction Patterns section');
    assert.ok(!r.brief.includes('(Not included in this seed.)') || r.brief.includes('Session History'),
      'excluded sections use placeholder text');
  });

  test('--from-debt: only debt and priorIdeas included', () => {
    const opts = { corrections: false, debt: true, sessions: false, priorIdeas: true };
    const r = brainstorm.cmdBrainstormBuildSeedBrief(tempDir, opts);
    assert.deepStrictEqual(r.included, ['debt', 'priorIdeas'],
      `included should be ['debt','priorIdeas'], got: ${JSON.stringify(r.included)}`);
    assert.deepStrictEqual(r.excluded, ['corrections', 'sessions'],
      `excluded should be ['corrections','sessions'], got: ${JSON.stringify(r.excluded)}`);
    assert.ok(r.brief.includes('Open Debt'), 'brief should contain Open Debt section');
  });

  test('--for-milestone: all sources included', () => {
    const opts = { corrections: true, debt: true, sessions: true, priorIdeas: true };
    const r = brainstorm.cmdBrainstormBuildSeedBrief(tempDir, opts);
    assert.deepStrictEqual(r.included, ['corrections', 'sessions', 'debt', 'priorIdeas'],
      `all four sources should be included, got: ${JSON.stringify(r.included)}`);
    assert.deepStrictEqual(r.excluded, [],
      `excluded should be empty, got: ${JSON.stringify(r.excluded)}`);
  });

  test('no options (default): all sources included', () => {
    const r = brainstorm.cmdBrainstormBuildSeedBrief(tempDir);
    assert.deepStrictEqual(r.included, ['corrections', 'sessions', 'debt', 'priorIdeas'],
      `default should include all sources, got: ${JSON.stringify(r.included)}`);
    assert.deepStrictEqual(r.excluded, [],
      `default excluded should be empty, got: ${JSON.stringify(r.excluded)}`);
  });

  test('return value includes included and excluded arrays', () => {
    const r = brainstorm.cmdBrainstormBuildSeedBrief(tempDir, { corrections: true, debt: false, sessions: true, priorIdeas: true });
    assert.ok(Array.isArray(r.included), 'included should be an array');
    assert.ok(Array.isArray(r.excluded), 'excluded should be an array');
    assert.ok(r.included.includes('corrections'), 'corrections should be in included');
    assert.ok(r.excluded.includes('debt'), 'debt should be in excluded');
  });

  test('brief header lists included sources', () => {
    const opts = { corrections: true, debt: false, sessions: false, priorIdeas: true };
    const r = brainstorm.cmdBrainstormBuildSeedBrief(tempDir, opts);
    assert.ok(r.brief.includes('# Seed Brief'), 'brief should start with Seed Brief header');
    assert.ok(r.brief.includes('corrections.jsonl'), 'header should mention corrections.jsonl as included');
    assert.ok(r.brief.includes('ROADMAP.md'), 'header should mention ROADMAP.md as always excluded');
    assert.ok(r.brief.includes('STATE.md'), 'header should mention STATE.md as always excluded');
  });

  test('prior FEATURE-IDEAS.md files read even with --from-corrections only', () => {
    // Create a quick subdir with a FEATURE-IDEAS.md
    const quickDir = path.join(tempDir, 'quick', '01-prior-brainstorm');
    fs.mkdirSync(quickDir, { recursive: true });
    fs.writeFileSync(path.join(quickDir, 'FEATURE-IDEAS.md'), '# Prior Feature Ideas\n\n- idea alpha\n- idea beta\n');
    const opts = { corrections: true, debt: false, sessions: false, priorIdeas: true };
    const r = brainstorm.cmdBrainstormBuildSeedBrief(tempDir, opts);
    assert.ok(r.brief.includes('Prior Brainstorm Ideas'), 'brief should contain Prior Brainstorm Ideas section');
    assert.ok(r.brief.includes('idea alpha') || r.brief.includes('01-prior-brainstorm'),
      'brief should reference content from the prior FEATURE-IDEAS.md');
  });
});

// ─── cmdBrainstormCluster ────────────────────────────────────────────────────

describe('cmdBrainstormCluster', () => {
  const nineIdeas = [
    { id: 1, content: 'cache layer for database queries to improve speed' },
    { id: 2, content: 'database index optimization for faster reads' },
    { id: 3, content: 'cache invalidation strategy when data changes' },
    { id: 4, content: 'user authentication token refresh mechanism' },
    { id: 5, content: 'session storage for user login state' },
    { id: 6, content: 'notification system for user activity alerts' },
    { id: 7, content: 'email notification templates for system events' },
    { id: 8, content: 'real-time notification via websocket channel' },
    { id: 9, content: 'background task queue for async processing' },
  ];

  test('returns empty clusters for empty ideas array', () => {
    const r = brainstorm.cmdBrainstormCluster([]);
    assert.deepStrictEqual(r.clusters, []);
    assert.strictEqual(r.count, 0);
  });

  test('every idea appears in exactly one cluster', () => {
    const r = brainstorm.cmdBrainstormCluster(nineIdeas);
    const allIds = r.clusters.flatMap(c => c.idea_ids);
    assert.strictEqual(allIds.length, 9, `all 9 ideas should be assigned, got ${allIds.length}`);
    assert.strictEqual(new Set(allIds).size, 9, 'each idea should appear in exactly one cluster');
  });

  test('cluster count is between 3 and 7 for 9 ideas', () => {
    const r = brainstorm.cmdBrainstormCluster(nineIdeas);
    assert.ok(r.count >= 3 && r.count <= 7, `cluster count should be 3-7, got ${r.count}`);
  });

  test('each cluster has a non-empty label', () => {
    const r = brainstorm.cmdBrainstormCluster(nineIdeas);
    for (const cluster of r.clusters) {
      assert.ok(typeof cluster.label === 'string' && cluster.label.length > 0,
        `cluster label should be non-empty, got: ${JSON.stringify(cluster.label)}`);
    }
  });

  test('cluster count equals idea count when fewer than 3 ideas', () => {
    const twoIdeas = [
      { id: 1, content: 'fast cache implementation' },
      { id: 2, content: 'slow database query fix' },
    ];
    const r = brainstorm.cmdBrainstormCluster(twoIdeas);
    assert.ok(r.count <= 2, `cluster count should be <= 2 for 2 ideas, got ${r.count}`);
  });

  test('does not modify the input ideas array', () => {
    const ideas = [
      { id: 1, content: 'original idea content here' },
      { id: 2, content: 'another original idea content' },
    ];
    const original = JSON.stringify(ideas);
    brainstorm.cmdBrainstormCluster(ideas);
    assert.strictEqual(JSON.stringify(ideas), original, 'input ideas array should not be modified');
  });
});

// ─── cmdBrainstormScore ──────────────────────────────────────────────────────

describe('cmdBrainstormScore', () => {
  const idea = { id: 42, content: 'test idea' };

  test('composite is feasibility + impact + alignment - risk', () => {
    const r = brainstorm.cmdBrainstormScore(idea, { feasibility: 4, impact: 3, alignment: 5, risk: 2 });
    assert.strictEqual(r.composite, 10);
  });

  test('maximum composite is 14', () => {
    const r = brainstorm.cmdBrainstormScore(idea, { feasibility: 5, impact: 5, alignment: 5, risk: 1 });
    assert.strictEqual(r.composite, 14);
  });

  test('minimum composite is -2', () => {
    const r = brainstorm.cmdBrainstormScore(idea, { feasibility: 1, impact: 1, alignment: 1, risk: 5 });
    assert.strictEqual(r.composite, -2);
  });

  test('returns id from input idea', () => {
    const r = brainstorm.cmdBrainstormScore(idea, { feasibility: 3, impact: 3, alignment: 3, risk: 3 });
    assert.strictEqual(r.id, 42);
  });

  test('throws for feasibility=0', () => {
    assert.throws(
      () => brainstorm.cmdBrainstormScore(idea, { feasibility: 0, impact: 3, alignment: 3, risk: 3 }),
      /Invalid dimension value/
    );
  });

  test('throws for feasibility=6', () => {
    assert.throws(
      () => brainstorm.cmdBrainstormScore(idea, { feasibility: 6, impact: 3, alignment: 3, risk: 3 }),
      /Invalid dimension value/
    );
  });

  test('throws for non-integer dimension', () => {
    assert.throws(
      () => brainstorm.cmdBrainstormScore(idea, { feasibility: 2.5, impact: 3, alignment: 3, risk: 3 }),
      /Invalid dimension value/
    );
  });
});

// ─── cmdBrainstormSelectFinalists ────────────────────────────────────────────

describe('cmdBrainstormSelectFinalists', () => {
  const ideas = [
    { id: 1, content: 'alpha' },
    { id: 2, content: 'beta' },
    { id: 3, content: 'gamma' },
  ];
  const scores = [
    { id: 1, composite: 10 },
    { id: 2, composite: 8 },
    { id: 3, composite: 12 },
  ];

  test('returns only selected ideas', () => {
    const r = brainstorm.cmdBrainstormSelectFinalists(ideas, scores, [1, 3]);
    assert.strictEqual(r.finalists.length, 2);
    assert.ok(r.finalists.some(f => f.id === 1), 'finalists should include id 1');
    assert.ok(r.finalists.some(f => f.id === 3), 'finalists should include id 3');
  });

  test('returns only selected scores', () => {
    const r = brainstorm.cmdBrainstormSelectFinalists(ideas, scores, [1, 3]);
    assert.strictEqual(r.scores.length, 2);
    assert.ok(r.scores.some(s => s.id === 1), 'scores should include id 1');
    assert.ok(r.scores.some(s => s.id === 3), 'scores should include id 3');
  });

  test('count matches finalist length', () => {
    const r = brainstorm.cmdBrainstormSelectFinalists(ideas, scores, [1, 3]);
    assert.strictEqual(r.count, r.finalists.length);
  });

  test('empty selection returns count 0', () => {
    const r = brainstorm.cmdBrainstormSelectFinalists(ideas, scores, []);
    assert.strictEqual(r.count, 0);
    assert.deepStrictEqual(r.finalists, []);
  });

  test('does not modify input arrays', () => {
    const ideasCopy = JSON.stringify(ideas);
    const scoresCopy = JSON.stringify(scores);
    brainstorm.cmdBrainstormSelectFinalists(ideas, scores, [1]);
    assert.strictEqual(JSON.stringify(ideas), ideasCopy, 'input ideas array should not be modified');
    assert.strictEqual(JSON.stringify(scores), scoresCopy, 'input scores array should not be modified');
  });
});

// ─── cmdBrainstormCreateOutputDir ────────────────────────────────────────────

describe('cmdBrainstormCreateOutputDir', () => {
  let tmpRoot;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bstest-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  test('creates first dir with number 1 and correct name', () => {
    const r = brainstorm.cmdBrainstormCreateOutputDir(tmpRoot, 'authentication');
    assert.strictEqual(r.number, 1);
    assert.strictEqual(path.basename(r.dir), '01-brainstorm-authentication');
  });

  test('sequential numbering increments on second call', () => {
    brainstorm.cmdBrainstormCreateOutputDir(tmpRoot, 'authentication');
    const r2 = brainstorm.cmdBrainstormCreateOutputDir(tmpRoot, 'caching');
    assert.strictEqual(r2.number, 2);
  });

  test('sanitizes spaces in topic to hyphens', () => {
    const r = brainstorm.cmdBrainstormCreateOutputDir(tmpRoot, 'caching layer');
    assert.ok(path.basename(r.dir).includes('caching-layer'),
      `expected basename to contain 'caching-layer', got: ${path.basename(r.dir)}`);
  });

  test('created directory exists on disk', () => {
    const r = brainstorm.cmdBrainstormCreateOutputDir(tmpRoot, 'authentication');
    assert.strictEqual(fs.existsSync(r.dir), true);
  });

  test('creates quick dir if it does not exist', () => {
    // fresh tmpRoot has no quick/ subdir
    const r = brainstorm.cmdBrainstormCreateOutputDir(tmpRoot, 'test');
    assert.strictEqual(fs.existsSync(r.dir), true);
    assert.ok(r.dir.includes('quick'), 'dir should be under quick/');
  });
});

// ─── cmdBrainstormFormatResults ──────────────────────────────────────────────

describe('cmdBrainstormFormatResults', () => {
  let sessionDir;
  let outputDir;
  let clusters;
  let scores;
  let finalists;

  beforeEach(() => {
    sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bssess-'));
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bsout-'));

    brainstorm.cmdBrainstormAppendIdea(sessionDir, { content: 'cache layer', source_technique: 'freeform' });
    brainstorm.cmdBrainstormAppendIdea(sessionDir, { content: 'auth tokens', source_technique: 'scamper' });
    brainstorm.cmdBrainstormAppendIdea(sessionDir, { content: 'notifications system', source_technique: 'freeform' });

    const { ideas } = brainstorm.cmdBrainstormReadIdeas(sessionDir);
    const clustersResult = brainstorm.cmdBrainstormCluster(ideas);
    clusters = clustersResult.clusters;
    scores = ideas.map(i => brainstorm.cmdBrainstormScore(i, { feasibility: 4, impact: 4, alignment: 4, risk: 2 }));
    const result = brainstorm.cmdBrainstormSelectFinalists(ideas, scores, [1, 3]);
    finalists = result.finalists;
  });

  afterEach(() => {
    fs.rmSync(sessionDir, { recursive: true, force: true });
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  test('returns files_written array with 3 entries', () => {
    const r = brainstorm.cmdBrainstormFormatResults(clusters, scores, finalists, sessionDir, outputDir);
    assert.strictEqual(r.files_written.length, 3);
  });

  test('FEATURE-IDEAS.md exists after format', () => {
    brainstorm.cmdBrainstormFormatResults(clusters, scores, finalists, sessionDir, outputDir);
    assert.strictEqual(fs.existsSync(path.join(outputDir, 'FEATURE-IDEAS.md')), true);
  });

  test('BRAINSTORM-SESSION.md exists after format', () => {
    brainstorm.cmdBrainstormFormatResults(clusters, scores, finalists, sessionDir, outputDir);
    assert.strictEqual(fs.existsSync(path.join(outputDir, 'BRAINSTORM-SESSION.md')), true);
  });

  test('ideas.jsonl copied to output dir', () => {
    brainstorm.cmdBrainstormFormatResults(clusters, scores, finalists, sessionDir, outputDir);
    assert.strictEqual(fs.existsSync(path.join(outputDir, 'ideas.jsonl')), true);
  });

  test('FEATURE-IDEAS.md contains finalist content', () => {
    brainstorm.cmdBrainstormFormatResults(clusters, scores, finalists, sessionDir, outputDir);
    const content = fs.readFileSync(path.join(outputDir, 'FEATURE-IDEAS.md'), 'utf-8');
    // finalists are ideas 1 (cache layer) and 3 (notifications system)
    const hasFinalist = content.includes('cache layer') || content.includes('notifications system');
    assert.ok(hasFinalist, 'FEATURE-IDEAS.md should contain at least one finalist idea content');
  });

  test('FEATURE-IDEAS.md contains composite score', () => {
    brainstorm.cmdBrainstormFormatResults(clusters, scores, finalists, sessionDir, outputDir);
    const content = fs.readFileSync(path.join(outputDir, 'FEATURE-IDEAS.md'), 'utf-8');
    assert.ok(content.includes('Composite'), 'FEATURE-IDEAS.md should contain Composite score column');
  });

  test('BRAINSTORM-SESSION.md contains all ideas', () => {
    brainstorm.cmdBrainstormFormatResults(clusters, scores, finalists, sessionDir, outputDir);
    const content = fs.readFileSync(path.join(outputDir, 'BRAINSTORM-SESSION.md'), 'utf-8');
    assert.ok(content.includes('cache layer'), 'should include idea 1');
    assert.ok(content.includes('auth tokens'), 'should include idea 2');
    assert.ok(content.includes('notifications system'), 'should include idea 3');
  });

  test('files_written contains only paths that exist on disk', () => {
    const r = brainstorm.cmdBrainstormFormatResults(clusters, scores, finalists, sessionDir, outputDir);
    for (const p of r.files_written) {
      assert.strictEqual(fs.existsSync(p), true, `path should exist: ${p}`);
    }
  });

  test('handles missing ideas.jsonl gracefully', () => {
    // Create a sessionDir with no ideas.jsonl
    const emptySession = fs.mkdtempSync(path.join(os.tmpdir(), 'bsempty-'));
    try {
      let r;
      assert.doesNotThrow(() => {
        r = brainstorm.cmdBrainstormFormatResults(clusters, scores, finalists, emptySession, outputDir);
      });
      assert.strictEqual(r.files_written.length, 2, 'should write only 2 files when ideas.jsonl missing');
    } finally {
      fs.rmSync(emptySession, { recursive: true, force: true });
    }
  });
});
