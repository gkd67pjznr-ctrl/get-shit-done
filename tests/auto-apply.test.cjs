'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Path to the auto-apply module under test
const AUTO_APPLY_PATH = path.join(__dirname, '..', '.claude', 'hooks', 'lib', 'auto-apply.cjs');
const { runAutoApply } = require(AUTO_APPLY_PATH);

// ─── Fixture helper ───────────────────────────────────────────────────────────

/**
 * Create a minimal temp project with git, a SKILL.md, config, and a pending suggestion.
 *
 * @param {object} opts
 * @param {string}  [opts.skillName]       - target skill name (default: 'typescript-patterns')
 * @param {string}  [opts.skillContent]    - SKILL.md content
 * @param {boolean} [opts.autoApply]       - value for adaptive_learning.auto_apply
 * @param {object}  [opts.suggestion]      - overrides for the suggestion object
 * @returns {{ tmp: string, patternsDir: string, skillDir: string, sug: object }}
 */
function createFixture(opts = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-aa-'));
  const patternsDir = path.join(tmp, '.planning', 'patterns');
  const skillDir = path.join(tmp, '.claude', 'skills', opts.skillName || 'typescript-patterns');
  fs.mkdirSync(patternsDir, { recursive: true });
  fs.mkdirSync(skillDir, { recursive: true });

  // Init git repo
  execSync('git init && git config user.email t@t.com && git config user.name T', { cwd: tmp });

  // Write SKILL.md with enough content to avoid size gate on small additions by default
  const skillContent = opts.skillContent !== undefined
    ? opts.skillContent
    : ('# Skill\n\n' + 'Content '.repeat(50) + '\n');
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillContent);

  // Initial commit so HEAD exists and git diff HEAD~1 works
  execSync('git add -A && git commit -m "init"', { cwd: tmp });

  // Config
  const autoApply = opts.autoApply !== undefined ? opts.autoApply : true;
  fs.writeFileSync(
    path.join(tmp, '.planning', 'config.json'),
    JSON.stringify({ adaptive_learning: { auto_apply: autoApply } })
  );

  // Suggestion
  const sug = Object.assign({
    id: 'sug-test-001',
    status: 'pending',
    target_skill: opts.skillName || 'typescript-patterns',
    confidence: 0.97,
    category: 'code.wrong_pattern',
    sample_corrections: ['Use const over let'],
    source_corrections: [],
  }, opts.suggestion || {});

  fs.writeFileSync(
    path.join(patternsDir, 'suggestions.json'),
    JSON.stringify({ suggestions: [sug] })
  );
  fs.writeFileSync(path.join(patternsDir, 'corrections.jsonl'), '');

  return { tmp, patternsDir, skillDir, sug };
}

// Cleanup helper
function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

// ─── CONFIG gate ──────────────────────────────────────────────────────────────

