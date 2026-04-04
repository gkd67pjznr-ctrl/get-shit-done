'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ─── Local Helpers ─────────────────────────────────────────────────────────────

function writeSkillFile(tmpDir, skillName, description) {
  const skillDir = path.join(tmpDir, '.claude', 'skills', skillName);
  fs.mkdirSync(skillDir, { recursive: true });
  // Use block scalar format (same as all 17 live SKILL.md files)
  const content = `---\nname: ${skillName}\ndescription: >\n  ${description}\n---\n# ${skillName}\n`;
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf-8');
}

function writePatternsFile(tmpDir, filename, lines) {
  const dir = path.join(tmpDir, '.planning', 'patterns');
  fs.mkdirSync(dir, { recursive: true });
  const content = lines.map(l => JSON.stringify(l)).join('\n') + '\n';
  fs.writeFileSync(path.join(dir, filename), content, 'utf-8');
}

// ─── SREL-01: Jaccard scoring ──────────────────────────────────────────────────

test('SREL-01: higher overlap skill ranks above lower overlap skill', async (t) => {
  let tmpDir;
  try {
    tmpDir = createTempProject();
    writeSkillFile(tmpDir, 'workflow-skill', 'manage workflow phases planning execution verification');
    writeSkillFile(tmpDir, 'unrelated-skill', 'culinary arts baking recipes ingredients temperature');
    const result = runGsdTools(['skill-score', '--task', 'planning workflow execution', '--raw'], tmpDir);
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.ok(Array.isArray(output), 'Output should be an array');
    assert.strictEqual(output[0].skill, 'workflow-skill', `Expected workflow-skill first, got ${output[0].skill}`);
    assert.strictEqual(output[1].skill, 'unrelated-skill');
    assert.ok(output[0].score > output[1].score, `Expected ${output[0].score} > ${output[1].score}`);
  } finally {
    if (tmpDir) cleanup(tmpDir);
  }
});

test('SREL-01: skill with zero overlap returns score 0 (or near-0)', async (t) => {
  let tmpDir;
  try {
    tmpDir = createTempProject();
    writeSkillFile(tmpDir, 'zero-skill', 'completely unrelated content zyxwvutsrq');
    const result = runGsdTools(['skill-score', '--task', 'planning workflow', '--raw'], tmpDir);
    assert.strictEqual(result.success, true);
    const output = JSON.parse(result.output);
    assert.ok(Array.isArray(output));
    assert.ok(output[0].score >= 0 && output[0].score <= 1);
  } finally {
    if (tmpDir) cleanup(tmpDir);
  }
});

test('SREL-01: --raw output is valid JSON array with skill and score fields', async (t) => {
  let tmpDir;
  try {
    tmpDir = createTempProject();
    writeSkillFile(tmpDir, 'test-skill', 'test automation quality verification workflow');
    const result = runGsdTools(['skill-score', '--task', 'test workflow', '--raw'], tmpDir);
    assert.strictEqual(result.success, true);
    const output = JSON.parse(result.output); // must not throw
    assert.ok(Array.isArray(output));
    assert.ok(output.every(e => typeof e.skill === 'string' && typeof e.score === 'number'));
  } finally {
    if (tmpDir) cleanup(tmpDir);
  }
});

test('SREL-01: task description missing causes error exit', async (t) => {
  let tmpDir;
  try {
    tmpDir = createTempProject();
    const result = runGsdTools(['skill-score'], tmpDir);
    const isError = result.success === false || result.output.includes('Usage');
    assert.ok(isError, `Expected failure or Usage message, got: ${JSON.stringify(result)}`);
  } finally {
    if (tmpDir) cleanup(tmpDir);
  }
});

test('SREL-01: empty skills directory returns empty array', async (t) => {
  let tmpDir;
  try {
    tmpDir = createTempProject();
    fs.mkdirSync(path.join(tmpDir, '.claude', 'skills'), { recursive: true });
    const result = runGsdTools(['skill-score', '--task', 'workflow planning', '--raw'], tmpDir);
    assert.strictEqual(result.success, true);
    const output = JSON.parse(result.output);
    assert.ok(Array.isArray(output));
    assert.strictEqual(output.length, 0);
  } finally {
    if (tmpDir) cleanup(tmpDir);
  }
});

test('SREL-01: scores are 3-decimal precision floats', async (t) => {
  let tmpDir;
  try {
    tmpDir = createTempProject();
    writeSkillFile(tmpDir, 'precision-skill', 'workflow planning execution phase');
    const result = runGsdTools(['skill-score', '--task', 'workflow planning', '--raw'], tmpDir);
    assert.strictEqual(result.success, true);
    const output = JSON.parse(result.output);
    const score = output[0].score;
    assert.strictEqual(Math.round(score * 1000) / 1000, score, `Score ${score} is not 3-decimal precision`);
  } finally {
    if (tmpDir) cleanup(tmpDir);
  }
});

