'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { generateReviewProfile } = require('../.claude/hooks/lib/review-profile.cjs');

// ─── Fixture helpers ───────────────────────────────────────────────────────────

/**
 * Creates a minimal temp project with corrections.jsonl written to
 * .planning/patterns/. Returns the tmp directory path.
 *
 * @param {object[]} corrections - Array of correction objects to write as JSONL
 * @returns {string} tmp directory path
 */
function createFixture(corrections = []) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-rp-'));
  const patternsDir = path.join(tmp, '.planning', 'patterns');
  fs.mkdirSync(patternsDir, { recursive: true });
  fs.writeFileSync(path.join(tmp, '.planning', 'config.json'), JSON.stringify({}));
  if (corrections.length > 0) {
    const lines = corrections.map(c => JSON.stringify(c)).join('\n');
    fs.writeFileSync(path.join(patternsDir, 'corrections.jsonl'), lines + '\n');
  }
  return tmp;
}

/**
 * Generates N correction entry objects for a given category.
 *
 * @param {string} category - diagnosis_category value
 * @param {number} count - number of entries to generate
 * @param {string} [status] - 'active' (default) or 'retired'
 * @returns {object[]}
 */
function makeCorrections(category, count, status = 'active') {
  return Array.from({ length: count }, (_, i) => ({
    id: `corr-${category}-${i}`,
    diagnosis_category: category,
    status,
    // retired entries have a retired_at field (readCorrections filters on this)
    ...(status === 'retired' ? { retired_at: new Date().toISOString() } : {}),
    timestamp: new Date().toISOString(),
    correction_to: `fix ${i}`,
    scope: 'project',
  }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generateReviewProfile', () => {
  let tmp;

  afterEach(() => {
    if (tmp) {
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
      tmp = null;
    }
  });

  it('returns null when fewer than 10 corrections exist', () => {
    const corrections = makeCorrections('code.wrong_pattern', 5);
    tmp = createFixture(corrections);
    const result = generateReviewProfile({ cwd: tmp });
    assert.strictEqual(result, null);
  });

  it('returns null when no corrections.jsonl exists', () => {
    tmp = createFixture([]);
    const result = generateReviewProfile({ cwd: tmp });
    assert.strictEqual(result, null);
  });

  it('returns null when corrections exist but fewer than 10 are active', () => {
    // 8 active + 5 retired = only 8 count toward minimum
    const corrections = [
      ...makeCorrections('code.wrong_pattern', 8, 'active'),
      ...makeCorrections('process.regression', 5, 'retired'),
    ];
    tmp = createFixture(corrections);
    const result = generateReviewProfile({ cwd: tmp });
    assert.strictEqual(result, null);
  });

  it('generates profile when 10+ active corrections exist', () => {
    const corrections = [
      ...makeCorrections('code.wrong_pattern', 6),
      ...makeCorrections('process.regression', 4),
    ];
    tmp = createFixture(corrections);
    const result = generateReviewProfile({ cwd: tmp });
    assert.ok(result !== null, 'expected non-null profile');
    assert.strictEqual(result.sample_size, 10);
    assert.strictEqual(result.min_corrections_required, 10);
    assert.ok(typeof result.generated_at === 'string', 'generated_at should be a string');
    assert.ok(typeof result.weights === 'object', 'weights should be an object');
  });

  it('weights are normalized to sum to 1.0', () => {
    const corrections = [
      ...makeCorrections('code.wrong_pattern', 6),
      ...makeCorrections('process.regression', 4),
    ];
    tmp = createFixture(corrections);
    const result = generateReviewProfile({ cwd: tmp });
    assert.ok(result !== null);
    const total = Object.values(result.weights).reduce((s, v) => s + v, 0);
    assert.ok(
      Math.abs(total - 1.0) < 0.0001,
      `weights sum to ${total}, expected ~1.0`
    );
  });

  it('weight ratio is proportional to category frequency', () => {
    const corrections = [
      ...makeCorrections('code.wrong_pattern', 8),
      ...makeCorrections('process.regression', 2),
    ];
    tmp = createFixture(corrections);
    const result = generateReviewProfile({ cwd: tmp });
    assert.ok(result !== null);
    assert.ok(
      Math.abs(result.weights['code.wrong_pattern'] - 0.8) < 0.001,
      `code.wrong_pattern weight ${result.weights['code.wrong_pattern']} expected ~0.8`
    );
    assert.ok(
      Math.abs(result.weights['process.regression'] - 0.2) < 0.001,
      `process.regression weight ${result.weights['process.regression']} expected ~0.2`
    );
  });

  it('writes review-profile.json to .planning/patterns/', () => {
    const corrections = makeCorrections('code.wrong_pattern', 10);
    tmp = createFixture(corrections);
    generateReviewProfile({ cwd: tmp });
    const profilePath = path.join(tmp, '.planning', 'patterns', 'review-profile.json');
    assert.ok(fs.existsSync(profilePath), 'review-profile.json should exist');
    const written = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
    assert.strictEqual(written.sample_size, 10);
  });

  it('ignores unknown/invalid categories', () => {
    const corrections = [
      ...makeCorrections('code.wrong_pattern', 10),
      ...makeCorrections('invalid.category', 5),
    ];
    tmp = createFixture(corrections);
    const result = generateReviewProfile({ cwd: tmp });
    assert.ok(result !== null);
    // invalid.category not counted toward sample_size
    assert.strictEqual(result.sample_size, 10);
    assert.ok(!result.weights['invalid.category'], 'invalid.category should not appear in weights');
  });
});
