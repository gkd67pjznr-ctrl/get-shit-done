/**
 * GSD Tools Tests - Dashboard (cmdMilestoneWriteStatus, cmdManifestCheck)
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createConcurrentProject, createTempProject, createLegacyProject, cleanup, runGsdToolsFull } = require('./helpers.cjs');

const MILESTONE_LIB = path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'milestone.cjs');

function runWriteStatus(cwd, version, options) {
  const script = `
    const m = require(${JSON.stringify(MILESTONE_LIB)});
    m.cmdMilestoneWriteStatus(${JSON.stringify(cwd)}, ${JSON.stringify(version)}, ${JSON.stringify(options)}, true);
  `;
  return spawnSync(process.execPath, ['-e', script], { encoding: 'utf-8' });
}

function runManifestCheck(cwd) {
  const script = `
    const m = require(${JSON.stringify(MILESTONE_LIB)});
    m.cmdManifestCheck(${JSON.stringify(cwd)}, true);
  `;
  return spawnSync(process.execPath, ['-e', script], { encoding: 'utf-8' });
}

describe('cmdMilestoneWriteStatus', () => {
  let tmpDir;

  before(() => {
    tmpDir = createConcurrentProject('v2.0');
  });

  after(() => {
    cleanup(tmpDir);
  });

  it('writes STATUS.md with all fields', () => {
    const result = runWriteStatus(tmpDir, 'v2.0', {
      phase: '3',
      plan: '2',
      checkpoint: 'plan-complete',
      progress: '2/5 plans (40%)',
      status: 'In Progress',
    });
    assert.strictEqual(result.status, 0, `expected exit 0, got ${result.status}\nstderr: ${result.stderr}`);
    const statusPath = path.join(tmpDir, '.planning', 'milestones', 'v2.0', 'STATUS.md');
    assert.ok(fs.existsSync(statusPath), 'STATUS.md should exist');
    const content = fs.readFileSync(statusPath, 'utf-8');
    assert.ok(content.includes('**Phase:** 3'), 'should contain Phase field');
    assert.ok(content.includes('**Plan:** 2'), 'should contain Plan field');
    assert.ok(content.includes('**Checkpoint:** plan-complete'), 'should contain Checkpoint field');
    assert.ok(content.includes('**Progress:** 2/5 plans (40%)'), 'should contain Progress field');
  });

  it('returns JSON with version and path', () => {
    const result = runWriteStatus(tmpDir, 'v2.0', {
      phase: '1',
      plan: '1',
      checkpoint: 'task-complete',
      progress: '1/3 plans (33%)',
      status: 'In Progress',
    });
    assert.strictEqual(result.status, 0, `expected exit 0\nstderr: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.strictEqual(parsed.version, 'v2.0', 'version should be v2.0');
    assert.strictEqual(parsed.written, true, 'written should be true');
  });

  it('overwrites STATUS.md on subsequent calls', () => {
    runWriteStatus(tmpDir, 'v2.0', {
      phase: '1',
      plan: '1',
      checkpoint: 'first-call',
      progress: '1/5 plans (20%)',
      status: 'In Progress',
    });
    runWriteStatus(tmpDir, 'v2.0', {
      phase: '5',
      plan: '3',
      checkpoint: 'second-call',
      progress: '4/5 plans (80%)',
      status: 'In Progress',
    });
    const statusPath = path.join(tmpDir, '.planning', 'milestones', 'v2.0', 'STATUS.md');
    const content = fs.readFileSync(statusPath, 'utf-8');
    assert.ok(content.includes('**Phase:** 5'), 'should have second call phase value');
    assert.ok(!content.includes('**Phase:** 1'), 'should not have first call phase value');
  });

  it('updates MILESTONES.md section for milestone version', () => {
    const milestonesPath = path.join(tmpDir, '.planning', 'MILESTONES.md');
    fs.writeFileSync(milestonesPath, '# Milestones\n\nPrevious content.\n', 'utf-8');
    runWriteStatus(tmpDir, 'v2.0', {
      phase: '3',
      plan: '2',
      checkpoint: 'plan-complete',
      progress: '2/5 plans (40%)',
      status: 'In Progress',
    });
    const content = fs.readFileSync(milestonesPath, 'utf-8');
    assert.ok(content.includes('## v2.0'), 'should contain v2.0 section header');
    assert.ok(content.includes('2/5 plans (40%)'), 'should contain progress info');
  });

  it('MILESTONES.md update is non-fatal if file missing', () => {
    const altDir = createConcurrentProject('v2.0');
    try {
      // Do NOT create MILESTONES.md
      const milestonesPath = path.join(altDir, '.planning', 'MILESTONES.md');
      if (fs.existsSync(milestonesPath)) {
        fs.unlinkSync(milestonesPath);
      }
      const result = runWriteStatus(altDir, 'v2.0', {
        phase: '1',
        plan: '1',
        checkpoint: 'no-milestones-file',
        progress: '1/1 plans (100%)',
        status: 'Done',
      });
      assert.strictEqual(result.status, 0, `should exit 0 even without MILESTONES.md\nstderr: ${result.stderr}`);
      const statusPath = path.join(altDir, '.planning', 'milestones', 'v2.0', 'STATUS.md');
      assert.ok(fs.existsSync(statusPath), 'STATUS.md should still be written');
    } finally {
      cleanup(altDir);
    }
  });
});

describe('cmdManifestCheck', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempProject();
    // Create milestones directory with two workspaces
    const v20Dir = path.join(tmpDir, '.planning', 'milestones', 'v2.0');
    const v30Dir = path.join(tmpDir, '.planning', 'milestones', 'v3.0');
    fs.mkdirSync(v20Dir, { recursive: true });
    fs.mkdirSync(v30Dir, { recursive: true });
  });

  after(() => {
    cleanup(tmpDir);
  });

  it('returns no conflicts when no overlapping files', () => {
    const v20Dir = path.join(tmpDir, '.planning', 'milestones', 'v2.0');
    const v30Dir = path.join(tmpDir, '.planning', 'milestones', 'v3.0');
    fs.writeFileSync(
      path.join(v20Dir, 'conflict.json'),
      JSON.stringify({ version: 'v2.0', status: 'active', files_touched: ['src/foo.js', 'src/bar.js'] }),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(v30Dir, 'conflict.json'),
      JSON.stringify({ version: 'v3.0', status: 'active', files_touched: ['src/baz.js', 'src/qux.js'] }),
      'utf-8'
    );
    const result = runManifestCheck(tmpDir);
    assert.strictEqual(result.status, 0, `expected exit 0\nstderr: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.strictEqual(parsed.has_conflicts, false, 'should have no conflicts');
    assert.strictEqual(parsed.conflicts.length, 0, 'conflicts array should be empty');
  });

  it('detects overlapping files between two milestones', () => {
    const v20Dir = path.join(tmpDir, '.planning', 'milestones', 'v2.0');
    const v30Dir = path.join(tmpDir, '.planning', 'milestones', 'v3.0');
    fs.writeFileSync(
      path.join(v20Dir, 'conflict.json'),
      JSON.stringify({ version: 'v2.0', status: 'active', files_touched: ['src/shared.js', 'src/only-v20.js'] }),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(v30Dir, 'conflict.json'),
      JSON.stringify({ version: 'v3.0', status: 'active', files_touched: ['src/shared.js', 'src/only-v30.js'] }),
      'utf-8'
    );
    const result = runManifestCheck(tmpDir);
    assert.strictEqual(result.status, 0, `expected exit 0\nstderr: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.strictEqual(parsed.has_conflicts, true, 'should detect conflict');
    assert.ok(parsed.conflicts.length > 0, 'conflicts array should have entries');
    assert.ok(
      parsed.conflicts[0].milestones.includes('v2.0') && parsed.conflicts[0].milestones.includes('v3.0'),
      'conflict should reference both milestones'
    );
    assert.ok(parsed.conflicts[0].files.includes('src/shared.js'), 'conflict should list overlapping file');
  });

  it('excludes completed milestones from overlap detection', () => {
    const v20Dir = path.join(tmpDir, '.planning', 'milestones', 'v2.0');
    const v30Dir = path.join(tmpDir, '.planning', 'milestones', 'v3.0');
    fs.writeFileSync(
      path.join(v20Dir, 'conflict.json'),
      JSON.stringify({ version: 'v2.0', status: 'active', files_touched: ['src/shared.js'] }),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(v30Dir, 'conflict.json'),
      JSON.stringify({ version: 'v3.0', status: 'complete', files_touched: ['src/shared.js'] }),
      'utf-8'
    );
    const result = runManifestCheck(tmpDir);
    assert.strictEqual(result.status, 0, `expected exit 0\nstderr: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.strictEqual(parsed.has_conflicts, false, 'completed milestones should be excluded from conflict detection');
  });

  it('returns empty when no milestones directory exists', () => {
    const emptyDir = createTempProject();
    try {
      const result = runManifestCheck(emptyDir);
      assert.strictEqual(result.status, 0, `expected exit 0\nstderr: ${result.stderr}`);
      const parsed = JSON.parse(result.stdout);
      assert.strictEqual(parsed.has_conflicts, false, 'no milestones means no conflicts');
      assert.strictEqual(parsed.manifests_checked, 0, 'should check 0 manifests');
    } finally {
      cleanup(emptyDir);
    }
  });

  it('always exits 0 even with conflicts (advisory only)', () => {
    const v20Dir = path.join(tmpDir, '.planning', 'milestones', 'v2.0');
    const v30Dir = path.join(tmpDir, '.planning', 'milestones', 'v3.0');
    fs.writeFileSync(
      path.join(v20Dir, 'conflict.json'),
      JSON.stringify({ version: 'v2.0', status: 'active', files_touched: ['src/conflicting.js'] }),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(v30Dir, 'conflict.json'),
      JSON.stringify({ version: 'v3.0', status: 'active', files_touched: ['src/conflicting.js'] }),
      'utf-8'
    );
    const result = runManifestCheck(tmpDir);
    assert.strictEqual(result.status, 0, 'must always exit 0 (advisory only, CNFL-04)');
  });
});

describe('CLI routing for milestone write-status', () => {
  let tmpDir;

  before(() => {
    tmpDir = createConcurrentProject('v2.0');
  });

  after(() => {
    cleanup(tmpDir);
  });

  it('routes write-status to cmdMilestoneWriteStatus', () => {
    const result = runGsdToolsFull(
      ['milestone', 'write-status', 'v2.0', '--phase', '3', '--plan', '1', '--checkpoint', 'plan-complete', '--progress', '1/3 plans (33%)', '--status', 'In Progress', '--raw'],
      tmpDir
    );
    assert.ok(result.success, `expected success\nstderr: ${result.stderr}\nstdout: ${result.output}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.written, true, 'written should be true');
  });

  it('routes manifest-check to cmdManifestCheck', () => {
    // Set up conflict.json so manifest-check has something to check
    const v20Dir = path.join(tmpDir, '.planning', 'milestones', 'v2.0');
    fs.writeFileSync(
      path.join(v20Dir, 'conflict.json'),
      JSON.stringify({ version: 'v2.0', status: 'active', files_touched: ['src/foo.js'] }),
      'utf-8'
    );
    const result = runGsdToolsFull(['milestone', 'manifest-check', '--raw'], tmpDir);
    assert.ok(result.success, `expected success\nstderr: ${result.stderr}\nstdout: ${result.output}`);
    const parsed = JSON.parse(result.output);
    assert.ok('has_conflicts' in parsed, 'has_conflicts field should exist');
  });
});

describe('cmdProgressRenderMulti', () => {
  let tmpDir;

  before(() => {
    tmpDir = createConcurrentProject('v2.0');
    // Write a STATUS.md in the v2.0 workspace
    const statusPath = path.join(tmpDir, '.planning', 'milestones', 'v2.0', 'STATUS.md');
    fs.writeFileSync(
      statusPath,
      '# v2.0 Status\n\n**Phase:** 3\n**Plan:** 1\n**Checkpoint:** plan-complete\n**Progress:** 1/3 plans (33%)\n**Status:** In Progress\n',
      'utf-8'
    );
  });

  after(() => {
    cleanup(tmpDir);
  });

  it('renders multi-milestone JSON for concurrent projects', () => {
    const result = runGsdToolsFull(['progress', 'json', '--raw'], tmpDir);
    assert.ok(result.success, `expected success\nstderr: ${result.stderr}\nstdout: ${result.output}`);
    const parsed = JSON.parse(result.output);
    assert.ok(Array.isArray(parsed.milestones), 'milestones should be an array');
    assert.ok(parsed.milestones.length >= 1, 'should have at least one milestone entry');
    assert.strictEqual(parsed.milestones[0].version, 'v2.0', 'milestone version should be v2.0');
  });

  it('returns empty milestones for projects without milestone dirs', () => {
    const legacyDir = createLegacyProject();
    try {
      // Add a phase directory with a PLAN.md so cmdProgressRender has something to scan
      const phaseDir = path.join(legacyDir, '.planning', 'phases', '01-foundation');
      fs.mkdirSync(phaseDir, { recursive: true });
      fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan\n', 'utf-8');
      const result = runGsdToolsFull(['progress', 'json', '--raw'], legacyDir);
      assert.ok(result.success, `expected success\nstderr: ${result.stderr}\nstdout: ${result.output}`);
      const parsed = JSON.parse(result.output);
      // cmdProgressRenderMulti always runs the multi-milestone path; no milestones dir = empty array
      assert.ok(Array.isArray(parsed.milestones), 'result should have milestones array');
      assert.strictEqual(parsed.milestones.length, 0, 'milestones should be empty when no milestones dir');
    } finally {
      cleanup(legacyDir);
    }
  });

  it('renders multi-milestone table format', () => {
    // Without --raw, output() emits JSON; with --raw and rawValue set, it emits raw text.
    // Use JSON mode (no --raw) to get the rendered field as JSON.
    const result = runGsdToolsFull(['progress', 'table'], tmpDir);
    assert.ok(result.success, `expected success\nstderr: ${result.stderr}\nstdout: ${result.output}`);
    const parsed = JSON.parse(result.output);
    assert.ok(parsed.rendered.includes('Multi-Milestone Progress'), 'rendered should contain Multi-Milestone Progress header');
  });

  it('returns empty milestones when no STATUS.md exists in workspace', () => {
    const freshDir = createConcurrentProject('v2.0');
    try {
      // createConcurrentProject creates STATE.md and ROADMAP.md but NOT STATUS.md
      const result = runGsdToolsFull(['progress', 'json', '--raw'], freshDir);
      assert.ok(result.success, `expected success\nstderr: ${result.stderr}\nstdout: ${result.output}`);
      const parsed = JSON.parse(result.output);
      assert.ok(Array.isArray(parsed.milestones), 'milestones should be an array');
      // Without STATUS.md, cmdProgressRenderMulti returns empty milestones array
      assert.strictEqual(parsed.milestones.length, 0, 'milestones array should be empty when no STATUS.md exists');
    } finally {
      cleanup(freshDir);
    }
  });

  it('returns empty milestones when milestones directory does not exist', () => {
    const noMilestonesDir = createTempProject();
    try {
      // Write config.json with concurrent: true but do NOT create milestones directory
      fs.writeFileSync(
        path.join(noMilestonesDir, '.planning', 'config.json'),
        JSON.stringify({ concurrent: true }),
        'utf-8'
      );
      const result = runGsdToolsFull(['progress', 'json', '--raw'], noMilestonesDir);
      assert.ok(result.success, `expected success\nstderr: ${result.stderr}\nstdout: ${result.output}`);
      const parsed = JSON.parse(result.output);
      assert.ok(Array.isArray(parsed.milestones), 'milestones should be an array');
      assert.strictEqual(parsed.milestones.length, 0, 'milestones array should be empty when milestones dir does not exist');
    } finally {
      cleanup(noMilestonesDir);
    }
  });
});
