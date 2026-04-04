'use strict';

// Integration tests for Plan 81-01:
//   - revertAutoApply() error paths and happy path
//   - auto_apply_failed flag on gate-failed suggestions

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const REFINE_PATH = path.join(__dirname, '..', '.claude', 'hooks', 'lib', 'refine-skill.cjs');
const AUTO_APPLY_PATH = path.join(__dirname, '..', '.claude', 'hooks', 'lib', 'auto-apply.cjs');
const { revertAutoApply } = require(REFINE_PATH);
const { runAutoApply } = require(AUTO_APPLY_PATH);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create a minimal temp dir with a git repo initialised.
 */
function createTmpGitRepo() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-81-'));
  const patternsDir = path.join(tmp, '.planning', 'patterns');
  fs.mkdirSync(patternsDir, { recursive: true });
  execSync('git init && git config user.email t@t.com && git config user.name T', { cwd: tmp });
  // Need at least one commit so git revert has something to work against
  fs.writeFileSync(path.join(tmp, 'README.md'), 'init\n');
  execSync('git add README.md && git commit -m "chore: initial commit"', { cwd: tmp });
  return tmp;
}

function cleanup(tmp) {
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // best-effort
  }
}

function auditPath(tmp) {
  return path.join(tmp, '.planning', 'patterns', 'auto-applied.jsonl');
}

function writeSuggestions(tmp, suggestions) {
  const p = path.join(tmp, '.planning', 'patterns', 'suggestions.json');
  fs.writeFileSync(p, JSON.stringify({ suggestions }, null, 2));
  return p;
}

function writeConfig(tmp, autoApply = true) {
  const configDir = path.join(tmp, '.planning');
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, 'config.json'),
    JSON.stringify({ adaptive_learning: { auto_apply: autoApply } }, null, 2)
  );
}

// ─── describe: revertAutoApply ─────────────────────────────────────────────

describe('revertAutoApply', () => {
  let tmp;

  beforeEach(() => {
    tmp = createTmpGitRepo();
  });

  afterEach(() => {
    cleanup(tmp);
  });

  it('returns not_found when suggestion id absent from audit log', () => {
    // Write an audit log for a DIFFERENT suggestion_id
    const entry = JSON.stringify({
      action: 'applied',
      suggestion_id: 'sg-other',
      skill: 'some-skill',
      commit_sha: 'abc123',
      timestamp: new Date().toISOString(),
    });
    fs.writeFileSync(auditPath(tmp), entry + '\n');

    const result = revertAutoApply({ suggestionId: 'missing-id', cwd: tmp });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'not_found');
  });

  it('returns already_reverted when reverted entry exists', () => {
    const appliedEntry = JSON.stringify({
      action: 'applied',
      suggestion_id: 'sg-001',
      skill: 'test-skill',
      commit_sha: 'deadbeef',
      timestamp: new Date().toISOString(),
    });
    const revertedEntry = JSON.stringify({
      action: 'reverted',
      suggestion_id: 'sg-001',
      skill: 'test-skill',
      reverted_commit_sha: 'deadbeef',
      reverted_at: new Date().toISOString(),
    });
    fs.writeFileSync(auditPath(tmp), appliedEntry + '\n' + revertedEntry + '\n');

    const result = revertAutoApply({ suggestionId: 'sg-001', cwd: tmp });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'already_reverted');
  });

  it('returns no_commit_sha when commit_sha is empty', () => {
    const entry = JSON.stringify({
      action: 'applied',
      suggestion_id: 'sg-002',
      skill: 'test-skill',
      commit_sha: '',
      timestamp: new Date().toISOString(),
    });
    fs.writeFileSync(auditPath(tmp), entry + '\n');

    const result = revertAutoApply({ suggestionId: 'sg-002', cwd: tmp });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'no_commit_sha');
  });

  it('returns audit_log_missing when auto-applied.jsonl absent', () => {
    // Do NOT create audit log — tmp only has the initial git commit
    const result = revertAutoApply({ suggestionId: 'any', cwd: tmp });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'audit_log_missing');
  });

  it('appends reverted marker on successful revert', () => {
    // Create a real commit that can be reverted
    const dummyFile = path.join(tmp, 'dummy.txt');
    fs.writeFileSync(dummyFile, 'test content\n');
    execSync('git add dummy.txt && git commit -m "test: dummy commit"', { cwd: tmp });
    const sha = execSync('git rev-parse HEAD', { cwd: tmp }).toString().trim();

    // Write audit log with the real commit SHA
    const entry = JSON.stringify({
      action: 'applied',
      suggestion_id: 'sg-003',
      skill: 'my-skill',
      commit_sha: sha,
      timestamp: new Date().toISOString(),
    });
    fs.writeFileSync(auditPath(tmp), entry + '\n');

    const result = revertAutoApply({ suggestionId: 'sg-003', cwd: tmp });
    assert.equal(result.ok, true);
    assert.equal(result.reverted, true);
    assert.equal(result.skill, 'my-skill');

    // Verify a reverted marker was appended
    const lines = fs.readFileSync(auditPath(tmp), 'utf-8')
      .split('\n')
      .filter(l => l.trim());
    const lastEntry = JSON.parse(lines[lines.length - 1]);
    assert.equal(lastEntry.action, 'reverted');
    assert.equal(lastEntry.suggestion_id, 'sg-003');
  });
});

// ─── describe: auto_apply_failed flag ─────────────────────────────────────────

describe('auto_apply_failed flag', () => {
  let tmp;

  beforeEach(() => {
    tmp = createTmpGitRepo();
  });

  afterEach(() => {
    cleanup(tmp);
  });

  it('gate-failed suggestion retains pending status and gains auto_apply_failed flag', () => {
    writeConfig(tmp, true);

    // Suggestion with low confidence (0.5) — will fail the CONFIDENCE gate
    const suggestion = {
      id: 'sg-conf-fail',
      status: 'pending',
      target_skill: 'some-skill',
      category: 'code.style',
      confidence: 0.5,
      sample_corrections: ['use const over let'],
      correction_count: 3,
    };
    const suggestionsPath = writeSuggestions(tmp, [suggestion]);

    // Create a minimal SKILL.md so size gate can evaluate
    const skillDir = path.join(tmp, '.claude', 'skills', 'some-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Some Skill\n\nContent.\n');

    runAutoApply({ cwd: tmp });

    const doc = JSON.parse(fs.readFileSync(suggestionsPath, 'utf-8'));
    const s = doc.suggestions.find(x => x.id === 'sg-conf-fail');
    assert.ok(s, 'suggestion should exist in suggestions.json');
    assert.equal(s.status, 'pending', 'status must remain pending');
    assert.equal(s.auto_apply_failed, true);
    assert.equal(s.failed_gate, 'confidence');
  });

  it('suggestions.json is not written when no gate failures occur (no suggestions case)', () => {
    writeConfig(tmp, true);

    const suggestionsPath = writeSuggestions(tmp, []); // zero pending suggestions

    const statBefore = fs.statSync(suggestionsPath);
    // Small sleep to ensure mtime would differ if file was written
    // (we use content equality instead of mtime for reliability)
    const contentBefore = fs.readFileSync(suggestionsPath, 'utf-8');

    runAutoApply({ cwd: tmp });

    const contentAfter = fs.readFileSync(suggestionsPath, 'utf-8');
    assert.equal(contentAfter, contentBefore, 'suggestions.json should be unchanged when no suggestions');
  });
});