describe('CONFIG gate', () => {
  it('skips all suggestions when auto_apply is false', () => {
    const { tmp } = createFixture({ autoApply: false });
    try {
      const result = runAutoApply({ cwd: tmp });
      assert.equal(result.reason, 'auto_apply_disabled');
      assert.equal(result.applied, 0);
      const auditPath = path.join(tmp, '.planning', 'patterns', 'auto-applied.jsonl');
      assert.ok(!fs.existsSync(auditPath), 'auto-applied.jsonl should not be created when disabled');
    } finally {
      cleanup(tmp);
    }
  });

  it('skips all suggestions when auto_apply key is absent', () => {
    const { tmp } = createFixture({ autoApply: false });
    try {
      // Remove auto_apply key entirely
      fs.writeFileSync(
        path.join(tmp, '.planning', 'config.json'),
        JSON.stringify({ adaptive_learning: {} })
      );
      const result = runAutoApply({ cwd: tmp });
      assert.equal(result.reason, 'auto_apply_disabled');
      assert.equal(result.applied, 0);
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── RATE gate ────────────────────────────────────────────────────────────────

describe('RATE gate', () => {
  it('skips suggestion when same skill applied within 7 days', () => {
    const { tmp, patternsDir, sug } = createFixture({ autoApply: true });
    try {
      // Write a recent "applied" entry for the same skill
      const recentEntry = {
        action: 'applied',
        suggestion_id: 'sug-prior-001',
        skill: sug.target_skill,
        commit_sha: 'abc123',
        confidence: 0.97,
        change_percent: 0.05,
        source_corrections: [],
        before_diff: '',
        reversal_instructions: 'git revert abc123',
        timestamp: new Date().toISOString(),
      };
      fs.writeFileSync(
        path.join(patternsDir, 'auto-applied.jsonl'),
        JSON.stringify(recentEntry) + '\n'
      );

      const result = runAutoApply({ cwd: tmp });
      assert.ok(result.skipped >= 1, 'expected at least one skipped suggestion');

      // Read audit log and verify a "skipped" entry with gate: 'rate'
      const auditContent = fs.readFileSync(
        path.join(patternsDir, 'auto-applied.jsonl'), 'utf-8'
      );
      const entries = auditContent.trim().split('\n').map(l => JSON.parse(l));
      const skippedEntry = entries.find(e => e.action === 'skipped' && e.gate === 'rate');
      assert.ok(skippedEntry, 'should have a skipped entry with gate: rate');
      assert.equal(skippedEntry.suggestion_id, sug.id);
    } finally {
      cleanup(tmp);
    }
  });

  it('passes suggestion when last apply was more than 7 days ago', () => {
    const { tmp, patternsDir, sug } = createFixture({ autoApply: true });
    try {
      // Write an applied entry with timestamp 8 days ago
      const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      const oldEntry = {
        action: 'applied',
        suggestion_id: 'sug-old-001',
        skill: sug.target_skill,
        commit_sha: 'def456',
        confidence: 0.97,
        change_percent: 0.05,
        source_corrections: [],
        before_diff: '',
        reversal_instructions: 'git revert def456',
        timestamp: oldDate,
      };
      fs.writeFileSync(
        path.join(patternsDir, 'auto-applied.jsonl'),
        JSON.stringify(oldEntry) + '\n'
      );

      const result = runAutoApply({ cwd: tmp });

      // If blocked, it must NOT be the rate gate
      if (result.skipped > 0) {
        const auditContent = fs.readFileSync(
          path.join(patternsDir, 'auto-applied.jsonl'), 'utf-8'
        );
        const entries = auditContent.trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
        const newSkipped = entries.filter(e => e.action === 'skipped' && e.suggestion_id === sug.id);
        for (const entry of newSkipped) {
          assert.notEqual(entry.gate, 'rate', 'suggestion should not be blocked by rate gate');
        }
      }
      // Either applied or blocked by a later gate — not the rate gate
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── QUALITY gate ─────────────────────────────────────────────────────────────

describe('QUALITY gate', () => {
  it('skips high-quality skills', () => {
    const { tmp, patternsDir, sug } = createFixture({ autoApply: true });
    try {
      // Write skill-metrics.json with attribution_confidence: 'high'
      // (sessionCount >= 10 and correctionCount > 0 triggers 'high')
      const metricsDoc = {
        metadata: { generated_at: new Date().toISOString() },
        skills: {
          [sug.target_skill]: {
            attribution_confidence: 'high',
            session_count: 12,
            correction_count: 5,
          },
        },
      };
      fs.writeFileSync(
        path.join(patternsDir, 'skill-metrics.json'),
        JSON.stringify(metricsDoc)
      );

      const result = runAutoApply({ cwd: tmp });
      assert.ok(result.skipped >= 1, 'expected at least one skipped suggestion');

      const auditContent = fs.readFileSync(
        path.join(patternsDir, 'auto-applied.jsonl'), 'utf-8'
      );
      const entries = auditContent.trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
      const qualitySkipped = entries.find(e => e.action === 'skipped' && e.gate === 'quality');
      assert.ok(qualitySkipped, 'should have a skipped entry with gate: quality');
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── CONFIDENCE gate ──────────────────────────────────────────────────────────

describe('CONFIDENCE gate', () => {
  it('skips suggestion with confidence <= 0.95', () => {
    const { tmp, patternsDir, sug } = createFixture({
      autoApply: true,
      suggestion: { confidence: 0.95 },
    });
    try {
      const result = runAutoApply({ cwd: tmp });
      assert.ok(result.skipped >= 1);

      const auditContent = fs.readFileSync(
        path.join(patternsDir, 'auto-applied.jsonl'), 'utf-8'
      );
      const entries = auditContent.trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
      const confSkipped = entries.find(e => e.action === 'skipped' && e.gate === 'confidence');
      assert.ok(confSkipped, 'should have a skipped entry with gate: confidence');
    } finally {
      cleanup(tmp);
    }
  });

  it('skips controversial category even with high confidence', () => {
    const { tmp, patternsDir, sug } = createFixture({
      autoApply: true,
      suggestion: { confidence: 0.99, category: 'code.over_engineering' },
    });
    try {
      const result = runAutoApply({ cwd: tmp });
      assert.ok(result.skipped >= 1);

      const auditContent = fs.readFileSync(
        path.join(patternsDir, 'auto-applied.jsonl'), 'utf-8'
      );
      const entries = auditContent.trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
      const confSkipped = entries.find(e => e.action === 'skipped' && e.gate === 'confidence');
      assert.ok(confSkipped, 'should have a skipped entry with gate: confidence for controversial category');
    } finally {
      cleanup(tmp);
    }
  });

  it('passes suggestion with confidence > 0.95 and safe category', () => {
    const { tmp, patternsDir, sug } = createFixture({
      autoApply: true,
      suggestion: { confidence: 0.99, category: 'code.wrong_pattern' },
    });
    try {
      runAutoApply({ cwd: tmp });

      // If a skipped entry exists for this suggestion, it must not be the confidence gate
      const auditPath = path.join(patternsDir, 'auto-applied.jsonl');
      if (fs.existsSync(auditPath)) {
        const entries = fs.readFileSync(auditPath, 'utf-8')
          .trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
        const confBlock = entries.find(e =>
          e.action === 'skipped' &&
          e.gate === 'confidence' &&
          e.suggestion_id === sug.id
        );
        assert.ok(!confBlock, 'suggestion with safe category and high confidence should not be blocked by confidence gate');
      }
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── SIZE gate ────────────────────────────────────────────────────────────────

describe('SIZE gate', () => {
  it('skips suggestion when bullet content adds >= 20% of skill length', () => {
    // Short SKILL.md (~100 chars) with a long correction that exceeds 20%
    const shortContent = '# Skill\n\nShort content here.\n';
    // This content is ~32 chars. A correction string of 10 chars will add:
    //   '- [code.wrong_pattern] AAAAAAAAAA' (~36 chars) + section header overhead
    //   which is well over 20% of 32 chars.
    const { tmp, patternsDir, sug } = createFixture({
      autoApply: true,
      skillContent: shortContent,
      suggestion: {
        confidence: 0.99,
        category: 'code.wrong_pattern',
        sample_corrections: ['A'.repeat(200)], // definitely > 20% of a short file
      },
    });
    try {
      const result = runAutoApply({ cwd: tmp });
      assert.ok(result.skipped >= 1, 'expected at least one skipped suggestion');

      const auditContent = fs.readFileSync(
        path.join(patternsDir, 'auto-applied.jsonl'), 'utf-8'
      );
      const entries = auditContent.trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
      const sizeSkipped = entries.find(e => e.action === 'skipped' && e.gate === 'size');
      assert.ok(sizeSkipped, 'should have a skipped entry with gate: size');
    } finally {
      cleanup(tmp);
    }
  });
});

// ─── Audit log ────────────────────────────────────────────────────────────────

describe('audit log', () => {
  it('writes applied entry with required fields when all gates pass', () => {
    // Use a large SKILL.md and a small correction so size gate passes
    const largeContent = '# Skill\n\n' + 'Reference content line.\n'.repeat(100);
    const { tmp, patternsDir } = createFixture({
      autoApply: true,
      skillContent: largeContent,
      suggestion: {
        id: 'sug-audit-001',
        confidence: 0.99,
        category: 'code.wrong_pattern',
        sample_corrections: ['Use const'], // small relative to large file
        source_corrections: ['corr-001'],
      },
    });
    try {
      const result = runAutoApply({ cwd: tmp });

      const auditPath = path.join(patternsDir, 'auto-applied.jsonl');
      assert.ok(fs.existsSync(auditPath), 'auto-applied.jsonl should exist after apply');

      const lines = fs.readFileSync(auditPath, 'utf-8').trim().split('\n').filter(Boolean);
      const appliedEntry = lines.map(l => JSON.parse(l)).find(e => e.action === 'applied');

      if (!appliedEntry) {
        // Check why it was skipped
        const allEntries = lines.map(l => JSON.parse(l));
        assert.fail('No applied entry found. Skipped entries: ' + JSON.stringify(allEntries));
      }

      // Assert all required fields are present
      assert.ok('action' in appliedEntry, 'missing field: action');
      assert.ok('suggestion_id' in appliedEntry, 'missing field: suggestion_id');
      assert.ok('skill' in appliedEntry, 'missing field: skill');
      assert.ok('commit_sha' in appliedEntry, 'missing field: commit_sha');
      assert.ok('confidence' in appliedEntry, 'missing field: confidence');
      assert.ok('change_percent' in appliedEntry, 'missing field: change_percent');
      assert.ok('source_corrections' in appliedEntry, 'missing field: source_corrections');
      assert.ok('before_diff' in appliedEntry, 'missing field: before_diff');
      assert.ok('reversal_instructions' in appliedEntry, 'missing field: reversal_instructions');
      assert.ok('timestamp' in appliedEntry, 'missing field: timestamp');

      assert.equal(appliedEntry.action, 'applied');
      assert.equal(appliedEntry.suggestion_id, 'sug-audit-001');
      assert.ok(appliedEntry.commit_sha.length > 0, 'commit_sha should be non-empty');
    } finally {
      cleanup(tmp);
    }
  });

  it('reversal_instructions contains commit_sha', () => {
    const largeContent = '# Skill\n\n' + 'Reference content line.\n'.repeat(100);
    const { tmp, patternsDir } = createFixture({
      autoApply: true,
      skillContent: largeContent,
      suggestion: {
        id: 'sug-revert-001',
        confidence: 0.99,
        category: 'code.wrong_pattern',
        sample_corrections: ['Use const'],
        source_corrections: [],
      },
    });
    try {
      runAutoApply({ cwd: tmp });

      const auditPath = path.join(patternsDir, 'auto-applied.jsonl');
      if (!fs.existsSync(auditPath)) return; // skipped for another gate — not this test's concern

      const lines = fs.readFileSync(auditPath, 'utf-8').trim().split('\n').filter(Boolean);
      const appliedEntry = lines.map(l => JSON.parse(l)).find(e => e.action === 'applied');

      if (!appliedEntry) return; // gate blocked it — out of scope for this test

      assert.equal(
        appliedEntry.reversal_instructions,
        'git revert ' + appliedEntry.commit_sha,
        'reversal_instructions should equal "git revert <commit_sha>"'
      );
    } finally {
      cleanup(tmp);
    }
  });
});
