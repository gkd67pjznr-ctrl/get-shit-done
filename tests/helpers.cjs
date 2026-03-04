/**
 * GSD Tools Test Helpers
 */

const { execSync, execFileSync, spawnSync } = require('child_process');

const fs = require('fs');
const path = require('path');

const TOOLS_PATH = path.join(__dirname, '..', 'get-shit-done', 'bin', 'gsd-tools.cjs');

/**
 * Run gsd-tools command.
 *
 * @param {string|string[]} args - Command string (shell-interpreted) or array
 *   of arguments (shell-bypassed via execFileSync, safe for JSON and dollar signs).
 * @param {string} cwd - Working directory.
 */
function runGsdTools(args, cwd = process.cwd()) {
  try {
    let result;
    if (Array.isArray(args)) {
      result = execFileSync(process.execPath, [TOOLS_PATH, ...args], {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } else {
      result = execSync(`node "${TOOLS_PATH}" ${args}`, {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    }
    return { success: true, output: result.trim() };
  } catch (err) {
    return {
      success: false,
      output: err.stdout?.toString().trim() || '',
      error: err.stderr?.toString().trim() || err.message,
    };
  }
}

// Helper to run gsd-tools command, always returning stdout and stderr unconditionally.
// Uses spawnSync so stderr is always captured regardless of exit code.
function runGsdToolsFull(args, cwd = process.cwd(), envOverrides = {}) {
  const argList = typeof args === 'string' ? args.split(' ') : args;
  const result = spawnSync('node', [TOOLS_PATH, ...argList], {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, ...envOverrides },
  });
  return {
    success: result.status === 0,
    output: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    error: result.status !== 0 ? (result.stderr || '').trim() || result.error?.message || '' : undefined,
  };
}

// Create temp directory structure
function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  return tmpDir;
}

// Create temp directory with initialized git repo and at least one commit
function createTempGitProject() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });

  execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });

  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'PROJECT.md'),
    '# Project\n\nTest project.\n'
  );

  execSync('git add -A', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git commit -m "initial commit"', { cwd: tmpDir, stdio: 'pipe' });

  return tmpDir;
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// Create a legacy-style project (has config.json but NO concurrent:true)
// Use for COMPAT-01/02/03 compatibility tests. DO NOT modify createTempProject.
function createLegacyProject() {
  const tmpDir = createTempProject();
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify({ mode: 'yolo', commit_docs: true }),
    'utf-8'
  );
  return tmpDir;
}

// Create a concurrent/milestone-scoped project (config.json with concurrent:true + workspace)
// Use for milestone-scoped scenario tests. Also needed by Phase 13 (TEST-01).
function createConcurrentProject(version = 'v2.0') {
  const tmpDir = createTempProject();
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify({ concurrent: true }),
    'utf-8'
  );
  const workspaceDir = path.join(tmpDir, '.planning', 'milestones', version);
  fs.mkdirSync(path.join(workspaceDir, 'phases'), { recursive: true });
  fs.writeFileSync(path.join(workspaceDir, 'STATE.md'), '# State\n', 'utf-8');
  fs.writeFileSync(path.join(workspaceDir, 'ROADMAP.md'), '# Roadmap\n', 'utf-8');
  return tmpDir;
}

module.exports = { runGsdTools, runGsdToolsFull, createTempProject, createTempGitProject, createLegacyProject, createConcurrentProject, cleanup, TOOLS_PATH };
