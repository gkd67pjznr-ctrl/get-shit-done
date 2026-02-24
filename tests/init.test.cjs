/**
 * GSD Tools Tests - Init
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, runGsdToolsFull, createTempProject, cleanup } = require('./helpers.cjs');

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
    const result = runGsdTools('config-ensure-section', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const configPath = path.join(tmpDir, '.planning', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    assert.ok(config.quality, 'quality key must exist');
    assert.strictEqual(config.quality.level, 'fast', 'default level must be fast');
    assert.ok(Array.isArray(config.quality.test_exemptions), 'test_exemptions must be array');
    assert.ok(config.quality.test_exemptions.includes('.md'), 'must include .md exemption');
    assert.ok(config.quality.test_exemptions.includes('.json'), 'must include .json exemption');
    assert.ok(config.quality.test_exemptions.includes('templates/**'), 'must include templates/** exemption');
    assert.ok(config.quality.test_exemptions.includes('.planning/**'), 'must include .planning/** exemption');
  });

  test('config-get quality.level returns fast on fresh config', () => {
    // First ensure config exists
    runGsdTools('config-ensure-section', tmpDir);

    const result = runGsdTools('config-get quality.level', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.strictEqual(JSON.parse(result.output), 'fast', 'quality.level should be fast');
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

    const result = runGsdTools('config-ensure-section', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.ok(config.quality, 'quality key must exist after migration');
    assert.strictEqual(config.quality.level, 'fast', 'quality.level must default to fast');
    assert.ok(Array.isArray(config.quality.test_exemptions), 'test_exemptions must be array');
    assert.strictEqual(config.quality.test_exemptions.length, 4, 'must have 4 default exemptions');
    assert.strictEqual(config.model_profile, 'balanced', 'existing model_profile must be preserved');
    assert.strictEqual(config.commit_docs, true, 'existing commit_docs must be preserved');
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

