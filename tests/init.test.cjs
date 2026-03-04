/**
 * GSD Tools Tests - Init
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, runGsdToolsFull, createTempProject, createConcurrentProject, cleanup } = require('./helpers.cjs');

describe('init commands', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('init execute-phase returns file paths', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');

    const result = runGsdTools('init execute-phase 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.strictEqual(output.config_path, '.planning/config.json');
  });

  test('init plan-phase returns file paths', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-CONTEXT.md'), '# Phase Context');
    fs.writeFileSync(path.join(phaseDir, '03-RESEARCH.md'), '# Research Findings');
    fs.writeFileSync(path.join(phaseDir, '03-VERIFICATION.md'), '# Verification');
    fs.writeFileSync(path.join(phaseDir, '03-UAT.md'), '# UAT');

    const result = runGsdTools('init plan-phase 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.strictEqual(output.requirements_path, '.planning/REQUIREMENTS.md');
    assert.strictEqual(output.context_path, '.planning/phases/03-api/03-CONTEXT.md');
    assert.strictEqual(output.research_path, '.planning/phases/03-api/03-RESEARCH.md');
    assert.strictEqual(output.verification_path, '.planning/phases/03-api/03-VERIFICATION.md');
    assert.strictEqual(output.uat_path, '.planning/phases/03-api/03-UAT.md');
  });

  test('init progress returns file paths', () => {
    const result = runGsdTools('init progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.strictEqual(output.project_path, '.planning/PROJECT.md');
    assert.strictEqual(output.config_path, '.planning/config.json');
  });

  test('init phase-op returns core and optional phase file paths', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-CONTEXT.md'), '# Phase Context');
    fs.writeFileSync(path.join(phaseDir, '03-RESEARCH.md'), '# Research');
    fs.writeFileSync(path.join(phaseDir, '03-VERIFICATION.md'), '# Verification');
    fs.writeFileSync(path.join(phaseDir, '03-UAT.md'), '# UAT');

    const result = runGsdTools('init phase-op 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.strictEqual(output.requirements_path, '.planning/REQUIREMENTS.md');
    assert.strictEqual(output.context_path, '.planning/phases/03-api/03-CONTEXT.md');
    assert.strictEqual(output.research_path, '.planning/phases/03-api/03-RESEARCH.md');
    assert.strictEqual(output.verification_path, '.planning/phases/03-api/03-VERIFICATION.md');
    assert.strictEqual(output.uat_path, '.planning/phases/03-api/03-UAT.md');
  });

  test('init plan-phase omits optional paths if files missing', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    const result = runGsdTools('init plan-phase 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.context_path, undefined);
    assert.strictEqual(output.research_path, undefined);
  });

  // ── phase_req_ids extraction (fix for #684) ──────────────────────────────

  test('init plan-phase extracts phase_req_ids from ROADMAP', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 3: API\n**Goal:** Build API\n**Requirements**: CP-01, CP-02, CP-03\n**Plans:** 0 plans\n`
    );

    const result = runGsdTools('init plan-phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_req_ids, 'CP-01, CP-02, CP-03');
  });

  test('init plan-phase strips brackets from phase_req_ids', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 3: API\n**Goal:** Build API\n**Requirements**: [CP-01, CP-02]\n**Plans:** 0 plans\n`
    );

    const result = runGsdTools('init plan-phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_req_ids, 'CP-01, CP-02');
  });

  test('init plan-phase returns null phase_req_ids when Requirements line is absent', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 3: API\n**Goal:** Build API\n**Plans:** 0 plans\n`
    );

    const result = runGsdTools('init plan-phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_req_ids, null);
  });

  test('init plan-phase returns null phase_req_ids when ROADMAP is absent', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });

    const result = runGsdTools('init plan-phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_req_ids, null);
  });

  test('init execute-phase extracts phase_req_ids from ROADMAP', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 3: API\n**Goal:** Build API\n**Requirements**: EX-01, EX-02\n**Plans:** 1 plans\n`
    );

    const result = runGsdTools('init execute-phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_req_ids, 'EX-01, EX-02');
  });

  test('init plan-phase returns null phase_req_ids when value is TBD', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-api'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 3: API\n**Goal:** Build API\n**Requirements**: TBD\n**Plans:** 0 plans\n`
    );

    const result = runGsdTools('init plan-phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_req_ids, null, 'TBD placeholder should return null');
  });

  test('init execute-phase returns null phase_req_ids when Requirements line is absent', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 3: API\n**Goal:** Build API\n**Plans:** 1 plans\n`
    );

    const result = runGsdTools('init execute-phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_req_ids, null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// --milestone flag parsing and init command wiring (PATH-03)
// ─────────────────────────────────────────────────────────────────────────────

describe('--milestone flag parsing (PATH-03)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Create minimal planning files needed for init plan-phase to succeed
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-test'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n## Phases\n### Phase 1: Test\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('--milestone flag parsed in space form', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ concurrent: true }));

    const result = runGsdTools('--milestone v2.0 init plan-phase 1 --raw', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error || ''}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.milestone_scope, 'v2.0');
  });

  test('--milestone=value equals form parsed', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ concurrent: true }));

    const result = runGsdTools('--milestone=v2.0 init plan-phase 1 --raw', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error || ''}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.milestone_scope, 'v2.0');
  });

  test('--milestone without value produces error', () => {
    // When --milestone is the last arg with no value following, it errors
    const result = runGsdToolsFull('--milestone', tmpDir);
    assert.strictEqual(result.success, false);
    assert.ok(
      result.stderr.includes('Missing value for --milestone'),
      `Error should mention missing value: ${result.stderr}`
    );
  });

  test('no --milestone flag results in null milestone_scope', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), '{}');

    const result = runGsdTools('init plan-phase 1 --raw', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error || ''}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.milestone_scope, null);
  });

  test('planning_root uses milestone-scoped path when --milestone provided', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ concurrent: true }));

    const result = runGsdTools('--milestone v2.0 init plan-phase 1 --raw', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error || ''}`);
    const parsed = JSON.parse(result.output);
    assert.ok(
      parsed.planning_root.endsWith(path.join('.planning', 'milestones', 'v2.0')),
      `planning_root should end with milestone path: ${parsed.planning_root}`
    );
  });

  test('planning_root uses legacy path when no --milestone provided', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), '{}');

    const result = runGsdTools('init plan-phase 1 --raw', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error || ''}`);
    const parsed = JSON.parse(result.output);
    assert.ok(
      parsed.planning_root.endsWith('.planning'),
      `planning_root should end with .planning: ${parsed.planning_root}`
    );
    assert.ok(
      !parsed.planning_root.includes('milestones'),
      `planning_root should not contain milestones: ${parsed.planning_root}`
    );
  });

  test('init plan-phase returns milestone-scoped file paths with --milestone (INTG-01)', () => {
    // Use createConcurrentProject which sets up .planning/milestones/v2.0/ workspace
    const concurrentDir = createConcurrentProject('v2.0');
    try {
      // Create a phase directory in the milestone workspace for findPhaseInternal to discover
      fs.mkdirSync(path.join(concurrentDir, '.planning', 'milestones', 'v2.0', 'phases', '01-test'), { recursive: true });
      // Write milestone-scoped ROADMAP.md with phase section
      fs.writeFileSync(
        path.join(concurrentDir, '.planning', 'milestones', 'v2.0', 'ROADMAP.md'),
        '# Roadmap\n## Phases\n### Phase 1: Test\n'
      );

      const result = runGsdTools('--milestone v2.0 init plan-phase 1 --raw', concurrentDir);
      assert.ok(result.success, `Command should succeed: ${result.error || ''}`);
      const parsed = JSON.parse(result.output);

      // Verify milestone-scoped paths (not hardcoded .planning/)
      const expectedPrefix = path.join('.planning', 'milestones', 'v2.0');
      assert.strictEqual(parsed.state_path, path.join(expectedPrefix, 'STATE.md'),
        `state_path should be milestone-scoped: ${parsed.state_path}`);
      assert.strictEqual(parsed.roadmap_path, path.join(expectedPrefix, 'ROADMAP.md'),
        `roadmap_path should be milestone-scoped: ${parsed.roadmap_path}`);
      assert.strictEqual(parsed.requirements_path, path.join(expectedPrefix, 'REQUIREMENTS.md'),
        `requirements_path should be milestone-scoped: ${parsed.requirements_path}`);
    } finally {
      cleanup(concurrentDir);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// roadmap analyze command
// ─────────────────────────────────────────────────────────────────────────────

describe('config quality section', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('config-ensure-section creates quality key with fast default', () => {
    const isolatedHome = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-quality-test-'));
    try {
      const result = runGsdToolsFull(['config-ensure-section'], tmpDir, { GSD_HOME: isolatedHome, HOME: isolatedHome });
      assert.ok(result.success, `Command failed: ${result.stderr}`);

      const configPath = path.join(tmpDir, '.planning', 'config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

      assert.ok(config.quality, 'quality key must exist');
      assert.strictEqual(config.quality.level, 'fast', 'default level must be fast');
      assert.ok(Array.isArray(config.quality.test_exemptions), 'test_exemptions must be array');
      assert.ok(config.quality.test_exemptions.includes('.md'), 'must include .md exemption');
      assert.ok(config.quality.test_exemptions.includes('.json'), 'must include .json exemption');
      assert.ok(config.quality.test_exemptions.includes('templates/**'), 'must include templates/** exemption');
      assert.ok(config.quality.test_exemptions.includes('.planning/**'), 'must include .planning/** exemption');
    } finally {
      fs.rmSync(isolatedHome, { recursive: true, force: true });
    }
  });

  test('config-get quality.level returns fast on fresh config', () => {
    const isolatedHome = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-quality-test-'));
    try {
      // First ensure config exists (isolated from real user defaults)
      runGsdToolsFull(['config-ensure-section'], tmpDir, { GSD_HOME: isolatedHome, HOME: isolatedHome });

      const result = runGsdToolsFull(['config-get', 'quality.level'], tmpDir, { GSD_HOME: isolatedHome, HOME: isolatedHome });
      assert.ok(result.success, `Command failed: ${result.stderr}`);
      assert.strictEqual(JSON.parse(result.output), 'fast', 'quality.level should be fast');
    } finally {
      fs.rmSync(isolatedHome, { recursive: true, force: true });
    }
  });

  test('config-get quality.test_exemptions returns array', () => {
    runGsdTools('config-ensure-section', tmpDir);

    const result = runGsdTools('config-get quality.test_exemptions', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const exemptions = JSON.parse(result.output);
    assert.ok(Array.isArray(exemptions), 'test_exemptions should be an array');
    assert.strictEqual(exemptions.length, 4, 'should have 4 default exemptions');
  });

  test('config-set quality.level to standard persists', () => {
    runGsdTools('config-ensure-section', tmpDir);
    runGsdTools('config-set quality.level standard', tmpDir);

    const result = runGsdTools('config-get quality.level', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.strictEqual(JSON.parse(result.output), 'standard', 'quality.level should be standard after set');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// context7 token cap config (INFR-01)
// ─────────────────────────────────────────────────────────────────────────────

describe('context7 token cap config (INFR-01)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('config-get quality.context7_token_cap returns 2000 on fresh config', () => {
    runGsdTools('config-ensure-section', tmpDir);

    const result = runGsdTools('config-get quality.context7_token_cap', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.strictEqual(JSON.parse(result.output), 2000, 'context7_token_cap should default to 2000');
  });

  test('config-set quality.context7_token_cap changes value', () => {
    runGsdTools('config-ensure-section', tmpDir);
    runGsdTools('config-set quality.context7_token_cap 5000', tmpDir);

    const result = runGsdTools('config-get quality.context7_token_cap', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.strictEqual(JSON.parse(result.output), 5000, 'context7_token_cap should be 5000 after set');
  });

  test('context7_token_cap persists across config reads', () => {
    runGsdTools('config-ensure-section', tmpDir);
    runGsdTools('config-set quality.context7_token_cap 3000', tmpDir);

    const configPath = path.join(tmpDir, '.planning', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(config.quality.context7_token_cap, 3000, 'context7_token_cap must be 3000 in raw file');

    const result = runGsdTools('config-get quality.context7_token_cap', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.strictEqual(JSON.parse(result.output), 3000, 'config-get must return 3000 after persistence');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// config auto-migration (QCFG-02)
// ─────────────────────────────────────────────────────────────────────────────

describe('config auto-migration (QCFG-02)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('config-ensure-section adds quality block to existing config missing it', () => {
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ model_profile: 'balanced', commit_docs: true }), 'utf-8');

    const isolatedHome = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-quality-test-'));
    try {
      const result = runGsdToolsFull(['config-ensure-section'], tmpDir, { GSD_HOME: isolatedHome, HOME: isolatedHome });
      assert.ok(result.success, `Command failed: ${result.stderr}`);

      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      assert.ok(config.quality, 'quality key must exist after migration');
      assert.strictEqual(config.quality.level, 'fast', 'quality.level must default to fast');
      assert.ok(Array.isArray(config.quality.test_exemptions), 'test_exemptions must be array');
      assert.strictEqual(config.quality.test_exemptions.length, 4, 'must have 4 default exemptions');
      assert.strictEqual(config.model_profile, 'balanced', 'existing model_profile must be preserved');
      assert.strictEqual(config.commit_docs, true, 'existing commit_docs must be preserved');
    } finally {
      fs.rmSync(isolatedHome, { recursive: true, force: true });
    }
  });

  test('config-ensure-section preserves existing quality block if already present', () => {
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({ quality: { level: 'strict', test_exemptions: ['.md'] } }),
      'utf-8'
    );

    const result = runGsdTools('config-ensure-section', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(config.quality.level, 'strict', 'quality.level must remain strict');
    assert.deepStrictEqual(config.quality.test_exemptions, ['.md'], 'test_exemptions must be unchanged');
  });

  test('config-ensure-section adds quality.context7_token_cap default when missing', () => {
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({ quality: { level: 'standard' } }),
      'utf-8'
    );

    const result = runGsdTools('config-ensure-section', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(config.quality.context7_token_cap, 2000, 'context7_token_cap must be set to 2000');
    assert.strictEqual(config.quality.level, 'standard', 'quality.level must not be overwritten');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// global defaults bootstrap (QCFG-03)
// ─────────────────────────────────────────────────────────────────────────────

describe('global defaults bootstrap (QCFG-03)', () => {
  let tmpDir;
  let tempGsdHome;

  beforeEach(() => {
    tmpDir = createTempProject();
    tempGsdHome = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-home-test-'));
  });

  afterEach(() => {
    cleanup(tmpDir);
    fs.rmSync(tempGsdHome, { recursive: true, force: true });
  });

  test('config-ensure-section creates ~/.gsd/defaults.json on first run when absent', () => {
    const result = runGsdToolsFull('config-ensure-section', tmpDir, { GSD_HOME: tempGsdHome });
    assert.ok(result.success, `Command failed: ${result.stderr}`);

    const defaultsPath = path.join(tempGsdHome, 'defaults.json');
    assert.ok(fs.existsSync(defaultsPath), 'defaults.json must be created in GSD_HOME');

    const defaults = JSON.parse(fs.readFileSync(defaultsPath, 'utf-8'));
    assert.ok(defaults.quality, 'defaults.json must have quality key');
    assert.strictEqual(defaults.quality.level, 'fast', 'defaults.json quality.level must be fast');
  });

  test('config-ensure-section inherits quality.level from existing global defaults', () => {
    const defaultsPath = path.join(tempGsdHome, 'defaults.json');
    fs.writeFileSync(defaultsPath, JSON.stringify({ quality: { level: 'strict' } }), 'utf-8');

    const result = runGsdToolsFull('config-ensure-section', tmpDir, { GSD_HOME: tempGsdHome });
    assert.ok(result.success, `Command failed: ${result.stderr}`);

    const configPath = path.join(tmpDir, '.planning', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(config.quality.level, 'strict', 'quality.level must be inherited from global defaults');
  });

  test('config-ensure-section does not overwrite existing ~/.gsd/defaults.json', () => {
    const defaultsPath = path.join(tempGsdHome, 'defaults.json');
    const originalContent = { quality: { level: 'standard', test_exemptions: ['.md'] } };
    fs.writeFileSync(defaultsPath, JSON.stringify(originalContent), 'utf-8');

    runGsdToolsFull('config-ensure-section', tmpDir, { GSD_HOME: tempGsdHome });

    const after = JSON.parse(fs.readFileSync(defaultsPath, 'utf-8'));
    assert.deepStrictEqual(after, originalContent, 'defaults.json must not be modified');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// missing-section warnings (QOBS-03)
// ─────────────────────────────────────────────────────────────────────────────

describe('missing-section warnings (QOBS-03)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('loadConfig warns on stderr when quality section is missing from config', () => {
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ model_profile: 'balanced' }), 'utf-8');

    const result = runGsdToolsFull('config-get model_profile', tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    assert.ok(
      result.stderr.includes('quality'),
      `stderr must contain warning about missing quality section, got: "${result.stderr}"`
    );
  });

  test('loadConfig does NOT warn when quality section is present', () => {
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({ model_profile: 'balanced', quality: { level: 'fast' } }),
      'utf-8'
    );

    const result = runGsdToolsFull('config-get model_profile', tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    assert.strictEqual(result.stderr, '', `stderr must be empty, got: "${result.stderr}"`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// init commands with milestone directory detection (BUG-INIT-01)
// ─────────────────────────────────────────────────────────────────────────────

describe('init commands with milestone directory detection (BUG-INIT-01)', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) {
      cleanup(tmpDir);
      tmpDir = null;
    }
  });

  test('init plan-phase finds phase when milestones dir exists but concurrent flag is absent', () => {
    tmpDir = createTempProject();
    // Write config WITHOUT concurrent:true
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ mode: 'yolo' }),
      'utf-8'
    );
    // Create milestone workspace with STATE.md and ROADMAP.md
    const v2Dir = path.join(tmpDir, '.planning', 'milestones', 'v2.0');
    fs.mkdirSync(path.join(v2Dir, 'phases', '01-test'), { recursive: true });
    fs.writeFileSync(path.join(v2Dir, 'STATE.md'), '# State\n', 'utf-8');
    fs.writeFileSync(path.join(v2Dir, 'ROADMAP.md'), '# Roadmap\n', 'utf-8');

    const result = runGsdToolsFull(['init', 'plan-phase', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.phase_found, true, `Expected phase_found: true, got: ${output.phase_found}`);
    assert.strictEqual(output.milestone_scope, 'v2.0', `Expected milestone_scope: v2.0, got: ${output.milestone_scope}`);
    assert.ok(
      output.planning_root.endsWith(path.join('.planning', 'milestones', 'v2.0')),
      `planning_root should end with .planning/milestones/v2.0, got: ${output.planning_root}`
    );
  });

  test('init execute-phase finds phase when milestones dir exists but concurrent flag is absent', () => {
    tmpDir = createTempProject();
    // Write config WITHOUT concurrent:true
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ mode: 'yolo' }),
      'utf-8'
    );
    // Create milestone workspace with STATE.md, ROADMAP.md and a PLAN.md in a phase dir
    const v2Dir = path.join(tmpDir, '.planning', 'milestones', 'v2.0');
    const phaseDir = path.join(v2Dir, 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(v2Dir, 'STATE.md'), '# State\n', 'utf-8');
    fs.writeFileSync(path.join(v2Dir, 'ROADMAP.md'), '# Roadmap\n', 'utf-8');
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan\n', 'utf-8');

    const result = runGsdToolsFull(['init', 'execute-phase', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.phase_found, true, `Expected phase_found: true, got: ${output.phase_found}`);
  });

  test('init plan-phase selects correct milestone with double-digit versions', () => {
    tmpDir = createTempProject();
    // Write config WITHOUT concurrent:true
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ mode: 'yolo' }),
      'utf-8'
    );
    // Create v2.0 milestone with STATE.md
    const v2Dir = path.join(tmpDir, '.planning', 'milestones', 'v2.0');
    fs.mkdirSync(path.join(v2Dir, 'phases'), { recursive: true });
    fs.writeFileSync(path.join(v2Dir, 'STATE.md'), '# State\n', 'utf-8');
    fs.writeFileSync(path.join(v2Dir, 'ROADMAP.md'), '# Roadmap\n', 'utf-8');
    // Create v14.0 milestone with STATE.md and a phase dir
    const v14Dir = path.join(tmpDir, '.planning', 'milestones', 'v14.0');
    fs.mkdirSync(path.join(v14Dir, 'phases', '01-test'), { recursive: true });
    fs.writeFileSync(path.join(v14Dir, 'STATE.md'), '# State\n', 'utf-8');
    fs.writeFileSync(path.join(v14Dir, 'ROADMAP.md'), '# Roadmap\n', 'utf-8');

    const result = runGsdToolsFull(['init', 'plan-phase', '1', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.milestone_scope, 'v14.0', `Expected milestone_scope: v14.0 (numeric sort), got: ${output.milestone_scope}`);
    assert.strictEqual(output.phase_found, true, `Expected phase_found: true, got: ${output.phase_found}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cross-milestone phase lookup in init commands (BUG-INIT-CROSSMS-01)
// ─────────────────────────────────────────────────────────────────────────────

describe('cross-milestone phase lookup in init commands (BUG-INIT-CROSSMS-01)', () => {
  let tmpDir;

  // Helper: set up concurrent project with v2.0 as active and v1.0 with legacy phases
  function setupCrossMillestoneProject(opts = {}) {
    // Start with concurrent project (v2.0 is the active/newest milestone)
    const dir = createConcurrentProject('v2.0');

    // Create v1.0 workspace with a legacy phase
    const v1Dir = path.join(dir, '.planning', 'milestones', 'v1.0');
    const phaseNum = opts.phaseNum || '95';
    const phaseName = opts.phaseName || 'legacy-feature';
    fs.mkdirSync(path.join(v1Dir, 'phases', `${phaseNum}-${phaseName}`), { recursive: true });
    fs.writeFileSync(path.join(v1Dir, 'STATE.md'), '# State\n', 'utf-8');

    // Write v1.0 ROADMAP with the phase documented
    fs.writeFileSync(
      path.join(v1Dir, 'ROADMAP.md'),
      `# Roadmap v1.0\n\n## Phases\n\n### Phase ${phaseNum}: ${phaseName.replace(/-/g, ' ')}\n**Goal:** Legacy goal\n\n`,
      'utf-8'
    );

    // Add optional plan file
    if (opts.withPlan) {
      fs.writeFileSync(
        path.join(v1Dir, 'phases', `${phaseNum}-${phaseName}`, `${phaseNum}-01-PLAN.md`),
        '# Plan\n',
        'utf-8'
      );
    }

    return dir;
  }

  afterEach(() => {
    if (tmpDir) {
      cleanup(tmpDir);
      tmpDir = null;
    }
  });

  test('init phase-op finds phase in non-active milestone without --milestone flag', () => {
    tmpDir = setupCrossMillestoneProject({ phaseNum: '95', phaseName: 'legacy-feature' });

    const result = runGsdToolsFull(['init', 'phase-op', '95', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.phase_found, true, `phase_found should be true, got: ${output.phase_found}`);
    assert.strictEqual(output.milestone_scope, 'v1.0', `milestone_scope should be v1.0 (found), got: ${output.milestone_scope}`);
    assert.ok(
      output.planning_root.endsWith(path.join('.planning', 'milestones', 'v1.0')),
      `planning_root should point to v1.0, got: ${output.planning_root}`
    );
  });

  test('init execute-phase finds phase in non-active milestone without --milestone flag', () => {
    tmpDir = setupCrossMillestoneProject({ phaseNum: '95', phaseName: 'legacy-feature', withPlan: true });

    const result = runGsdToolsFull(['init', 'execute-phase', '95', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.phase_found, true, `phase_found should be true, got: ${output.phase_found}`);
    assert.strictEqual(output.milestone_scope, 'v1.0', `milestone_scope should be v1.0 (found), got: ${output.milestone_scope}`);
  });

  test('init plan-phase finds phase in non-active milestone without --milestone flag', () => {
    tmpDir = setupCrossMillestoneProject({ phaseNum: '95', phaseName: 'legacy-feature' });

    const result = runGsdToolsFull(['init', 'plan-phase', '95', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.phase_found, true, `phase_found should be true, got: ${output.phase_found}`);
    assert.strictEqual(output.milestone_scope, 'v1.0', `milestone_scope should be v1.0 (found), got: ${output.milestone_scope}`);
  });

  test('init verify-work finds phase in non-active milestone without --milestone flag', () => {
    tmpDir = setupCrossMillestoneProject({ phaseNum: '95', phaseName: 'legacy-feature' });

    const result = runGsdToolsFull(['init', 'verify-work', '95', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);

    assert.strictEqual(output.phase_found, true, `phase_found should be true, got: ${output.phase_found}`);
    assert.strictEqual(output.milestone_scope, 'v1.0', `milestone_scope should be v1.0 (found), got: ${output.milestone_scope}`);
  });

  test('effectiveScope reflects found milestone, not active milestone', () => {
    tmpDir = setupCrossMillestoneProject({ phaseNum: '95', phaseName: 'legacy-feature' });

    // Run phase-op which sets milestone_scope from effectiveScope
    const result = runGsdToolsFull(['init', 'phase-op', '95', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);

    // Active milestone is v2.0, but phase is found in v1.0
    assert.strictEqual(output.milestone_scope, 'v1.0',
      `effectiveScope should be v1.0 (where phase was found), not v2.0 (active). Got: ${output.milestone_scope}`);
    assert.ok(
      output.planning_root.includes('v1.0'),
      `planning_root should reflect v1.0, got: ${output.planning_root}`
    );
  });

  test('init phase-op falls back to ROADMAP cross-milestone search (phase dir absent)', () => {
    // v2.0 is active, v1.0 has phase 42 in ROADMAP only (no directory)
    tmpDir = createConcurrentProject('v2.0');

    const v1Dir = path.join(tmpDir, '.planning', 'milestones', 'v1.0');
    fs.mkdirSync(path.join(v1Dir, 'phases'), { recursive: true });
    fs.writeFileSync(path.join(v1Dir, 'STATE.md'), '# State\n', 'utf-8');
    fs.writeFileSync(
      path.join(v1Dir, 'ROADMAP.md'),
      '# Roadmap v1.0\n\n## Phases\n\n### Phase 42: Roadmap Only Phase\n**Goal:** Only in roadmap\n\n',
      'utf-8'
    );

    const result = runGsdToolsFull(['init', 'phase-op', '42', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const output = JSON.parse(result.output);

    // Phase should be found via ROADMAP cross-search
    assert.strictEqual(output.phase_found, true,
      `phase_found should be true via ROADMAP cross-search, got: ${output.phase_found}`);
    assert.strictEqual(output.phase_number, '42',
      `phase_number should be 42, got: ${output.phase_number}`);
  });
});