// ─── SREL-02: cold-start floor ────────────────────────────────────────────────

test('SREL-02: skill with recent mtime gets cold-start floor when raw score below 0.3', async (t) => {
  let tmpDir;
  try {
    tmpDir = createTempProject();
    writeSkillFile(tmpDir, 'new-skill', 'completely unrelated zyxwvutsrq noqueryoverlap');
    const skillMdPath = path.join(tmpDir, '.claude', 'skills', 'new-skill', 'SKILL.md');
    const now = new Date();
    fs.utimesSync(skillMdPath, now, now);
    const result = runGsdTools(['skill-score', '--task', 'workflow planning', '--raw'], tmpDir);
    assert.strictEqual(result.success, true);
    const output = JSON.parse(result.output);
    const entry = output.find(e => e.skill === 'new-skill');
    assert.ok(entry, 'new-skill should be in output');
    assert.ok(entry.score >= 0.3, `Expected score >= 0.3 (cold-start floor), got ${entry.score}`);
  } finally {
    if (tmpDir) cleanup(tmpDir);
  }
});

test('SREL-02: old skill with zero overlap does NOT receive cold-start floor', async (t) => {
  let tmpDir;
  try {
    tmpDir = createTempProject();
    writeSkillFile(tmpDir, 'old-skill', 'completely unrelated zyxwvutsrq noqueryoverlap');
    const skillMdPath = path.join(tmpDir, '.claude', 'skills', 'old-skill', 'SKILL.md');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    fs.utimesSync(skillMdPath, thirtyDaysAgo, thirtyDaysAgo);
    const result = runGsdTools(['skill-score', '--task', 'workflow planning', '--raw'], tmpDir);
    assert.strictEqual(result.success, true);
    const output = JSON.parse(result.output);
    const entry = output.find(e => e.skill === 'old-skill');
    assert.ok(entry, 'old-skill should be in output');
    assert.ok(entry.score < 0.3, `Expected score < 0.3 (floor not applied), got ${entry.score}`);
  } finally {
    if (tmpDir) cleanup(tmpDir);
  }
});

// ─── SREL-03: dormancy decay ──────────────────────────────────────────────────

test('SREL-03: skill loaded recently has no decay vs skill dormant 2 weeks', async (t) => {
  let tmpDir;
  try {
    tmpDir = createTempProject();
    writeSkillFile(tmpDir, 'active-skill', 'workflow planning execution phase management');
    writeSkillFile(tmpDir, 'dormant-skill', 'workflow planning execution phase management');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    fs.utimesSync(path.join(tmpDir, '.claude', 'skills', 'active-skill', 'SKILL.md'), thirtyDaysAgo, thirtyDaysAgo);
    fs.utimesSync(path.join(tmpDir, '.claude', 'skills', 'dormant-skill', 'SKILL.md'), thirtyDaysAgo, thirtyDaysAgo);
    // active-skill: loaded 1 day ago (low dormancy weeks, low decay)
    // dormant-skill: loaded 21 days ago (3 weeks dormant, higher decay)
    writePatternsFile(tmpDir, 'sessions.jsonl', [
      {
        type: 'wrapper_execution',
        phase: '42',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        skills_loaded: ['active-skill'],
      },
      {
        type: 'wrapper_execution',
        phase: '40',
        timestamp: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
        skills_loaded: ['dormant-skill'],
      },
    ]);
    const result = runGsdTools(['skill-score', '--task', 'workflow planning execution', '--raw'], tmpDir);
    assert.strictEqual(result.success, true);
    const output = JSON.parse(result.output);
    const activeEntry = output.find(e => e.skill === 'active-skill');
    const dormantEntry = output.find(e => e.skill === 'dormant-skill');
    assert.ok(activeEntry, 'active-skill should be in output');
    assert.ok(dormantEntry, 'dormant-skill should be in output');
    assert.ok(activeEntry.score >= dormantEntry.score,
      `Expected active (${activeEntry.score}) >= dormant (${dormantEntry.score})`);
  } finally {
    if (tmpDir) cleanup(tmpDir);
  }
});

test('SREL-03: skill with no session history gets dormancy_weeks = 0 (no decay)', async (t) => {
  let tmpDir;
  try {
    tmpDir = createTempProject();
    writeSkillFile(tmpDir, 'no-history-skill', 'workflow planning execution management');
    const skillMdPath = path.join(tmpDir, '.claude', 'skills', 'no-history-skill', 'SKILL.md');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    fs.utimesSync(skillMdPath, thirtyDaysAgo, thirtyDaysAgo);
    // No sessions.jsonl written
    const result = runGsdTools(['skill-score', '--task', 'workflow planning', '--raw'], tmpDir);
    assert.strictEqual(result.success, true);
    const output = JSON.parse(result.output);
    const entry = output.find(e => e.skill === 'no-history-skill');
    assert.ok(entry, 'no-history-skill should be in output');
    assert.ok(entry.score > 0, `Expected score > 0 (no decay penalty), got ${entry.score}`);
  } finally {
    if (tmpDir) cleanup(tmpDir);
  }
});

