/**
 * GSD Tools Tests - Dashboard Registry (REG-01 through REG-05)
 *
 * TDD tests for `gsd dashboard add|remove|list` commands.
 * Tests are written before implementation (Plan 17-01).
 */

const { describe, it, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { runGsdToolsFull, createTempProject, cleanup } = require('./helpers.cjs');

const toCleanup = [];

after(() => {
  toCleanup.forEach(d => {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
  });
});

function createGsdProject(displayName) {
  const tmpDir = createTempProject();
  fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'PROJECT.md'),
    `# ${displayName}\n\nTest project.\n`,
    'utf-8'
  );
  return tmpDir;
}

function createGsdHome() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-home-'));
  return tmpDir;
}

// ─── dashboard add ──────────────────────────────────────────────────────────

describe('dashboard add', () => {

  it('registers a project (REG-01)', () => {
    const projectDir = createGsdProject('My Test Project');
    const gsdHome = createGsdHome();
    toCleanup.push(projectDir, gsdHome);

    const result = runGsdToolsFull(['dashboard', 'add', projectDir], projectDir, { GSD_HOME: gsdHome });
    assert.strictEqual(result.success, true, `Expected success but got: ${result.error || result.stderr}`);
    assert.ok(result.output.includes('my-test-project'), `Output should contain slug: ${result.output}`);

    const dashPath = path.join(gsdHome, 'dashboard.json');
    assert.ok(fs.existsSync(dashPath), 'dashboard.json should exist');

    const data = JSON.parse(fs.readFileSync(dashPath, 'utf-8'));
    assert.ok(Array.isArray(data.projects), 'projects should be an array');
    assert.strictEqual(data.projects.length, 1);

    const entry = data.projects[0];
    assert.strictEqual(entry.name, 'my-test-project');
    assert.strictEqual(entry.display_name, 'My Test Project');
    assert.strictEqual(entry.path, fs.realpathSync(projectDir));
    assert.ok(!isNaN(Date.parse(entry.added)), 'added should be a valid ISO 8601 string');
  });

  it('defaults to cwd when no path given', () => {
    const projectDir = createGsdProject('CWD Project');
    const gsdHome = createGsdHome();
    toCleanup.push(projectDir, gsdHome);

    const result = runGsdToolsFull(['dashboard', 'add'], projectDir, { GSD_HOME: gsdHome });
    assert.strictEqual(result.success, true, `Expected success: ${result.error || result.stderr}`);

    const data = JSON.parse(fs.readFileSync(path.join(gsdHome, 'dashboard.json'), 'utf-8'));
    assert.strictEqual(data.projects[0].path, fs.realpathSync(projectDir));
  });

  it('rejects non-GSD directory', () => {
    const plainDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-plain-'));
    const gsdHome = createGsdHome();
    toCleanup.push(plainDir, gsdHome);

    const result = runGsdToolsFull(['dashboard', 'add', plainDir], plainDir, { GSD_HOME: gsdHome });
    assert.strictEqual(result.success, false, 'Should fail for non-GSD directory');
    const combined = (result.output + ' ' + (result.error || '') + ' ' + (result.stderr || '')).toLowerCase();
    assert.ok(combined.includes('.planning') || combined.includes('not a gsd project'), `Error should mention .planning: ${combined}`);
  });

  it('is no-op for already-registered path', () => {
    const projectDir = createGsdProject('Duplicate Path');
    const gsdHome = createGsdHome();
    toCleanup.push(projectDir, gsdHome);

    const r1 = runGsdToolsFull(['dashboard', 'add', projectDir], projectDir, { GSD_HOME: gsdHome });
    assert.strictEqual(r1.success, true);

    const r2 = runGsdToolsFull(['dashboard', 'add', projectDir], projectDir, { GSD_HOME: gsdHome });
    assert.strictEqual(r2.success, true, 'Second add should succeed (no-op)');

    const data = JSON.parse(fs.readFileSync(path.join(gsdHome, 'dashboard.json'), 'utf-8'));
    assert.strictEqual(data.projects.length, 1, 'Should not duplicate');
    assert.ok(r2.output.includes('already_registered') || r2.output.includes('already'), `Should indicate already registered: ${r2.output}`);
  });

  it('rejects duplicate slug from different path', () => {
    const proj1 = createGsdProject('Same Name');
    const proj2 = createGsdProject('Same Name');
    const gsdHome = createGsdHome();
    toCleanup.push(proj1, proj2, gsdHome);

    const r1 = runGsdToolsFull(['dashboard', 'add', proj1], proj1, { GSD_HOME: gsdHome });
    assert.strictEqual(r1.success, true);

    const r2 = runGsdToolsFull(['dashboard', 'add', proj2], proj2, { GSD_HOME: gsdHome });
    assert.strictEqual(r2.success, false, 'Should fail for duplicate slug');
    const combined = (r2.error || '') + ' ' + (r2.stderr || '');
    assert.ok(combined.includes('--name'), `Error should suggest --name: ${combined}`);
  });

  it('add with --name override', () => {
    const projectDir = createGsdProject('Real Name');
    const gsdHome = createGsdHome();
    toCleanup.push(projectDir, gsdHome);

    const result = runGsdToolsFull(
      ['dashboard', 'add', projectDir, '--name', 'custom-alias'],
      projectDir,
      { GSD_HOME: gsdHome }
    );
    assert.strictEqual(result.success, true, `Expected success: ${result.error || result.stderr}`);

    const data = JSON.parse(fs.readFileSync(path.join(gsdHome, 'dashboard.json'), 'utf-8'));
    assert.strictEqual(data.projects[0].name, 'custom-alias');
  });

  it('falls back to directory basename when PROJECT.md is missing (REG-04)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-noproject-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    const gsdHome = createGsdHome();
    toCleanup.push(tmpDir, gsdHome);

    const result = runGsdToolsFull(['dashboard', 'add', tmpDir], tmpDir, { GSD_HOME: gsdHome });
    assert.strictEqual(result.success, true, `Expected success: ${result.error || result.stderr}`);

    const data = JSON.parse(fs.readFileSync(path.join(gsdHome, 'dashboard.json'), 'utf-8'));
    // Name should be derived from the directory basename
    assert.ok(data.projects[0].name.length > 0, 'Name should not be empty');
    assert.ok(data.projects[0].name.startsWith('gsd-noproject'), `Name should derive from basename: ${data.projects[0].name}`);
  });

});

