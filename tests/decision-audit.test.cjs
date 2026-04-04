'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { parseDecisions, matchCorrectionsToDecision, detectTensions } = require('../.claude/hooks/lib/decision-audit.cjs');

// ─── Fixture helpers ───────────────────────────────────────────────────────────

/**
 * Builds a PROJECT.md string with a Key Decisions table from the given rows.
 *
 * @param {{ decision: string, rationale: string }[]} rows
 * @returns {string}
 */
function makeProjectMd(rows) {
  const rowLines = rows.map(r => `| ${r.decision} | ${r.rationale} | ✓ Good |`).join('\n');
  return `# Project\n\n## Key Decisions\n\n| Decision | Rationale | Outcome |\n|----------|-----------|---------||\n${rowLines}\n\n## Other Section\n`;
}

/**
 * Creates a minimal correction entry with required fields.
 *
 * @param {object} [overrides]
 * @returns {object}
 */
function makeCorrection(overrides = {}) {
  return {
    id: overrides.id || 'corr-001',
    diagnosis_category: overrides.diagnosis_category || 'code.wrong_pattern',
    status: overrides.status || 'active',
    timestamp: new Date().toISOString(),
    correction_to: overrides.correction_to || 'fix it',
    correction_from: overrides.correction_from || 'old',
    diagnosis_text: overrides.diagnosis_text !== undefined ? overrides.diagnosis_text : '',
    scope: overrides.scope || 'project',
    phase: overrides.phase || '83',
    session_id: overrides.session_id || 'sess-001',
    source: overrides.source || 'self_report',
  };
}

/**
 * Creates a temp directory with optional corrections.jsonl and PROJECT.md.
 * Returns the tmp directory path.
 *
 * @param {object[]} corrections
 * @param {string} projectMdContent - if empty string, PROJECT.md is not written
 * @returns {string}
 */
function createFixture(corrections = [], projectMdContent = '') {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-da-'));
  const patternsDir = path.join(tmp, '.planning', 'patterns');
  fs.mkdirSync(patternsDir, { recursive: true });
  fs.writeFileSync(path.join(tmp, '.planning', 'config.json'), JSON.stringify({}));
  if (corrections.length > 0) {
    const lines = corrections.map(c => JSON.stringify(c)).join('\n') + '\n';
    fs.writeFileSync(path.join(patternsDir, 'corrections.jsonl'), lines);
  }
  if (projectMdContent) {
    fs.writeFileSync(path.join(tmp, '.planning', 'PROJECT.md'), projectMdContent);
  }
  return tmp;
}

// ─── parseDecisions tests ─────────────────────────────────────────────────────

describe('parseDecisions', () => {
  it('returns empty array when content has no Key Decisions section', () => {
    assert.deepStrictEqual(parseDecisions('# No sections here'), []);
  });

  it('parses rows from Key Decisions table', () => {
    const content = makeProjectMd([{ decision: 'Fork the repo', rationale: 'Need direct modification' }]);
    const d = parseDecisions(content);
    assert.strictEqual(d.length, 1);
    assert.strictEqual(d[0].decision, 'Fork the repo');
    assert.strictEqual(d[0].rationale, 'Need direct modification');
  });

  it('skips header row and separator row', () => {
    const content = makeProjectMd([{ decision: 'Use JSONL', rationale: 'File-based storage' }]);
    const d = parseDecisions(content);
    assert.ok(d.every(row => row.decision !== 'Decision' && row.decision !== '----------'));
  });

  it('parses multiple rows', () => {
    const content = makeProjectMd([
      { decision: 'A', rationale: 'rationale A' },
      { decision: 'B', rationale: 'rationale B' },
    ]);
    assert.strictEqual(parseDecisions(content).length, 2);
  });
});

// ─── matchCorrectionsToDecision tests ────────────────────────────────────────

