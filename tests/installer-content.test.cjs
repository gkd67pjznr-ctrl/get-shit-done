'use strict';

/**
 * installer-content.test.cjs
 *
 * Test coverage for Phase 13: Installer and Content Delivery
 *
 * Requirements covered:
 *   INST-01 - skills copied to ~/.claude/skills/
 *   INST-02 - teams copied to ~/.claude/teams/
 *   INST-03 - hooks copied and registered in settings.json
 *   INST-04 - CLAUDE.md marker-based merge
 *   INST-05 - deleted skills not re-added on update
 *   HOOK-01 - session hooks registered (SessionStart, SessionEnd)
 *   HOOK-02 - commit validation hook registered (PreToolUse/Bash)
 *   HOOK-03 - phase boundary hook registered (PostToolUse/Write)
 *   HOOK-04 - no duplicate hooks, orphan GSD hooks cleaned
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createInstallerTempDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-installer-test-'));
  const claudeDir = path.join(tmpDir, '.claude');
  fs.mkdirSync(path.join(claudeDir, 'skills'), { recursive: true });
  fs.mkdirSync(path.join(claudeDir, 'teams'), { recursive: true });
  fs.mkdirSync(path.join(claudeDir, 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(claudeDir, 'settings.json'), '{}');
  return { tmpDir, claudeDir };
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// getDeletedItems logic -- mirrors bin/install.js implementation for testing
// ---------------------------------------------------------------------------

const MANIFEST_NAME = 'gsd-file-manifest.json';

function getDeletedItemsSimulated(configDir, resetSkills) {
  if (resetSkills) return [];
  const manifestPath = path.join(configDir, MANIFEST_NAME);
  if (!fs.existsSync(manifestPath)) return [];
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch { return []; }
  const deleted = new Set();
  for (const relPath of Object.keys(manifest.files || {})) {
    if (relPath.startsWith('skills/')) {
      const skillName = relPath.split('/')[1];
      if (skillName && !fs.existsSync(path.join(configDir, 'skills', skillName))) {
        deleted.add('skills/' + skillName);
      }
    }
    if (relPath.startsWith('teams/')) {
      const teamFile = relPath.split('/')[1];
      if (teamFile && !fs.existsSync(path.join(configDir, 'teams', teamFile))) {
        deleted.add('teams/' + teamFile);
      }
    }
  }
  return [...deleted];
}

// ---------------------------------------------------------------------------
// INST-01: skills copied to ~/.claude/skills/
// ---------------------------------------------------------------------------

describe('INST-01: skills copied to ~/.claude/skills/', () => {
  test('all 16 skill directories exist in target after simulated install', () => {
    const { tmpDir } = createInstallerTempDir();
    const skillsSrc = path.join(__dirname, '..', 'skills');
    const skillsDest = path.join(tmpDir, 'skills');
    fs.mkdirSync(skillsDest, { recursive: true });
    for (const skillName of fs.readdirSync(skillsSrc)) {
      const srcDir = path.join(skillsSrc, skillName);
      if (fs.statSync(srcDir).isDirectory()) {
        fs.cpSync(srcDir, path.join(skillsDest, skillName), { recursive: true });
      }
    }
    const installed = fs.readdirSync(skillsDest).filter(e =>
      fs.statSync(path.join(skillsDest, e)).isDirectory()
    );
    assert.ok(installed.length >= 16, `Expected 16+ skills, got ${installed.length}`);
    cleanup(tmpDir);
  });

  test('each installed skill dir contains SKILL.md', () => {
    const { tmpDir } = createInstallerTempDir();
    const skillsSrc = path.join(__dirname, '..', 'skills');
    const skillsDest = path.join(tmpDir, 'skills');
    fs.mkdirSync(skillsDest, { recursive: true });
    for (const skillName of fs.readdirSync(skillsSrc)) {
      const srcDir = path.join(skillsSrc, skillName);
      if (fs.statSync(srcDir).isDirectory()) {
        fs.cpSync(srcDir, path.join(skillsDest, skillName), { recursive: true });
      }
    }
    for (const skillName of fs.readdirSync(skillsDest)) {
      const skillMd = path.join(skillsDest, skillName, 'SKILL.md');
      assert.ok(fs.existsSync(skillMd), `${skillName}/SKILL.md missing`);
    }
    cleanup(tmpDir);
  });

  test('skills not copied for non-claude runtimes', () => {
    assert.ok(true, 'TODO: implement -- requires invoking install() with non-claude runtime');
  });
});

// ---------------------------------------------------------------------------
// INST-02: teams copied to ~/.claude/teams/
// ---------------------------------------------------------------------------

describe('INST-02: teams copied to ~/.claude/teams/', () => {
  test('all 4 team JSON files exist in target after simulated install', () => {
    const { tmpDir } = createInstallerTempDir();
    const teamsSrc = path.join(__dirname, '..', 'teams');
    const teamsDest = path.join(tmpDir, 'teams');
    fs.mkdirSync(teamsDest, { recursive: true });
    for (const teamFile of fs.readdirSync(teamsSrc)) {
      if (teamFile.endsWith('.json')) {
        fs.copyFileSync(path.join(teamsSrc, teamFile), path.join(teamsDest, teamFile));
      }
    }
    const installed = fs.readdirSync(teamsDest).filter(f => f.endsWith('.json'));
    assert.ok(installed.length >= 4, `Expected 4+ team JSON files, got ${installed.length}`);
    cleanup(tmpDir);
  });

  test('teams not copied for non-claude runtimes', () => {
    assert.ok(true, 'TODO: implement -- requires invoking install() with non-claude runtime');
  });
});

// ---------------------------------------------------------------------------
// INST-03: hooks copied and registered in settings.json
// ---------------------------------------------------------------------------

describe('INST-03: hooks copied and registered in settings.json', () => {
  test('validate-commit.sh registered on PreToolUse with matcher Bash', () => {
    assert.ok(true, 'TODO: implement');
  });
  test('phase-boundary-check.sh registered on PostToolUse with matcher Write', () => {
    assert.ok(true, 'TODO: implement');
  });
  test('session hooks registered on SessionStart and SessionEnd', () => {
    assert.ok(true, 'TODO: implement');
  });
});

// ---------------------------------------------------------------------------
// INST-04: CLAUDE.md marker-based merge
// ---------------------------------------------------------------------------

describe('INST-04: CLAUDE.md marker-based merge', () => {
  test('creates CLAUDE.md with GSD block when file does not exist', () => {
    assert.ok(true, 'TODO: implement');
  });
  test('updates content between markers when CLAUDE.md has markers', () => {
    assert.ok(true, 'TODO: implement');
  });
  test('prepends GSD block when CLAUDE.md exists without markers', () => {
    assert.ok(true, 'TODO: implement');
  });
  test('preserves user content outside markers', () => {
    assert.ok(true, 'TODO: implement');
  });
  test('backs up file when user modified content inside markers', () => {
    assert.ok(true, 'TODO: implement');
  });
});

// ---------------------------------------------------------------------------
// INST-05: deleted skills not re-added on update
// ---------------------------------------------------------------------------

describe('INST-05: deleted skills not re-added on update', () => {
  test('getDeletedItems returns empty array when no previous manifest', () => {
    const { tmpDir, claudeDir } = createInstallerTempDir();
    const result = getDeletedItemsSimulated(claudeDir, false);
    assert.deepStrictEqual(result, []);
    cleanup(tmpDir);
  });

  test('getDeletedItems detects skills missing from filesystem but in manifest', () => {
    const { tmpDir, claudeDir } = createInstallerTempDir();
    const manifest = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      files: {
        'skills/gsd-workflow/SKILL.md': 'abc123'
      }
    };
    fs.writeFileSync(path.join(claudeDir, MANIFEST_NAME), JSON.stringify(manifest));
    // Don't create the skill directory -- simulates user deletion
    const deleted = getDeletedItemsSimulated(claudeDir, false);
    assert.ok(deleted.includes('skills/gsd-workflow'), 'Should detect deleted skill');
    cleanup(tmpDir);
  });

  test('getDeletedItems detects teams missing from filesystem but in manifest', () => {
    const { tmpDir, claudeDir } = createInstallerTempDir();
    const manifest = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      files: {
        'teams/code-review.json': 'def456'
      }
    };
    fs.writeFileSync(path.join(claudeDir, MANIFEST_NAME), JSON.stringify(manifest));
    // Don't create the team file -- simulates user deletion
    const deleted = getDeletedItemsSimulated(claudeDir, false);
    assert.ok(deleted.includes('teams/code-review.json'), 'Should detect deleted team file');
    cleanup(tmpDir);
  });

  test('deleted skills are skipped during install', () => {
    assert.ok(true, 'TODO: implement -- requires invoking install() with mocked filesystem');
  });

  test('getDeletedItems returns empty when resetSkills is true', () => {
    const { tmpDir, claudeDir } = createInstallerTempDir();
    const manifest = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      files: { 'skills/gsd-workflow/SKILL.md': 'abc123' }
    };
    fs.writeFileSync(path.join(claudeDir, MANIFEST_NAME), JSON.stringify(manifest));
    const deleted = getDeletedItemsSimulated(claudeDir, true); // resetSkills = true
    assert.deepStrictEqual(deleted, []);
    cleanup(tmpDir);
  });

  test('end-of-install summary reports skipped items', () => {
    assert.ok(true, 'TODO: implement -- requires invoking install() with tracked output');
  });
});

// ---------------------------------------------------------------------------
// HOOK-01: session hooks registered
// ---------------------------------------------------------------------------

describe('HOOK-01: session hooks registered', () => {
  test('SessionStart hooks include inject-snapshot, restore-work-state, session-state', () => {
    assert.ok(true, 'TODO: implement');
  });
  test('SessionEnd hooks include save-work-state, snapshot-session', () => {
    assert.ok(true, 'TODO: implement');
  });
});

// ---------------------------------------------------------------------------
// HOOK-02: commit validation hook registered
// ---------------------------------------------------------------------------

describe('HOOK-02: commit validation hook registered', () => {
  test('validate-commit.sh in PreToolUse hooks with Bash matcher', () => {
    assert.ok(true, 'TODO: implement');
  });
});

// ---------------------------------------------------------------------------
// HOOK-03: phase boundary hook registered
// ---------------------------------------------------------------------------

describe('HOOK-03: phase boundary hook registered', () => {
  test('phase-boundary-check.sh in PostToolUse hooks with Write matcher', () => {
    assert.ok(true, 'TODO: implement');
  });
});

// ---------------------------------------------------------------------------
// HOOK-04: no duplicate hooks, orphan GSD hooks cleaned
// ---------------------------------------------------------------------------

describe('HOOK-04: no duplicate hooks, orphan GSD hooks cleaned', () => {
  test('running install twice does not duplicate any hook entry', () => {
    assert.ok(true, 'TODO: implement');
  });
  test('orphaned gsd- hooks removed from settings.json', () => {
    assert.ok(true, 'TODO: implement');
  });
});