// ─── SREL-04: cache invalidation ──────────────────────────────────────────────

test('SREL-04: cache entry is invalidated when SKILL.md content changes', async (t) => {
  let tmpDir;
  try {
    tmpDir = createTempProject();
    writeSkillFile(tmpDir, 'cache-skill', 'workflow testing quality verification');
    const skillMdPath = path.join(tmpDir, '.claude', 'skills', 'cache-skill', 'SKILL.md');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    fs.utimesSync(skillMdPath, thirtyDaysAgo, thirtyDaysAgo);

    const result1 = runGsdTools(['skill-score', '--task', 'workflow testing', '--raw'], tmpDir);
    assert.strictEqual(result1.success, true);
    const scores1 = JSON.parse(result1.output);
    const score1 = scores1.find(e => e.skill === 'cache-skill').score;

    const newContent = '---\nname: cache-skill\ndescription: >\n  culinary arts baking completely unrelated zyxwvutsrq\n---\n# cache-skill\n';
    fs.writeFileSync(skillMdPath, newContent, 'utf-8');

    const result2 = runGsdTools(['skill-score', '--task', 'workflow testing', '--raw'], tmpDir);
    assert.strictEqual(result2.success, true);
    const scores2 = JSON.parse(result2.output);
    const score2 = scores2.find(e => e.skill === 'cache-skill').score;

    assert.notStrictEqual(score1, score2, `Expected scores to differ after content change: ${score1} vs ${score2}`);
  } finally {
    if (tmpDir) cleanup(tmpDir);
  }
});

test('SREL-04: changing task description invalidates all cached scores', async (t) => {
  let tmpDir;
  try {
    tmpDir = createTempProject();
    writeSkillFile(tmpDir, 'task-cache-skill', 'workflow planning execution phase');
    const skillMdPath = path.join(tmpDir, '.claude', 'skills', 'task-cache-skill', 'SKILL.md');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    fs.utimesSync(skillMdPath, thirtyDaysAgo, thirtyDaysAgo);

    const r1 = runGsdTools(['skill-score', '--task', 'workflow planning', '--raw'], tmpDir);
    assert.strictEqual(r1.success, true);
    const score_a = JSON.parse(r1.output).find(e => e.skill === 'task-cache-skill').score;

    const r2 = runGsdTools(['skill-score', '--task', 'culinary baking recipes', '--raw'], tmpDir);
    assert.strictEqual(r2.success, true);
    const score_b = JSON.parse(r2.output).find(e => e.skill === 'task-cache-skill').score;

    assert.notStrictEqual(score_a, score_b, `Expected scores to differ with different tasks: ${score_a} vs ${score_b}`);
  } finally {
    if (tmpDir) cleanup(tmpDir);
  }
});

test('SREL-04: unchanged SKILL.md content returns consistent score from cache', async (t) => {
  let tmpDir;
  try {
    tmpDir = createTempProject();
    writeSkillFile(tmpDir, 'stable-skill', 'workflow planning execution phase management');
    const skillMdPath = path.join(tmpDir, '.claude', 'skills', 'stable-skill', 'SKILL.md');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    fs.utimesSync(skillMdPath, thirtyDaysAgo, thirtyDaysAgo);

    const r1 = runGsdTools(['skill-score', '--task', 'workflow planning execution', '--raw'], tmpDir);
    const r2 = runGsdTools(['skill-score', '--task', 'workflow planning execution', '--raw'], tmpDir);
    assert.strictEqual(r1.success, true);
    assert.strictEqual(r2.success, true);
    const score1 = JSON.parse(r1.output).find(e => e.skill === 'stable-skill').score;
    const score2 = JSON.parse(r2.output).find(e => e.skill === 'stable-skill').score;
    assert.strictEqual(score1, score2, `Expected same score on cache hit: ${score1} vs ${score2}`);
  } finally {
    if (tmpDir) cleanup(tmpDir);
  }
});

test('SREL-04: skill-scores.json is written to .planning/patterns/ after scoring', async (t) => {
  let tmpDir;
  try {
    tmpDir = createTempProject();
    writeSkillFile(tmpDir, 'cache-write-skill', 'workflow planning phase');
    const result = runGsdTools(['skill-score', '--task', 'planning', '--raw'], tmpDir);
    assert.strictEqual(result.success, true);
    const cacheFile = path.join(tmpDir, '.planning', 'patterns', 'skill-scores.json');
    assert.ok(fs.existsSync(cacheFile), 'skill-scores.json should exist');
    const parsed = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    assert.ok(parsed.metadata, 'Cache should have metadata');
    assert.ok(parsed.skills, 'Cache should have skills');
  } finally {
    if (tmpDir) cleanup(tmpDir);
  }
});

module.exports = {};