// ─── dashboard remove ───────────────────────────────────────────────────────

describe('dashboard remove', () => {

  it('removes a registered project (REG-02)', () => {
    const projectDir = createGsdProject('Remove Me Project');
    const gsdHome = createGsdHome();
    toCleanup.push(projectDir, gsdHome);

    runGsdToolsFull(['dashboard', 'add', projectDir], projectDir, { GSD_HOME: gsdHome });

    const result = runGsdToolsFull(['dashboard', 'remove', 'remove-me-project'], process.cwd(), { GSD_HOME: gsdHome });
    assert.strictEqual(result.success, true, `Expected success: ${result.error || result.stderr}`);

    const data = JSON.parse(fs.readFileSync(path.join(gsdHome, 'dashboard.json'), 'utf-8'));
    assert.strictEqual(data.projects.length, 0);
  });

  it('exits gracefully for unknown name (REG-02)', () => {
    const gsdHome = createGsdHome();
    toCleanup.push(gsdHome);

    const result = runGsdToolsFull(['dashboard', 'remove', 'nonexistent-project'], process.cwd(), { GSD_HOME: gsdHome });
    // Graceful -- should not crash
    assert.strictEqual(result.success, true, `Should exit gracefully: ${result.error || result.stderr}`);
  });

});

// ─── dashboard list ─────────────────────────────────────────────────────────

