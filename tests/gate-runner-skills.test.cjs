'use strict';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { createTempProject, cleanup } = require('./helpers.cjs');
const { evaluateGate } = require('../.claude/hooks/lib/gate-runner.cjs');

describe('gate-runner skills_active field', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempProject();
    // Write config.json with standard quality level so gate fires (fast mode skips)
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ quality: { level: 'standard' } }),
      'utf-8'
    );
    // Create fake skill directories
    const skillsDir = path.join(tmpDir, '.claude', 'skills');
    fs.mkdirSync(path.join(skillsDir, 'skill-a'), { recursive: true });
    fs.mkdirSync(path.join(skillsDir, 'skill-b'), { recursive: true });
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('entry has skills_active field that is an array', () => {
    const result = evaluateGate(
      'Bash',
      { command: 'node --test tests/' },
      'ok',
      { cwd: tmpDir, sessionId: 'test-session' }
    );
    assert.ok(result.evaluated, 'gate must fire for this hookInput');
    assert.ok(result.entry, 'result must have an entry object');
    assert.ok(Array.isArray(result.entry.skills_active), 'skills_active must be an array');
  });

  test('skills_active contains subdirectory names', () => {
    const result = evaluateGate(
      'Bash',
      { command: 'node --test tests/' },
      'ok',
      { cwd: tmpDir, sessionId: 'test-session' }
    );
    assert.ok(result.evaluated, 'gate must fire for this hookInput');
    assert.ok(result.entry, 'result must have an entry object');
    assert.ok(result.entry.skills_active.includes('skill-a'), 'must include skill-a');
    assert.ok(result.entry.skills_active.includes('skill-b'), 'must include skill-b');
  });

  test('skills_active is [] when .claude/skills does not exist', () => {
    const tmpNoSkills = createTempProject();
    try {
      // Write config.json with standard quality level so gate fires
      fs.writeFileSync(
        path.join(tmpNoSkills, '.planning', 'config.json'),
        JSON.stringify({ quality: { level: 'standard' } }),
        'utf-8'
      );
      const result = evaluateGate(
        'Bash',
        { command: 'node --test tests/' },
        'ok',
        { cwd: tmpNoSkills, sessionId: 'test-session' }
      );
      assert.ok(result.evaluated, 'gate must fire for this hookInput');
      assert.ok(result.entry, 'result must have an entry object');
      assert.deepStrictEqual(result.entry.skills_active, []);
    } finally {
      cleanup(tmpNoSkills);
    }
  });
});
