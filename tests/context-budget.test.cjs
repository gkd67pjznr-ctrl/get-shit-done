'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('node:child_process');
const { createTempProject, cleanup } = require('./helpers.cjs');

const {
  measureSkillTokenCost,
  measureAllSkillTokenCosts,
  aggregateSkillBudget,
} = require('../get-shit-done/bin/lib/context-budget.cjs');

const TOOLS_PATH = path.join(__dirname, '..', 'get-shit-done', 'bin', 'gsd-tools.cjs');

// ─── Unit Tests ───────────────────────────────────────────────────────────────

test('measureSkillTokenCost — known skill returns correct shape', () => {
  const result = measureSkillTokenCost('gsd-workflow', process.cwd());
  assert.strictEqual(result.skill, 'gsd-workflow', 'skill name should match');
  assert.ok(typeof result.char_count === 'number' && result.char_count >= 0,
    'char_count should be a non-negative number');
  assert.ok(typeof result.token_estimate === 'number' && result.token_estimate >= 0,
    'token_estimate should be a non-negative number');
  assert.strictEqual(result.token_estimate, Math.ceil(result.char_count / 4),
    'token_estimate should equal Math.ceil(char_count / 4)');
});

test('measureSkillTokenCost — missing skill dir returns zeros without throwing', () => {
  const result = measureSkillTokenCost('nonexistent-skill-xyz', process.cwd());
  assert.strictEqual(result.char_count, 0, 'char_count should be 0 for missing skill');
  assert.strictEqual(result.token_estimate, 0, 'token_estimate should be 0 for missing skill');
});

test('measureAllSkillTokenCosts — returns object with skill names as keys', () => {
  const result = measureAllSkillTokenCosts(process.cwd());
  assert.ok(result !== null && typeof result === 'object' && !Array.isArray(result),
    'result should be a plain object');
  // If .claude/skills/ exists and has subdirs, at least one key should exist
  const skillsDir = path.join(process.cwd(), '.claude', 'skills');
  if (fs.existsSync(skillsDir)) {
    const subdirs = fs.readdirSync(skillsDir).filter(e => {
      try { return fs.statSync(path.join(skillsDir, e)).isDirectory(); } catch { return false; }
    });
    if (subdirs.length > 0) {
      assert.ok(Object.keys(result).length > 0, 'should have at least one key when skills dir has subdirs');
    }
  }
  // All values must be numbers
  for (const [key, val] of Object.entries(result)) {
    assert.ok(typeof val === 'number', `value for ${key} should be a number, got ${typeof val}`);
  }
});

test('aggregateSkillBudget — correct avg_cost and load_count', () => {
  const sessions = [
    { skill_token_cost: { a: 100, b: 200 } },
    { skill_token_cost: { a: 300 } },
  ];
  const result = aggregateSkillBudget(sessions, {});
  const skillA = result.find(r => r.skill === 'a');
  const skillB = result.find(r => r.skill === 'b');

  assert.ok(skillA, 'skill a should be in result');
  assert.strictEqual(skillA.load_count, 2, 'skill a load_count should be 2');
  assert.strictEqual(skillA.avg_cost, 200, 'skill a avg_cost should be 200');

  assert.ok(skillB, 'skill b should be in result');
  assert.strictEqual(skillB.load_count, 1, 'skill b load_count should be 1');
  assert.strictEqual(skillB.avg_cost, 200, 'skill b avg_cost should be 200');
});

test('aggregateSkillBudget — cost_per_fire uses 0.001 sentinel when final_score is 0', () => {
  const sessions = [{ skill_token_cost: { x: 500 } }];
  const skillScores = { x: { final_score: 0 } };
  const result = aggregateSkillBudget(sessions, skillScores);
  const skillX = result.find(r => r.skill === 'x');

  assert.ok(skillX, 'skill x should be in result');
  const expected = Math.round((500 / 0.001) * 100) / 100;
  assert.strictEqual(skillX.cost_per_fire, expected,
    `cost_per_fire should use 0.001 sentinel, expected ${expected} got ${skillX.cost_per_fire}`);
});

test('aggregateSkillBudget — cost_per_fire uses actual final_score when > 0', () => {
  const sessions = [{ skill_token_cost: { y: 200 } }];
  const skillScores = { y: { final_score: 0.5 } };
  const result = aggregateSkillBudget(sessions, skillScores);
  const skillY = result.find(r => r.skill === 'y');

  assert.ok(skillY, 'skill y should be in result');
  const expected = Math.round((200 / 0.5) * 100) / 100; // = 400
  assert.strictEqual(skillY.cost_per_fire, expected,
    `cost_per_fire should be ${expected}, got ${skillY.cost_per_fire}`);
});

test('aggregateSkillBudget — empty sessions returns empty array', () => {
  const result = aggregateSkillBudget([], {});
  assert.ok(Array.isArray(result), 'result should be an array');
  assert.strictEqual(result.length, 0, 'result should be empty for empty sessions');
});

// ─── CLI Round-Trip Tests ─────────────────────────────────────────────────────

test('CLI round-trip: skill-budget measure --raw returns correct shape', () => {
  const stdout = execFileSync(process.execPath, [
    TOOLS_PATH, 'skill-budget', 'measure', '--skill', 'gsd-workflow', '--raw',
  ], {
    cwd: process.cwd(),
    encoding: 'utf-8',
  }).trim();

  const result = JSON.parse(stdout);
  assert.strictEqual(result.skill, 'gsd-workflow', 'skill field should be gsd-workflow');
  assert.ok(typeof result.token_estimate === 'number',
    `token_estimate should be a number, got ${typeof result.token_estimate}`);
  assert.ok(typeof result.char_count === 'number',
    `char_count should be a number, got ${typeof result.char_count}`);
});