describe('dashboard list', () => {

  it('shows registered projects in table format (REG-03)', () => {
    const proj1 = createGsdProject('Alpha Project');
    const proj2 = createGsdProject('Beta Project');
    const gsdHome = createGsdHome();
    toCleanup.push(proj1, proj2, gsdHome);

    runGsdToolsFull(['dashboard', 'add', proj1], proj1, { GSD_HOME: gsdHome });
    runGsdToolsFull(['dashboard', 'add', proj2], proj2, { GSD_HOME: gsdHome });

    const result = runGsdToolsFull(['dashboard', 'list'], process.cwd(), { GSD_HOME: gsdHome });
    assert.strictEqual(result.success, true, `Expected success: ${result.error || result.stderr}`);
    assert.ok(result.output.includes('alpha-project'), `Should contain alpha-project: ${result.output}`);
    assert.ok(result.output.includes('beta-project'), `Should contain beta-project: ${result.output}`);
    assert.ok(result.output.includes('NAME'), `Should contain NAME header: ${result.output}`);
    assert.ok(result.output.includes('PATH'), `Should contain PATH header: ${result.output}`);
    assert.ok(result.output.includes('2 project'), `Should show count: ${result.output}`);
  });

  it('shows helpful message for empty registry (REG-03)', () => {
    const gsdHome = createGsdHome();
    toCleanup.push(gsdHome);

    const result = runGsdToolsFull(['dashboard', 'list'], process.cwd(), { GSD_HOME: gsdHome });
    assert.strictEqual(result.success, true);
    const output = result.output.toLowerCase();
    assert.ok(
      output.includes('no projects registered') || output.includes('gsd dashboard add'),
      `Should show helpful message: ${result.output}`
    );
  });

  it('marks stale paths with warning (REG-03)', () => {
    const projectDir = createGsdProject('Stale Project');
    const gsdHome = createGsdHome();
    toCleanup.push(gsdHome);

    runGsdToolsFull(['dashboard', 'add', projectDir], projectDir, { GSD_HOME: gsdHome });

    // Delete the project directory to make it stale
    fs.rmSync(projectDir, { recursive: true, force: true });

    const result = runGsdToolsFull(['dashboard', 'list'], process.cwd(), { GSD_HOME: gsdHome });
    assert.strictEqual(result.success, true);
    assert.ok(result.output.includes('[missing]'), `Should mark stale path: ${result.output}`);
    assert.ok(result.output.includes('missing'), `Footer should mention missing: ${result.output}`);
  });

  it('--raw returns JSON (REG-03)', () => {
    const projectDir = createGsdProject('Raw Project');
    const gsdHome = createGsdHome();
    toCleanup.push(projectDir, gsdHome);

    runGsdToolsFull(['dashboard', 'add', projectDir], projectDir, { GSD_HOME: gsdHome });

    const result = runGsdToolsFull(['dashboard', 'list', '--raw'], process.cwd(), { GSD_HOME: gsdHome });
    assert.strictEqual(result.success, true);

    const parsed = JSON.parse(result.output);
    assert.ok(Array.isArray(parsed.projects), 'Should have projects array');
    assert.strictEqual(typeof parsed.total, 'number');
    assert.strictEqual(typeof parsed.missing, 'number');
  });

  it('registry persists across invocations (REG-05)', () => {
    const projectDir = createGsdProject('Persistent Project');
    const gsdHome = createGsdHome();
    toCleanup.push(projectDir, gsdHome);

    // Process 1: add
    runGsdToolsFull(['dashboard', 'add', projectDir], projectDir, { GSD_HOME: gsdHome });

    // Process 2: list (completely separate invocation)
    const result = runGsdToolsFull(['dashboard', 'list'], process.cwd(), { GSD_HOME: gsdHome });
    assert.strictEqual(result.success, true);
    assert.ok(result.output.includes('persistent-project'), `Should find project from prior invocation: ${result.output}`);
  });

});
