/**
 * GSD Tools Tests - Milestone
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

const MILESTONE_LIB = path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'milestone.cjs');

// Run cmdMilestoneNewWorkspace in a child process (output() calls process.exit)
function runNewWorkspace(cwd, version) {
  const script = `
    const m = require(${JSON.stringify(MILESTONE_LIB)});
    m.cmdMilestoneNewWorkspace(${JSON.stringify(cwd)}, ${JSON.stringify(version)}, {}, true);
  `;
  return spawnSync(process.execPath, ['-e', script], { encoding: 'utf-8' });
}

// Run cmdMilestoneUpdateManifest in a child process
function runUpdateManifest(cwd, version, files) {
  const script = `
    const m = require(${JSON.stringify(MILESTONE_LIB)});
    m.cmdMilestoneUpdateManifest(${JSON.stringify(cwd)}, ${JSON.stringify(version)}, ${JSON.stringify(files)}, true);
  `;
  return spawnSync(process.execPath, ['-e', script], { encoding: 'utf-8' });
}

describe('milestone complete command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('archives roadmap, requirements, creates MILESTONES.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0 MVP\n\n### Phase 1: Foundation\n**Goal:** Setup\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements\n\n- [ ] User auth\n- [ ] Dashboard\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(
      path.join(p1, '01-01-SUMMARY.md'),
      `---\none-liner: Set up project infrastructure\n---\n# Summary\n`
    );

    const result = runGsdTools('milestone complete v1.0 --name MVP Foundation', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.version, 'v1.0');
    assert.strictEqual(output.phases, 1);
    assert.ok(output.archived.roadmap, 'roadmap should be archived');
    assert.ok(output.archived.requirements, 'requirements should be archived');

    // Verify archive files exist
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'milestones', 'v1.0-ROADMAP.md')),
      'archived roadmap should exist'
    );
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'milestones', 'v1.0-REQUIREMENTS.md')),
      'archived requirements should exist'
    );

    // Verify MILESTONES.md created
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'MILESTONES.md')),
      'MILESTONES.md should be created'
    );
    const milestones = fs.readFileSync(path.join(tmpDir, '.planning', 'MILESTONES.md'), 'utf-8');
    assert.ok(milestones.includes('v1.0 MVP Foundation'), 'milestone entry should contain name');
    assert.ok(milestones.includes('Set up project infrastructure'), 'accomplishments should be listed');
  });

  test('appends to existing MILESTONES.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'MILESTONES.md'),
      `# Milestones\n\n## v0.9 Alpha (Shipped: 2025-01-01)\n\n---\n\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const result = runGsdTools('milestone complete v1.0 --name Beta', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const milestones = fs.readFileSync(path.join(tmpDir, '.planning', 'MILESTONES.md'), 'utf-8');
    assert.ok(milestones.includes('v0.9 Alpha'), 'existing entry should be preserved');
    assert.ok(milestones.includes('v1.0 Beta'), 'new entry should be appended');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// milestone new-workspace command
// ─────────────────────────────────────────────────────────────────────────────

describe('milestone new-workspace (cmdMilestoneNewWorkspace)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('creates workspace directory tree with scaffold files', () => {
    const result = runNewWorkspace(tmpDir, 'v2.0');
    assert.strictEqual(result.status, 0, `Should exit 0, got: ${result.stderr}`);

    const workspaceDir = path.join(tmpDir, '.planning', 'milestones', 'v2.0');
    assert.ok(fs.existsSync(workspaceDir), 'workspace dir should exist');
    assert.ok(fs.existsSync(path.join(workspaceDir, 'phases')), 'phases/ subdir should exist');
    assert.ok(fs.existsSync(path.join(workspaceDir, 'research')), 'research/ subdir should exist');
    assert.ok(fs.existsSync(path.join(workspaceDir, 'STATE.md')), 'STATE.md should exist');
    assert.ok(fs.existsSync(path.join(workspaceDir, 'ROADMAP.md')), 'ROADMAP.md should exist');
    assert.ok(fs.existsSync(path.join(workspaceDir, 'REQUIREMENTS.md')), 'REQUIREMENTS.md should exist');
    assert.ok(fs.existsSync(path.join(workspaceDir, 'conflict.json')), 'conflict.json should exist');
  });

  test('scaffold files contain version and status', () => {
    const result = runNewWorkspace(tmpDir, 'v2.0');
    assert.strictEqual(result.status, 0, `Should exit 0, got: ${result.stderr}`);

    const workspaceDir = path.join(tmpDir, '.planning', 'milestones', 'v2.0');
    const stateContent = fs.readFileSync(path.join(workspaceDir, 'STATE.md'), 'utf-8');
    assert.ok(stateContent.includes('v2.0'), 'STATE.md should contain version');
    assert.ok(stateContent.includes('Initializing'), 'STATE.md should have Initializing status');
  });

  test('conflict.json has correct schema', () => {
    const result = runNewWorkspace(tmpDir, 'v2.0');
    assert.strictEqual(result.status, 0, `Should exit 0, got: ${result.stderr}`);

    const workspaceDir = path.join(tmpDir, '.planning', 'milestones', 'v2.0');
    const conflict = JSON.parse(fs.readFileSync(path.join(workspaceDir, 'conflict.json'), 'utf-8'));
    assert.strictEqual(conflict.version, 'v2.0');
    assert.strictEqual(conflict.status, 'active');
    assert.ok(Array.isArray(conflict.files_touched), 'files_touched should be array');
    assert.strictEqual(conflict.files_touched.length, 0, 'files_touched should be empty');
    assert.ok(conflict.created_at, 'created_at should be present');
  });

  test('is idempotent — second run does not overwrite existing files', () => {
    runNewWorkspace(tmpDir, 'v2.0');

    // Modify STATE.md after first run
    const workspaceDir = path.join(tmpDir, '.planning', 'milestones', 'v2.0');
    const statePath = path.join(workspaceDir, 'STATE.md');
    fs.writeFileSync(statePath, '# Custom State Content', 'utf-8');

    // Second run should not overwrite
    runNewWorkspace(tmpDir, 'v2.0');
    const stateContent = fs.readFileSync(statePath, 'utf-8');
    assert.strictEqual(stateContent, '# Custom State Content', 'second run should not overwrite STATE.md');
  });

  test('errors when version is not provided', () => {
    const result = runNewWorkspace(tmpDir, '');
    assert.strictEqual(result.status, 1, 'should exit with code 1 when version is missing');
    assert.ok(result.stderr.includes('version required'), 'error message should mention version');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// milestone update-manifest command
// ─────────────────────────────────────────────────────────────────────────────

describe('milestone update-manifest (cmdMilestoneUpdateManifest)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Set up a workspace first (in a child process to avoid process.exit)
    runNewWorkspace(tmpDir, 'v2.0');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('merges files into files_touched', () => {
    const result = runUpdateManifest(tmpDir, 'v2.0', ['a.js', 'b.js']);
    assert.strictEqual(result.status, 0, `Should exit 0, got: ${result.stderr}`);

    const conflictPath = path.join(tmpDir, '.planning', 'milestones', 'v2.0', 'conflict.json');
    const conflict = JSON.parse(fs.readFileSync(conflictPath, 'utf-8'));
    assert.deepStrictEqual(conflict.files_touched.sort(), ['a.js', 'b.js'].sort());
  });

  test('deduplicates files — same file added twice appears once', () => {
    runUpdateManifest(tmpDir, 'v2.0', ['a.js']);
    runUpdateManifest(tmpDir, 'v2.0', ['a.js']);

    const conflictPath = path.join(tmpDir, '.planning', 'milestones', 'v2.0', 'conflict.json');
    const conflict = JSON.parse(fs.readFileSync(conflictPath, 'utf-8'));
    assert.strictEqual(conflict.files_touched.length, 1, 'deduplication: a.js should appear only once');
  });

  test('accumulates files across multiple calls', () => {
    runUpdateManifest(tmpDir, 'v2.0', ['a.js', 'b.js']);
    runUpdateManifest(tmpDir, 'v2.0', ['c.js']);

    const conflictPath = path.join(tmpDir, '.planning', 'milestones', 'v2.0', 'conflict.json');
    const conflict = JSON.parse(fs.readFileSync(conflictPath, 'utf-8'));
    assert.deepStrictEqual(conflict.files_touched.sort(), ['a.js', 'b.js', 'c.js'].sort());
  });

  test('errors when version is not provided', () => {
    const result = runUpdateManifest(tmpDir, '', ['a.js']);
    assert.strictEqual(result.status, 1, 'should exit with code 1 when version is missing');
    assert.ok(result.stderr.includes('version required'), 'error message should mention version');
  });

  test('errors when conflict.json does not exist', () => {
    const result = runUpdateManifest(tmpDir, 'v99.0', ['a.js']);
    assert.strictEqual(result.status, 1, 'should exit with code 1 when conflict.json not found');
    assert.ok(result.stderr.includes('conflict.json not found'), 'error message should mention conflict.json');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validate consistency command
// ─────────────────────────────────────────────────────────────────────────────