describe('matchCorrectionsToDecision', () => {
  it('returns empty array when no corrections match above threshold', () => {
    const corrections = [makeCorrection({ correction_to: 'completely unrelated xyz123', diagnosis_text: '' })];
    const decision = { decision: 'Fork the repo', rationale: 'Need direct modification' };
    const matches = matchCorrectionsToDecision(corrections, decision);
    assert.strictEqual(matches.length, 0);
  });

  it('returns matches when Jaccard score >= 0.05', () => {
    const corrections = [makeCorrection({ correction_to: 'fork the repo direct modification needed', diagnosis_text: '' })];
    const decision = { decision: 'Fork the repo', rationale: 'Need direct modification' };
    const matches = matchCorrectionsToDecision(corrections, decision);
    assert.strictEqual(matches.length, 1);
    assert.ok(matches[0].score >= 0.05);
  });

  it('each match object has correction and score fields', () => {
    const corrections = [makeCorrection({ correction_to: 'fork repo modification', diagnosis_text: '' })];
    const decision = { decision: 'Fork the repo', rationale: 'Need to modify' };
    const matches = matchCorrectionsToDecision(corrections, decision);
    if (matches.length > 0) {
      assert.ok(typeof matches[0].score === 'number');
      assert.ok(matches[0].correction && matches[0].correction.id);
    }
  });
});

// ─── detectTensions tests ─────────────────────────────────────────────────────

describe('detectTensions', () => {
  let tmp;

  afterEach(() => {
    if (tmp) {
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
      tmp = null;
    }
  });

  it('returns empty array when PROJECT.md does not exist', () => {
    tmp = createFixture([], ''); // no PROJECT.md
    assert.deepStrictEqual(detectTensions({ cwd: tmp }), []);
  });

  it('returns empty array when no active corrections exist', () => {
    const projectMd = makeProjectMd([{ decision: 'Fork the repo', rationale: 'Direct modification' }]);
    tmp = createFixture([], projectMd);
    assert.deepStrictEqual(detectTensions({ cwd: tmp }), []);
  });

  it('returns empty array when fewer than 3 corrections match a decision', () => {
    const projectMd = makeProjectMd([{ decision: 'fork repo direct', rationale: 'modification needed' }]);
    const corrections = [
      makeCorrection({ id: 'c1', correction_to: 'fork repo direct modification' }),
      makeCorrection({ id: 'c2', correction_to: 'fork repo direct modification' }),
    ]; // only 2 matches
    tmp = createFixture(corrections, projectMd);
    assert.deepStrictEqual(detectTensions({ cwd: tmp }), []);
  });

  it('returns tension when 3+ corrections match a decision', () => {
    const projectMd = makeProjectMd([{ decision: 'fork repo direct modification', rationale: 'extension layer indirection' }]);
    const corrections = Array.from({ length: 3 }, (_, i) =>
      makeCorrection({ id: `c${i}`, correction_to: 'fork repo direct modification extension' })
    );
    tmp = createFixture(corrections, projectMd);
    const tensions = detectTensions({ cwd: tmp });
    assert.strictEqual(tensions.length, 1);
    assert.strictEqual(tensions[0].correction_count, 3);
    assert.ok(typeof tensions[0].confidence === 'number');
    assert.ok(tensions[0].confidence > 0);
    assert.strictEqual(tensions[0].matched_corrections.length, 3);
  });

  it('tension object has all required fields', () => {
    const projectMd = makeProjectMd([{ decision: 'fork repo direct modification', rationale: 'extension layer indirection' }]);
    const corrections = Array.from({ length: 3 }, (_, i) =>
      makeCorrection({ id: `c${i}`, correction_to: 'fork repo direct modification extension' })
    );
    tmp = createFixture(corrections, projectMd);
    const tensions = detectTensions({ cwd: tmp });
    assert.strictEqual(tensions.length, 1);
    const t = tensions[0];
    assert.ok(typeof t.decision_text === 'string' && t.decision_text.length > 0);
    assert.ok(typeof t.rationale === 'string' && t.rationale.length > 0);
    assert.ok(Array.isArray(t.matched_corrections));
    assert.ok(typeof t.confidence === 'number');
    assert.ok(typeof t.correction_count === 'number');
  });

  it('does not throw when called with invalid cwd', () => {
    assert.doesNotThrow(() => detectTensions({ cwd: '/nonexistent/path/xyz' }));
  });
});
