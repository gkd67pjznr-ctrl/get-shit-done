'use strict';

// Integration tests for Plan 83-02:
//   - decision-audit.cjs CLI integration (JSON output contract)
//   - digest.md structural checks (Step 3j, Step 5 rule, success_criteria)

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const { parseDecisions, detectTensions } = require('../.claude/hooks/lib/decision-audit.cjs');

const DECISION_AUDIT_CLI = path.join(__dirname, '..', '.claude', 'hooks', 'lib', 'decision-audit.cjs');
const DIGEST_PATH = path.join(__dirname, '..', 'commands', 'gsd', 'digest.md');

// ─── Fixture helpers ───────────────────────────────────────────────────────────

function makeCorrection(overrides = {}) {
  return {
    id: overrides.id || `corr-${Date.now()}-${Math.random()}`,
    diagnosis_category: overrides.diagnosis_category || 'code.wrong_pattern',
    status: overrides.status || 'active',
    timestamp: new Date().toISOString(),
    correction_to: overrides.correction_to || 'fix it',
    correction_from: 'old value',
    diagnosis_text: overrides.diagnosis_text || '',
    scope: 'project',
    phase: '83',
    session_id: 'sess-001',
    source: 'self_report',
  };
}

function createFixture({ corrections = [], projectMdContent = '' } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-da-digest-'));
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

function makeProjectMd(rows) {
  const rowLines = rows.map(r => `| ${r.decision} | ${r.rationale} | ✓ Good |`).join('\n');
  return `# Project\n\n## Key Decisions\n\n| Decision | Rationale | Outcome |\n|----------|-----------|---------||\n${rowLines}\n\n## Other Section\n`;
}

// ─── Test state for cleanup ────────────────────────────────────────────────────

let tmpDirs = [];

afterEach(() => {
  for (const dir of tmpDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }
  tmpDirs = [];
});

// ─── CLI integration tests ─────────────────────────────────────────────────────

describe('decision-audit CLI integration', () => {
  it('CLI outputs valid JSON array', () => {
    const tmp = createFixture({});
    tmpDirs.push(tmp);
    const out = execSync(`node "${DECISION_AUDIT_CLI}" "${tmp}"`, { encoding: 'utf-8' });
    const parsed = JSON.parse(out);
    assert.ok(Array.isArray(parsed));
  });

  it('CLI outputs empty array when no PROJECT.md exists', () => {
    const tmp = createFixture({ corrections: [] });
    tmpDirs.push(tmp);
    const out = execSync(`node "${DECISION_AUDIT_CLI}" "${tmp}"`, { encoding: 'utf-8' });
    assert.deepStrictEqual(JSON.parse(out), []);
  });

  it('CLI outputs empty array when corrections exist but < 3 match any decision', () => {
    const projectMd = makeProjectMd([{ decision: 'fork repo direct', rationale: 'modification' }]);
    const corrections = [makeCorrection({ id: 'c1', correction_to: 'fork repo modification' })];
    const tmp = createFixture({ corrections, projectMdContent: projectMd });
    tmpDirs.push(tmp);
    const out = execSync(`node "${DECISION_AUDIT_CLI}" "${tmp}"`, { encoding: 'utf-8' });
    assert.deepStrictEqual(JSON.parse(out), []);
  });

  it('CLI outputs tensions when 3+ corrections match a decision', () => {
    const projectMd = makeProjectMd([{
      decision: 'fork repository direct extension',
      rationale: 'modification layer indirection',
    }]);
    const corrections = Array.from({ length: 4 }, (_, i) =>
      makeCorrection({ id: `c${i}`, correction_to: 'fork repository direct modification extension layer' })
    );
    const tmp = createFixture({ corrections, projectMdContent: projectMd });
    tmpDirs.push(tmp);
    const out = execSync(`node "${DECISION_AUDIT_CLI}" "${tmp}"`, { encoding: 'utf-8' });
    const tensions = JSON.parse(out);
    assert.ok(tensions.length >= 1);
    assert.ok(tensions[0].correction_count >= 3);
    assert.ok(typeof tensions[0].confidence === 'number');
    assert.ok(typeof tensions[0].decision_text === 'string');
  });
});

// ─── digest.md structural tests ───────────────────────────────────────────────

describe('digest.md decision tensions section', () => {
  it('digest.md contains Step 3j heading', () => {
    const content = fs.readFileSync(DIGEST_PATH, 'utf-8');
    assert.ok(content.includes('3j. Decision tensions'), 'Step 3j must be present in digest.md');
  });

  it('digest.md Step 3j references decision-audit.cjs CLI invocation', () => {
    const content = fs.readFileSync(DIGEST_PATH, 'utf-8');
    assert.ok(content.includes('decision-audit.cjs'), 'CLI invocation must be present');
  });

  it('digest.md Step 5 contains decision tensions recommendation rule', () => {
    const content = fs.readFileSync(DIGEST_PATH, 'utf-8');
    assert.ok(content.includes('Decision tensions'), 'Decision tensions must be present in digest.md');
    const step5Start = content.indexOf('## Step 5');
    assert.ok(step5Start !== -1, 'Step 5 must exist in digest.md');
    const step5Section = content.slice(step5Start);
    assert.ok(step5Section.includes('Decision tensions'), 'tension rule must be in Step 5');
  });

  it('digest.md success_criteria includes Decision Tensions criterion', () => {
    const content = fs.readFileSync(DIGEST_PATH, 'utf-8');
    const criteriaStart = content.indexOf('<success_criteria>');
    assert.ok(criteriaStart !== -1, 'success_criteria block must exist');
    const criteriaSection = content.slice(criteriaStart);
    assert.ok(criteriaSection.includes('Decision Tensions section'), 'criterion must be present in success_criteria');
  });
});
