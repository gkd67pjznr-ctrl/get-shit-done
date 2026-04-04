'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const { acceptSuggestion, appendSkillHistory } = require('../../.claude/hooks/lib/refine-skill.cjs');

function createTestProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'refine-skill-history-test-'));

  // Initialize git repo
  execSync('git init', { cwd: tmpDir });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir });
  execSync('git config user.name "Test"', { cwd: tmpDir });

  // Create suggestions.json
  const patternsDir = path.join(tmpDir, '.planning', 'patterns');
  fs.mkdirSync(patternsDir, { recursive: true });
  fs.writeFileSync(
    path.join(patternsDir, 'suggestions.json'),
    JSON.stringify({
      suggestions: [{
        id: 'sug-test-001',
        status: 'pending',
        target_skill: 'test-skill',
        category: 'code.wrong_pattern',
        sample_corrections: ['Use const instead of let'],
        rationale: 'Repeated pattern of using let for immutable bindings'
      }]
    }, null, 2),
    'utf-8'
  );

  // Create skill SKILL.md
  const skillDir = path.join(tmpDir, '.claude', 'skills', 'test-skill');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Test Skill\n', 'utf-8');

  // Initial commit
  execSync('git add -A', { cwd: tmpDir });
  execSync('git commit -m "init"', { cwd: tmpDir });

  return tmpDir;
}

function cleanupTestProject(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

test('acceptSuggestion appends SKILL-HISTORY.md with diff and rationale', async () => {
  const tmpDir = createTestProject();
  try {
    const result = acceptSuggestion({ suggestionId: 'sug-test-001', cwd: tmpDir });
    assert.strictEqual(result.ok, true, 'acceptSuggestion should return ok: true');

    const historyPath = path.join(tmpDir, '.claude', 'skills', 'test-skill', 'SKILL-HISTORY.md');
    assert.ok(fs.existsSync(historyPath), 'SKILL-HISTORY.md should exist in skill directory');

    const content = fs.readFileSync(historyPath, 'utf-8');
    assert.ok(content.includes('sug-test-001'), 'SKILL-HISTORY.md should contain suggestion id');
    assert.ok(content.includes('code.wrong_pattern'), 'SKILL-HISTORY.md should contain category');
    assert.ok(content.includes('Repeated pattern of using let'), 'SKILL-HISTORY.md should contain rationale');
    assert.ok(content.includes('```diff'), 'SKILL-HISTORY.md should contain diff block');
  } finally {
    cleanupTestProject(tmpDir);
  }
});

test('SKILL-HISTORY.md is in skill directory not project root', async () => {
  const tmpDir = createTestProject();
  try {
    acceptSuggestion({ suggestionId: 'sug-test-001', cwd: tmpDir });

    assert.ok(
      !fs.existsSync(path.join(tmpDir, 'SKILL-HISTORY.md')),
      'SKILL-HISTORY.md should NOT exist in project root'
    );
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.claude', 'skills', 'test-skill', 'SKILL-HISTORY.md')),
      'SKILL-HISTORY.md should exist in skill directory'
    );
  } finally {
    cleanupTestProject(tmpDir);
  }
});

test('rotation archives when entry count reaches 50', async () => {
  const tmpDir = createTestProject();
  try {
    const skillDir = path.join(tmpDir, '.claude', 'skills', 'test-skill');
    const historyPath = path.join(skillDir, 'SKILL-HISTORY.md');

    // Populate with exactly 50 ## Entry headers
    let content = '';
    for (let i = 1; i <= 50; i++) {
      content += `## Entry ${String(i).padStart(3, '0')} — 2026-01-01\n\n**Suggestion:** sug-old-${i}\n**Category:** code.test\n**Rationale:** test\n\n\`\`\`diff\n- old\n+ new\n\`\`\`\n\n`;
    }
    fs.writeFileSync(historyPath, content, 'utf-8');

    const skillPath = path.join(skillDir, 'SKILL.md');
    const fakeSuggestion = {
      id: 'sug-new-001',
      category: 'code.rotation_test',
      rationale: 'Rotation test rationale'
    };
    const fakeDiff = '- old line\n+ new line';

    appendSkillHistory(tmpDir, skillPath, fakeSuggestion, fakeDiff);

    // An archive file should exist
    const files = fs.readdirSync(skillDir);
    const archiveFiles = files.filter(f => /SKILL-HISTORY-\d{4}-\d{2}/.test(f) && f !== 'SKILL-HISTORY.md');
    assert.ok(archiveFiles.length > 0, 'An archive file should exist in skill directory');

    // Live file should not contain 50 ## Entry headers
    const liveContent = fs.readFileSync(historyPath, 'utf-8');
    const entryCount = (liveContent.match(/^## Entry \d+/gm) || []).length;
    assert.ok(entryCount < 50, 'Live SKILL-HISTORY.md should not contain 50 ## Entry headers after rotation');
  } finally {
    cleanupTestProject(tmpDir);
  }
});

test('SKILL-HISTORY.md not created when commit fails', async () => {
  const invalidCwd = '/nonexistent/path/that/does/not/exist';
  const result = acceptSuggestion({ suggestionId: 'sug-test-001', cwd: invalidCwd });
  assert.strictEqual(result.ok, false, 'acceptSuggestion should return ok: false on error');

  // SKILL-HISTORY.md should not exist anywhere
  const historyPath = path.join(invalidCwd, '.claude', 'skills', 'test-skill', 'SKILL-HISTORY.md');
  assert.ok(!fs.existsSync(historyPath), 'SKILL-HISTORY.md should not exist when commit fails');
});
