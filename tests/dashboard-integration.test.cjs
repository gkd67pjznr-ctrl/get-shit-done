'use strict';

/**
 * dashboard-integration.test.cjs
 *
 * Test coverage for Phase 14 Plan 02: Dashboard Copy, Build, and Command Update
 *
 * Requirements covered:
 *   DASH-01 - Dashboard TS source exists in gsdup repo (src/dashboard/)
 *   DASH-02 - Dashboard dependencies confirmed (zero runtime deps, esbuild in devDeps)
 *   DASH-03 - Dashboard CLI entry and compiled bundle exist and run
 *   DASH-04 - Dashboard command file updated to local build (no npx skill-creator)
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.join(__dirname, '..');

// ---------------------------------------------------------------------------
// DASH-01: Dashboard TS source exists in gsdup repo
// ---------------------------------------------------------------------------

describe('DASH-01: dashboard TypeScript source exists in src/dashboard/', () => {
  test('src/dashboard/ directory exists', () => {
    assert.ok(
      fs.existsSync(path.join(repoRoot, 'src/dashboard')),
      'src/dashboard/ directory must exist'
    );
  });

  test('src/dashboard/generator.ts exists', () => {
    assert.ok(
      fs.existsSync(path.join(repoRoot, 'src/dashboard/generator.ts')),
      'src/dashboard/generator.ts must exist'
    );
  });

  test('src/dashboard/parser.ts exists', () => {
    assert.ok(
      fs.existsSync(path.join(repoRoot, 'src/dashboard/parser.ts')),
      'src/dashboard/parser.ts must exist'
    );
  });

  test('src/dashboard/index.ts exists', () => {
    assert.ok(
      fs.existsSync(path.join(repoRoot, 'src/dashboard/index.ts')),
      'src/dashboard/index.ts must exist'
    );
  });

  test('src/dashboard/types.ts exists', () => {
    assert.ok(
      fs.existsSync(path.join(repoRoot, 'src/dashboard/types.ts')),
      'src/dashboard/types.ts must exist'
    );
  });

  test('src/dashboard/pages/ directory exists', () => {
    assert.ok(
      fs.existsSync(path.join(repoRoot, 'src/dashboard/pages')),
      'src/dashboard/pages/ directory must exist'
    );
  });

  test('src/dashboard/collectors/ directory exists', () => {
    assert.ok(
      fs.existsSync(path.join(repoRoot, 'src/dashboard/collectors')),
      'src/dashboard/collectors/ directory must exist'
    );
  });
});

// ---------------------------------------------------------------------------
// DASH-02: Dashboard dependencies confirmed (zero runtime deps required)
// ---------------------------------------------------------------------------

describe('DASH-02: dashboard dependencies confirmed (zero runtime deps)', () => {
  let pkg;

  test('package.json is readable and parseable', () => {
    const pkgPath = path.join(repoRoot, 'package.json');
    const content = fs.readFileSync(pkgPath, 'utf8');
    pkg = JSON.parse(content);
    assert.ok(pkg, 'package.json must be parseable JSON');
  });

  test('devDependencies contains esbuild', () => {
    const pkgPath = path.join(repoRoot, 'package.json');
    const content = fs.readFileSync(pkgPath, 'utf8');
    const parsed = JSON.parse(content);
    assert.ok(
      parsed.devDependencies && parsed.devDependencies['esbuild'],
      'devDependencies must contain esbuild'
    );
  });

  test('runtime dependencies do not include @clack/prompts', () => {
    const pkgPath = path.join(repoRoot, 'package.json');
    const content = fs.readFileSync(pkgPath, 'utf8');
    const parsed = JSON.parse(content);
    const deps = parsed.dependencies || {};
    assert.ok(
      !deps['@clack/prompts'],
      'dependencies must NOT contain @clack/prompts (external UI dep excluded by design)'
    );
  });

  test('runtime dependencies do not include picocolors', () => {
    const pkgPath = path.join(repoRoot, 'package.json');
    const content = fs.readFileSync(pkgPath, 'utf8');
    const parsed = JSON.parse(content);
    const deps = parsed.dependencies || {};
    assert.ok(
      !deps['picocolors'],
      'dependencies must NOT contain picocolors (external UI dep excluded by design)'
    );
  });
});

// ---------------------------------------------------------------------------
// DASH-03: Dashboard CLI entry and compiled bundle exist and run
// ---------------------------------------------------------------------------

describe('DASH-03: dashboard CLI entry and compiled bundle exist and run', () => {
  test('src/dashboard/cli.ts exists', () => {
    assert.ok(
      fs.existsSync(path.join(repoRoot, 'src/dashboard/cli.ts')),
      'src/dashboard/cli.ts must exist (the TypeScript CLI wrapper)'
    );
  });

  test('dist/dashboard.cjs exists', () => {
    assert.ok(
      fs.existsSync(path.join(repoRoot, 'dist/dashboard.cjs')),
      'dist/dashboard.cjs must exist (the compiled bundle)'
    );
  });

  test('node dist/dashboard.cjs --help outputs text containing "generate"', () => {
    const result = execSync('node dist/dashboard.cjs --help', {
      encoding: 'utf8',
      cwd: repoRoot
    });
    assert.ok(
      result.includes('generate'),
      `help output should mention "generate", got: ${result.slice(0, 200)}`
    );
  });
});

// ---------------------------------------------------------------------------
// DASH-04: Dashboard command file updated to local build
// ---------------------------------------------------------------------------

describe('DASH-04: dashboard command file uses local build (no npx skill-creator)', () => {
  const commandPath = path.join(repoRoot, 'commands/gsd/dashboard.md');

  test('commands/gsd/dashboard.md exists', () => {
    assert.ok(
      fs.existsSync(commandPath),
      'commands/gsd/dashboard.md must exist'
    );
  });

  test('dashboard.md does NOT contain "npx skill-creator dashboard"', () => {
    const content = fs.readFileSync(commandPath, 'utf8');
    assert.ok(
      !content.includes('npx skill-creator dashboard'),
      'dashboard.md must not contain "npx skill-creator dashboard"'
    );
  });

  test('dashboard.md does NOT contain "npx skill-creator db"', () => {
    const content = fs.readFileSync(commandPath, 'utf8');
    assert.ok(
      !content.includes('npx skill-creator db'),
      'dashboard.md must not contain "npx skill-creator db"'
    );
  });

  test('dashboard.md contains "node dist/dashboard.cjs"', () => {
    const content = fs.readFileSync(commandPath, 'utf8');
    assert.ok(
      content.includes('node dist/dashboard.cjs'),
      'dashboard.md must use "node dist/dashboard.cjs" for local invocation'
    );
  });
});
