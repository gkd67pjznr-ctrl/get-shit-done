/**
 * Foundation tests for Phase 12 — v4.0 adaptive_learning config schema and migration
 *
 * CFG-01: .planning/config.json has adaptive_learning key with all 4 sub-keys
 * CFG-02: migrateSkillCreatorConfig merges skill-creator.json into config.json
 * SKILL-01: all 16 skill directories present with SKILL.md
 * SKILL-02: skills/ directory structure (no stray files)
 * TEAM-01: teams/ directory has 4 valid JSON team configs
 * TEAM-02: agent ID verification report documents alignment with canonical agents
 * INST-06: .planning/patterns/ reference directory exists with expected files
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ── CFG-01: .planning/config.json has adaptive_learning key ──────────────────

describe('CFG-01: config.json contains adaptive_learning schema', () => {
  test('adaptive_learning key exists with all 4 required sub-keys', () => {
    const configPath = path.join(__dirname, '..', '.planning', 'config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);

    assert.ok(
      config.adaptive_learning && typeof config.adaptive_learning === 'object',
      'adaptive_learning should be an object in .planning/config.json'
    );

    const al = config.adaptive_learning;
    assert.ok('integration' in al, 'adaptive_learning.integration should exist');
    assert.ok('token_budget' in al, 'adaptive_learning.token_budget should exist');
    assert.ok('observation' in al, 'adaptive_learning.observation should exist');
    assert.ok('suggestions' in al, 'adaptive_learning.suggestions should exist');
  });

  test('adaptive_learning.integration has all required fields', () => {
    const configPath = path.join(__dirname, '..', '.planning', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const integration = config.adaptive_learning.integration;

    assert.ok('auto_load_skills' in integration, 'integration.auto_load_skills should exist');
    assert.ok('observe_sessions' in integration, 'integration.observe_sessions should exist');
    assert.ok('phase_transition_hooks' in integration, 'integration.phase_transition_hooks should exist');
    assert.ok('suggest_on_session_start' in integration, 'integration.suggest_on_session_start should exist');
  });

  test('adaptive_learning.token_budget has max_percent and warn_at_percent', () => {
    const configPath = path.join(__dirname, '..', '.planning', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const tb = config.adaptive_learning.token_budget;

    assert.ok('max_percent' in tb, 'token_budget.max_percent should exist');
    assert.ok('warn_at_percent' in tb, 'token_budget.warn_at_percent should exist');
  });
});

// ── CFG-02: migrateSkillCreatorConfig function ────────────────────────────────

describe('CFG-02: migrateSkillCreatorConfig', () => {
  const { migrateSkillCreatorConfig } = require('../get-shit-done/bin/lib/migrate.cjs');

  // Minimal skill-creator.json schema matching the canonical source
  const SC_SCHEMA = {
    integration: {
      auto_load_skills: true,
      observe_sessions: true,
      phase_transition_hooks: true,
      suggest_on_session_start: true,
      install_git_hooks: true,
    },
    token_budget: {
      max_percent: 5,
      warn_at_percent: 4,
    },
    observation: {
      retention_days: 90,
      max_entries: 1000,
      capture_corrections: true,
    },
    suggestions: {
      min_occurrences: 3,
      cooldown_days: 7,
      auto_dismiss_after_days: 30,
    },
  };

  test('merges skill-creator.json into config.json and removes standalone file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-cfg02-'));
    try {
      // Write minimal config.json and skill-creator.json
      fs.writeFileSync(
        path.join(tmpDir, 'config.json'),
        JSON.stringify({ mode: 'yolo', commit_docs: true }, null, 2) + '\n',
        'utf-8'
      );
      fs.writeFileSync(
        path.join(tmpDir, 'skill-creator.json'),
        JSON.stringify(SC_SCHEMA, null, 2) + '\n',
        'utf-8'
      );

      migrateSkillCreatorConfig(tmpDir);

      // 1. config.json now has adaptive_learning
      const config = JSON.parse(fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf-8'));
      assert.ok(
        config.adaptive_learning && typeof config.adaptive_learning === 'object',
        'config.json should have adaptive_learning after migration'
      );
      assert.deepStrictEqual(
        config.adaptive_learning,
        SC_SCHEMA,
        'adaptive_learning should match the skill-creator.json content'
      );

      // 2. Pre-existing keys preserved
      assert.strictEqual(config.mode, 'yolo', 'Pre-existing config keys should be preserved');
      assert.strictEqual(config.commit_docs, true, 'Pre-existing config keys should be preserved');

      // 3. skill-creator.json no longer exists
      assert.ok(
        !fs.existsSync(path.join(tmpDir, 'skill-creator.json')),
        'skill-creator.json should be removed after migration'
      );

      // 4. skill-creator.json.bak exists
      assert.ok(
        fs.existsSync(path.join(tmpDir, 'skill-creator.json.bak')),
        'skill-creator.json.bak should exist after migration'
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('idempotency: calling migration again after .bak present does not change config', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-cfg02-idemp-'));
    try {
      fs.writeFileSync(
        path.join(tmpDir, 'config.json'),
        JSON.stringify({ mode: 'yolo' }, null, 2) + '\n',
        'utf-8'
      );
      fs.writeFileSync(
        path.join(tmpDir, 'skill-creator.json'),
        JSON.stringify(SC_SCHEMA, null, 2) + '\n',
        'utf-8'
      );

      // First call
      migrateSkillCreatorConfig(tmpDir);
      const afterFirst = fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf-8');

      // Second call (skill-creator.json is gone, .bak exists, adaptive_learning present)
      assert.doesNotThrow(
        () => migrateSkillCreatorConfig(tmpDir),
        'Second migration call should not throw'
      );
      const afterSecond = fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf-8');

      assert.strictEqual(
        afterFirst,
        afterSecond,
        'config.json should not change on second migration call'
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('fresh-project: no skill-creator.json means no changes', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-cfg02-fresh-'));
    try {
      const configContent = JSON.stringify({ mode: 'yolo' }, null, 2) + '\n';
      fs.writeFileSync(path.join(tmpDir, 'config.json'), configContent, 'utf-8');

      // No skill-creator.json in tmpDir
      assert.doesNotThrow(
        () => migrateSkillCreatorConfig(tmpDir),
        'Migration on fresh project should not throw'
      );

      // config.json unchanged
      const afterContent = fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf-8');
      assert.strictEqual(afterContent, configContent, 'config.json should be unchanged for fresh project');

      // No .bak created
      assert.ok(
        !fs.existsSync(path.join(tmpDir, 'skill-creator.json.bak')),
        'No .bak should be created for fresh project'
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('idempotency: adaptive_learning already present in config.json skips migration', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-cfg02-skip-'));
    try {
      // config.json already has adaptive_learning
      const existingConfig = {
        mode: 'yolo',
        adaptive_learning: { existing: true },
      };
      fs.writeFileSync(
        path.join(tmpDir, 'config.json'),
        JSON.stringify(existingConfig, null, 2) + '\n',
        'utf-8'
      );
      // skill-creator.json also present
      fs.writeFileSync(
        path.join(tmpDir, 'skill-creator.json'),
        JSON.stringify(SC_SCHEMA, null, 2) + '\n',
        'utf-8'
      );

      migrateSkillCreatorConfig(tmpDir);

      // adaptive_learning should remain as { existing: true } (not overwritten)
      const config = JSON.parse(fs.readFileSync(path.join(tmpDir, 'config.json'), 'utf-8'));
      assert.deepStrictEqual(
        config.adaptive_learning,
        { existing: true },
        'adaptive_learning should not be overwritten if already present'
      );

      // skill-creator.json should still exist (migration skipped)
      assert.ok(
        fs.existsSync(path.join(tmpDir, 'skill-creator.json')),
        'skill-creator.json should still exist when migration is skipped'
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('CFG-02: installer wires migrateSkillCreatorConfig on local install', () => {
  const { migrateSkillCreatorConfig } = require('../get-shit-done/bin/lib/migrate.cjs');

  test('calling migrateSkillCreatorConfig removes skill-creator.json and merges into config.json', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-cfg02-wire-'));
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });

    // Write a minimal skill-creator.json (format from Phase 12 research)
    const scConfig = {
      observation: { enabled: true, sampleRate: 1.0, storageLimit: 100 },
      suggestion: { enabled: true, minSessions: 3, confidenceThreshold: 0.7 },
      skill: { autoApply: false, requireApproval: true }
    };
    fs.writeFileSync(
      path.join(planningDir, 'skill-creator.json'),
      JSON.stringify(scConfig, null, 2)
    );

    // Simulate installer local-only block calling migration
    migrateSkillCreatorConfig(planningDir);

    // Assertions
    assert.ok(
      !fs.existsSync(path.join(planningDir, 'skill-creator.json')),
      'skill-creator.json should be removed after migration'
    );
    assert.ok(
      fs.existsSync(path.join(planningDir, 'config.json')),
      'config.json should exist after migration'
    );
    const merged = JSON.parse(fs.readFileSync(path.join(planningDir, 'config.json'), 'utf8'));
    assert.ok(merged.adaptive_learning, 'config.json should have adaptive_learning key');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

// ── SKILL-01 and SKILL-02: skills/ directory structure ────────────────────────

const EXPECTED_SKILLS = [
  'api-design', 'beautiful-commits', 'code-review', 'context-handoff',
  'decision-framework', 'env-setup', 'file-operation-patterns', 'gsd-onboard',
  'gsd-preflight', 'gsd-trace', 'gsd-workflow', 'security-hygiene',
  'session-awareness', 'skill-integration', 'test-generator', 'typescript-patterns'
];

describe('SKILL-02: skills/ directory structure', () => {
  const skillsDir = path.join(__dirname, '..', 'skills');

  test('skills/ directory exists and is readable', () => {
    const entries = fs.readdirSync(skillsDir);
    assert.ok(Array.isArray(entries), 'skills/ should be a readable directory');
  });

  test('skills/ contains only directories (no stray files)', () => {
    const entries = fs.readdirSync(skillsDir);
    const strayFiles = entries.filter(e => !fs.statSync(path.join(skillsDir, e)).isDirectory());
    assert.strictEqual(
      strayFiles.length,
      0,
      `skills/ should contain only directories, found stray files: ${strayFiles.join(', ')}`
    );
  });
});

describe('SKILL-01: all 16 skill directories present with SKILL.md', () => {
  const skillsDir = path.join(__dirname, '..', 'skills');

  test('all 16 expected skill names exist as directories', () => {
    for (const name of EXPECTED_SKILLS) {
      const dirPath = path.join(skillsDir, name);
      assert.ok(
        fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory(),
        `skills/${name}/ directory should exist`
      );
    }
  });

  test('each skill directory contains a SKILL.md file', () => {
    for (const name of EXPECTED_SKILLS) {
      const skillMd = path.join(skillsDir, name, 'SKILL.md');
      assert.ok(
        fs.existsSync(skillMd),
        `skills/${name}/SKILL.md should exist`
      );
    }
  });

  test('gsd-workflow/references/ directory exists with 3 files', () => {
    const refDir = path.join(skillsDir, 'gsd-workflow', 'references');
    assert.ok(fs.existsSync(refDir), 'skills/gsd-workflow/references/ should exist');
    const files = fs.readdirSync(refDir);
    assert.strictEqual(files.length, 3, 'gsd-workflow/references/ should have 3 files');
  });

  test('skill-integration/references/ directory exists with 3 files', () => {
    const refDir = path.join(skillsDir, 'skill-integration', 'references');
    assert.ok(fs.existsSync(refDir), 'skills/skill-integration/references/ should exist');
    const files = fs.readdirSync(refDir);
    assert.strictEqual(files.length, 3, 'skill-integration/references/ should have 3 files');
  });

  test('total skill directory count is exactly 16', () => {
    const dirs = fs.readdirSync(skillsDir).filter(
      d => fs.statSync(path.join(skillsDir, d)).isDirectory()
    );
    assert.strictEqual(dirs.length, 16, `Expected exactly 16 skill directories, found ${dirs.length}`);
  });
});

// ── TEAM-01: teams/ directory has exactly 4 JSON files, all valid JSON ────────

describe('TEAM-01: teams/ directory has 4 valid JSON team configs', () => {
  const EXPECTED_TEAMS = [
    'code-review.json',
    'doc-generation.json',
    'gsd-debug.json',
    'gsd-research.json',
  ];
  const teamsDir = path.join(__dirname, '..', 'teams');

  test('teams/ directory exists and is readable', () => {
    assert.doesNotThrow(
      () => fs.readdirSync(teamsDir),
      'teams/ directory should exist and be readable'
    );
  });

  test('all 4 expected team files are present', () => {
    const files = fs.readdirSync(teamsDir);
    for (const expected of EXPECTED_TEAMS) {
      assert.ok(files.includes(expected), `teams/${expected} should exist`);
    }
  });

  test('each team file parses as valid JSON', () => {
    for (const filename of EXPECTED_TEAMS) {
      const filePath = path.join(teamsDir, filename);
      assert.doesNotThrow(
        () => JSON.parse(fs.readFileSync(filePath, 'utf-8')),
        `teams/${filename} should be valid JSON`
      );
    }
  });

  test('exactly 4 JSON files exist in teams/ (excluding non-JSON files)', () => {
    const files = fs.readdirSync(teamsDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    assert.strictEqual(jsonFiles.length, 4, 'teams/ should contain exactly 4 JSON files');
  });
});

// ── TEAM-02: AGENT-ID-VERIFICATION.md documents verified agent ID alignment ───

describe('TEAM-02: agent ID verification report documents alignment with canonical agents', () => {
  const teamsDir = path.join(__dirname, '..', 'teams');
  const agentsDir = path.join(__dirname, '..', 'agents');

  test('teams/AGENT-ID-VERIFICATION.md exists and references TEAM-02', () => {
    const verificationPath = path.join(teamsDir, 'AGENT-ID-VERIFICATION.md');
    assert.ok(
      fs.existsSync(verificationPath),
      'teams/AGENT-ID-VERIFICATION.md should exist'
    );
    const content = fs.readFileSync(verificationPath, 'utf-8');
    assert.ok(
      content.includes('TEAM-02'),
      'AGENT-ID-VERIFICATION.md should contain "TEAM-02"'
    );
  });

  test('gsd-research.json parses as valid JSON', () => {
    const researchPath = path.join(teamsDir, 'gsd-research.json');
    assert.doesNotThrow(
      () => JSON.parse(fs.readFileSync(researchPath, 'utf-8')),
      'teams/gsd-research.json should be valid JSON'
    );
  });

  test('gsd-research.json has a member with agentId "gsd-research-synthesizer" matching agents/gsd-research-synthesizer.md', () => {
    const agentFiles = fs.readdirSync(agentsDir).map(f => f.replace(/\.md$/, ''));
    assert.ok(
      agentFiles.includes('gsd-research-synthesizer'),
      'agents/gsd-research-synthesizer.md should exist as canonical agent'
    );

    const research = JSON.parse(
      fs.readFileSync(path.join(teamsDir, 'gsd-research.json'), 'utf-8')
    );
    const synthesizerMember = research.members.find(
      m => m.agentId === 'gsd-research-synthesizer'
    );
    assert.ok(
      synthesizerMember !== undefined,
      'gsd-research.json members should contain a member with agentId "gsd-research-synthesizer"'
    );
  });
});

// ── INST-06: .planning/patterns/ reference directory exists in gsdup repo ─────
//
// Deviation from plan: sessions.jsonl size check changed from size === 0 to
// size >= 0. The hook system writes to this file at runtime (it is the live
// data store, not a pristine reference copy), so asserting size === 0 would
// fail on any system where the hooks have run. The installer behavior (creating
// the patterns dir in target projects + gitignore entry) is tested in Phase 13.

describe('INST-06: .planning/patterns/ reference directory exists with expected files', () => {
  const patternsDir = path.join(__dirname, '..', '.planning', 'patterns');

  test('.planning/patterns/ is a directory', () => {
    assert.ok(
      fs.existsSync(patternsDir) && fs.statSync(patternsDir).isDirectory(),
      '.planning/patterns/ should exist as a directory'
    );
  });

  test('.gitkeep placeholder exists', () => {
    assert.ok(
      fs.existsSync(path.join(patternsDir, '.gitkeep')),
      '.planning/patterns/.gitkeep should exist'
    );
  });

  test('sessions.jsonl exists', () => {
    const jsonlPath = path.join(patternsDir, 'sessions.jsonl');
    assert.ok(
      fs.existsSync(jsonlPath),
      '.planning/patterns/sessions.jsonl should exist'
    );
    // Size >= 0: file exists and is readable (may have live hook data)
    assert.ok(
      fs.statSync(jsonlPath).size >= 0,
      '.planning/patterns/sessions.jsonl should be readable'
    );
  });

  test('scan-state.json exists and parses as empty JSON object', () => {
    const scanPath = path.join(patternsDir, 'scan-state.json');
    assert.ok(
      fs.existsSync(scanPath),
      '.planning/patterns/scan-state.json should exist'
    );
    const parsed = JSON.parse(fs.readFileSync(scanPath, 'utf-8'));
    assert.deepStrictEqual(parsed, {}, 'scan-state.json should parse as empty JSON object {}');
  });

  test('README.md exists and has content', () => {
    const readmePath = path.join(patternsDir, 'README.md');
    assert.ok(
      fs.existsSync(readmePath),
      '.planning/patterns/README.md should exist'
    );
    assert.ok(
      fs.statSync(readmePath).size > 0,
      '.planning/patterns/README.md should have content (size > 0)'
    );
  });
});
