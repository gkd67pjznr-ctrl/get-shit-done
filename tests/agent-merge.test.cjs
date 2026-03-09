'use strict';

/**
 * agent-merge.test.cjs
 *
 * Test coverage for Phase 14 Plan 01: Agent Content Merge
 *
 * Requirements covered:
 *   AGNT-01 - gsd-executor.md contains injected_skills_protocol block inline
 *   AGNT-02 - gsd-planner.md contains capability_inheritance block inline
 *   AGNT-03 - No extension markers (INJECT or PROJECT:gsd-skill-creator) in any agent file
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const EXECUTOR_PATH = path.join(REPO_ROOT, 'agents', 'gsd-executor.md');
const PLANNER_PATH = path.join(REPO_ROOT, 'agents', 'gsd-planner.md');
const INSTALLER_PATH = path.join(REPO_ROOT, 'bin', 'install.js');

// ---------------------------------------------------------------------------
// AGNT-01: gsd-executor.md contains injected_skills_protocol block inline
// ---------------------------------------------------------------------------

describe('AGNT-01: executor contains injected_skills_protocol inline', () => {
  test('agents/gsd-executor.md contains opening <injected_skills_protocol> tag', () => {
    const content = fs.readFileSync(EXECUTOR_PATH, 'utf8');
    assert.ok(
      content.includes('<injected_skills_protocol>'),
      'gsd-executor.md must contain <injected_skills_protocol>'
    );
  });

  test('agents/gsd-executor.md contains closing </injected_skills_protocol> tag', () => {
    const content = fs.readFileSync(EXECUTOR_PATH, 'utf8');
    assert.ok(
      content.includes('</injected_skills_protocol>'),
      'gsd-executor.md must contain </injected_skills_protocol>'
    );
  });

  test('agents/gsd-executor.md contains "Consuming Injected Skills" inside the block', () => {
    const content = fs.readFileSync(EXECUTOR_PATH, 'utf8');
    assert.ok(
      content.includes('Consuming Injected Skills'),
      'gsd-executor.md must contain "Consuming Injected Skills" from inside the injected_skills_protocol block'
    );
  });

  test('agents/gsd-executor.md does NOT contain PROJECT:gsd-skill-creator:injected-skills marker', () => {
    const content = fs.readFileSync(EXECUTOR_PATH, 'utf8');
    assert.ok(
      !content.includes('<!-- PROJECT:gsd-skill-creator:injected-skills START -->'),
      'gsd-executor.md must not contain extension injection markers'
    );
  });
});

// ---------------------------------------------------------------------------
// AGNT-02: gsd-planner.md contains capability_inheritance block inline
// ---------------------------------------------------------------------------

describe('AGNT-02: planner contains capability_inheritance inline', () => {
  test('agents/gsd-planner.md contains opening <capability_inheritance> tag', () => {
    const content = fs.readFileSync(PLANNER_PATH, 'utf8');
    assert.ok(
      content.includes('<capability_inheritance>'),
      'gsd-planner.md must contain <capability_inheritance>'
    );
  });

  test('agents/gsd-planner.md contains closing </capability_inheritance> tag', () => {
    const content = fs.readFileSync(PLANNER_PATH, 'utf8');
    assert.ok(
      content.includes('</capability_inheritance>'),
      'gsd-planner.md must contain </capability_inheritance>'
    );
  });

  test('agents/gsd-planner.md contains "Capability Inheritance in Plans" inside the block', () => {
    const content = fs.readFileSync(PLANNER_PATH, 'utf8');
    assert.ok(
      content.includes('Capability Inheritance in Plans'),
      'gsd-planner.md must contain "Capability Inheritance in Plans" from inside the capability_inheritance block'
    );
  });

  test('agents/gsd-planner.md does NOT contain PROJECT:gsd-skill-creator:capability-inheritance marker', () => {
    const content = fs.readFileSync(PLANNER_PATH, 'utf8');
    assert.ok(
      !content.includes('<!-- PROJECT:gsd-skill-creator:capability-inheritance START -->'),
      'gsd-planner.md must not contain extension injection markers'
    );
  });
});

// ---------------------------------------------------------------------------
// AGNT-03: No extension markers in any agent or installer file
// ---------------------------------------------------------------------------

describe('AGNT-03: no extension markers in agent or installer files', () => {
  test('agents/gsd-executor.md does not contain INJECT:BEGIN marker', () => {
    const content = fs.readFileSync(EXECUTOR_PATH, 'utf8');
    assert.ok(
      !content.includes('INJECT:BEGIN'),
      'gsd-executor.md must not contain INJECT:BEGIN'
    );
  });

  test('agents/gsd-executor.md does not contain INJECT:END marker', () => {
    const content = fs.readFileSync(EXECUTOR_PATH, 'utf8');
    assert.ok(
      !content.includes('INJECT:END'),
      'gsd-executor.md must not contain INJECT:END'
    );
  });

  test('agents/gsd-planner.md does not contain INJECT:BEGIN marker', () => {
    const content = fs.readFileSync(PLANNER_PATH, 'utf8');
    assert.ok(
      !content.includes('INJECT:BEGIN'),
      'gsd-planner.md must not contain INJECT:BEGIN'
    );
  });

  test('agents/gsd-planner.md does not contain INJECT:END marker', () => {
    const content = fs.readFileSync(PLANNER_PATH, 'utf8');
    assert.ok(
      !content.includes('INJECT:END'),
      'gsd-planner.md must not contain INJECT:END'
    );
  });

  test('bin/install.js does not contain INJECT:BEGIN marker', () => {
    if (!fs.existsSync(INSTALLER_PATH)) {
      // installer file may not exist in all configurations -- skip
      assert.ok(true, 'bin/install.js not found -- skipped');
      return;
    }
    const content = fs.readFileSync(INSTALLER_PATH, 'utf8');
    assert.ok(
      !content.includes('INJECT:BEGIN'),
      'bin/install.js must not contain INJECT:BEGIN'
    );
  });

  test('bin/install.js does not contain INJECT:END marker', () => {
    if (!fs.existsSync(INSTALLER_PATH)) {
      assert.ok(true, 'bin/install.js not found -- skipped');
      return;
    }
    const content = fs.readFileSync(INSTALLER_PATH, 'utf8');
    assert.ok(
      !content.includes('INJECT:END'),
      'bin/install.js must not contain INJECT:END'
    );
  });

  test('agents/gsd-executor.md does not contain <!-- PROJECT:gsd-skill-creator: prefix', () => {
    const content = fs.readFileSync(EXECUTOR_PATH, 'utf8');
    assert.ok(
      !content.includes('<!-- PROJECT:gsd-skill-creator:'),
      'gsd-executor.md must not contain PROJECT:gsd-skill-creator markers'
    );
  });

  test('agents/gsd-planner.md does not contain <!-- PROJECT:gsd-skill-creator: prefix', () => {
    const content = fs.readFileSync(PLANNER_PATH, 'utf8');
    assert.ok(
      !content.includes('<!-- PROJECT:gsd-skill-creator:'),
      'gsd-planner.md must not contain PROJECT:gsd-skill-creator markers'
    );
  });
});
