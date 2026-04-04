'use strict';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { createTempProject, cleanup } = require('./helpers.cjs');

const GSD_TOOLS = path.join(__dirname, '..', 'get-shit-done', 'bin', 'gsd-tools.cjs');

// Helper: set up a temp project with a phase directory and a PLAN.md
// createTempProject creates milestone-scoped layout at .planning/milestones/v1.0/phases/
// So we create the phase in that location.
function setupPhaseProject(qualityLevel, planContent) {
  const tmpDir = createTempProject('v1.0');

  // Write config with quality level (root-level config.json)
  const configPath = path.join(tmpDir, '.planning', 'config.json');
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({ concurrent: true, quality: { level: qualityLevel } }), 'utf-8');

  // Create a phase directory inside the milestone-scoped location
  const phaseDir = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '99-test-phase');
  fs.mkdirSync(phaseDir, { recursive: true });
  fs.writeFileSync(path.join(phaseDir, '.gitkeep'), '', 'utf-8');

  // Write the PLAN.md
  fs.writeFileSync(path.join(phaseDir, '99-01-PLAN.md'), planContent, 'utf-8');

  // Write a SUMMARY.md (needed for phase-completeness to not fail on missing summaries)
  const summaryContent = `---\nphase: 99\nplan: 01\n---\n\n# Summary\n\n## Self-Check\nAll pass.\n\nCommit: abc1234\n`;
  fs.writeFileSync(path.join(phaseDir, '99-01-SUMMARY.md'), summaryContent, 'utf-8');

  return tmpDir;
}

// PLAN.md with a file-exists criterion pointing to a file that DOES exist
function planWithPassingGuard() {
  // We'll reference the config.json which we know exists
  return `---\nphase: 99\nplan: 01\ntype: implementation\nautonomous: true\nwave: 1\ndepends_on: []\nrequirements: []\nfiles_modified: []\n---\n\n# Test Plan\n\n## Tasks\n\n<task id="1"><title>Check file</title><action>Do something.</action><done>\n- File \`.planning/config.json\` exists\n</done></task>\n`;
}

// PLAN.md with a file-exists criterion pointing to a file that does NOT exist
const planWithFailingGuard = `---\nphase: 99\nplan: 01\ntype: implementation\nautonomous: true\nwave: 1\ndepends_on: []\nrequirements: []\nfiles_modified: []\n---\n\n# Test Plan\n\n## Tasks\n\n<task id="1"><title>Missing file check</title><action>Do something.</action><done>\n- File \`does-not-exist/ghost.cjs\` exists\n</done></task>\n`;

describe('transition guards — fast mode skips', () => {
  let tmpDir;

  before(() => {
    tmpDir = setupPhaseProject('fast', planWithFailingGuard);
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('guards.skipped is true in fast mode', () => {
    const { spawnSync } = require('child_process');
    const result = spawnSync(
      'node',
      [
        GSD_TOOLS,
        'verify', 'phase-completeness', '99',
      ],
      { cwd: tmpDir, encoding: 'utf-8', timeout: 30000 }
    );
    // Output is JSON when --raw is passed
    let parsed;
    try {
      parsed = JSON.parse(result.stdout.trim());
    } catch (e) {
      assert.ok(false, `Non-JSON output: ${result.stdout.slice(0, 200)} stderr: ${result.stderr.slice(0, 200)}`);
    }
    assert.ok(parsed.guards, 'guards key must be present in output');
    assert.strictEqual(parsed.guards.skipped, true, 'guards.skipped must be true in fast mode');
  });
});

describe('transition guards — standard mode warns', () => {
  let tmpDir;

  before(() => {
    tmpDir = setupPhaseProject('standard', planWithFailingGuard);
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('guards run and fail count reported but verification not blocked', () => {
    const { spawnSync } = require('child_process');
    const result = spawnSync(
      'node',
      [GSD_TOOLS, 'verify', 'phase-completeness', '99'],
      { cwd: tmpDir, encoding: 'utf-8', timeout: 30000 }
    );
    let parsed;
    try {
      parsed = JSON.parse(result.stdout.trim());
    } catch (e) {
      assert.ok(false, `Non-JSON output: ${result.stdout.slice(0, 200)} stderr: ${result.stderr.slice(0, 200)}`);
    }
    assert.ok(parsed.guards, 'guards key must be present');
    assert.strictEqual(parsed.guards.skipped, false);
    assert.ok(parsed.guards.fail >= 1, 'should have at least one failure');
    assert.strictEqual(parsed.guards.blocked, false, 'standard mode must not block');
  });
});

describe('transition guards — strict mode blocks on failure', () => {
  let tmpDir;

  before(() => {
    tmpDir = setupPhaseProject('strict', planWithFailingGuard);
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('guards.blocked is true and result.passed is false in strict mode with failures', () => {
    const { spawnSync } = require('child_process');
    const result = spawnSync(
      'node',
      [GSD_TOOLS, 'verify', 'phase-completeness', '99'],
      { cwd: tmpDir, encoding: 'utf-8', timeout: 30000 }
    );
    let parsed;
    try {
      parsed = JSON.parse(result.stdout.trim());
    } catch (e) {
      assert.ok(false, `Non-JSON output: ${result.stdout.slice(0, 200)} stderr: ${result.stderr.slice(0, 200)}`);
    }
    assert.ok(parsed.guards, 'guards key must be present');
    assert.strictEqual(parsed.guards.blocked, true);
    assert.strictEqual(parsed.passed, false, 'result.passed must be false when guards block');
  });
});

describe('transition guards — human-check surfacing', () => {
  let tmpDir;

  before(() => {
    const planWithHumanCheck = `---\nphase: 99\nplan: 01\ntype: implementation\nautonomous: true\nwave: 1\ndepends_on: []\nrequirements: []\nfiles_modified: []\n---\n\n# Test Plan\n\n## Tasks\n\n<task id="1"><title>Judgment check</title><action>Do something.</action><done>\n- The UI renders correctly at 1440px width\n</done></task>\n`;
    tmpDir = setupPhaseProject('standard', planWithHumanCheck);
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('human-check items appear in guards.humanChecks array', () => {
    const { spawnSync } = require('child_process');
    const result = spawnSync(
      'node',
      [GSD_TOOLS, 'verify', 'phase-completeness', '99'],
      { cwd: tmpDir, encoding: 'utf-8', timeout: 30000 }
    );
    let parsed;
    try {
      parsed = JSON.parse(result.stdout.trim());
    } catch (e) {
      assert.ok(false, `Non-JSON output: ${result.stdout.slice(0, 200)} stderr: ${result.stderr.slice(0, 200)}`);
    }
    assert.ok(parsed.guards, 'guards key must be present');
    assert.ok(parsed.guards.needsHuman >= 1, 'should have at least one needs-human item');
    assert.ok(Array.isArray(parsed.guards.humanChecks), 'humanChecks must be an array');
    assert.strictEqual(parsed.guards.blocked, false, 'human-checks alone do not block in standard mode');
  });
});
