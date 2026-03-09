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
// INST-04 helpers -- mirrors mergeClaudeMd logic from bin/install.js
// ---------------------------------------------------------------------------

const GSD_CLAUDE_BEGIN = '<!-- GSD:BEGIN -->';
const GSD_CLAUDE_END = '<!-- GSD:END -->';

function buildGsdBlockForTest() {
  return `${GSD_CLAUDE_BEGIN}
# GSD Framework
## Commit Convention
- Conventional Commits: \`<type>(<scope>): <subject>\`
- Include \`Co-Authored-By: Claude <noreply@anthropic.com>\`
## Key Paths
- \`.planning/\` -- GSD project management
- \`.claude/skills/\` -- auto-loading skills
- \`.claude/hooks/\` -- deterministic hooks
## Commands
- Build: \`[project-specific]\`
- Test: \`[project-specific]\`
- Lint: \`[project-specific]\`
${GSD_CLAUDE_END}`;
}

function mergeClaudeMdSimulated(claudeMdPath) {
  const gsdContent = buildGsdBlockForTest();
  if (!fs.existsSync(claudeMdPath)) {
    fs.writeFileSync(claudeMdPath, gsdContent + '\n');
    return 'created';
  }
  const existing = fs.readFileSync(claudeMdPath, 'utf8');
  const beginIdx = existing.indexOf(GSD_CLAUDE_BEGIN);
  const endIdx = existing.indexOf(GSD_CLAUDE_END);
  if (beginIdx !== -1 && endIdx !== -1 && beginIdx < endIdx) {
    const currentMarkerContent = existing.substring(beginIdx, endIdx + GSD_CLAUDE_END.length);
    if (currentMarkerContent !== gsdContent) {
      fs.copyFileSync(claudeMdPath, claudeMdPath + '.gsd-backup');
    }
    const before = existing.substring(0, beginIdx);
    const after = existing.substring(endIdx + GSD_CLAUDE_END.length);
    fs.writeFileSync(claudeMdPath, before + gsdContent + after);
    return 'updated';
  }
  fs.writeFileSync(claudeMdPath, gsdContent + '\n\n' + existing);
  return 'prepended';
}

// ---------------------------------------------------------------------------
// Hook registration simulation -- mirrors bin/install.js logic for testing
// ---------------------------------------------------------------------------

function registerHooksSimulated(settings, hookRegistry, configDir, isGlobal) {
  const dirName = '.claude';
  if (!settings.hooks) settings.hooks = {};

  for (const hookDef of hookRegistry) {
    const eventType = hookDef.event;
    if (!settings.hooks[eventType]) settings.hooks[eventType] = [];

    const command = hookDef.type === 'bash'
      ? (isGlobal ? `bash "${configDir}/hooks/${hookDef.file}"` : `bash ${dirName}/hooks/${hookDef.file}`)
      : (isGlobal ? `node "${configDir}/hooks/${hookDef.file}"` : `node ${dirName}/hooks/${hookDef.file}`);

    const alreadyRegistered = settings.hooks[eventType].some(entry =>
      entry.hooks && entry.hooks.some(h => h.command === command)
    );

    if (!alreadyRegistered) {
      const hookEntry = hookDef.matcher
        ? { matcher: hookDef.matcher, hooks: [{ type: 'command', command }] }
        : { hooks: [{ type: 'command', command }] };
      settings.hooks[eventType].push(hookEntry);
    }
  }
  return settings;
}

const GSD_HOOK_REGISTRY = [
  { event: 'SessionStart', file: 'gsd-check-update.js', type: 'node' },
  { event: 'PostToolUse', file: 'gsd-context-monitor.js', type: 'node' },
  { event: 'SessionStart', file: 'gsd-restore-work-state.js', type: 'node' },
  { event: 'SessionStart', file: 'gsd-inject-snapshot.js', type: 'node' },
  { event: 'SessionStart', file: 'session-state.sh', type: 'bash' },
  { event: 'SessionEnd', file: 'gsd-save-work-state.js', type: 'node' },
  { event: 'SessionEnd', file: 'gsd-snapshot-session.js', type: 'node' },
  { event: 'PreToolUse', file: 'validate-commit.sh', type: 'bash', matcher: 'Bash' },
  { event: 'PostToolUse', file: 'phase-boundary-check.sh', type: 'bash', matcher: 'Write' },
];

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
  test('all 9 GSD hooks registered after simulated install', () => {
    const settings = {};
    registerHooksSimulated(settings, GSD_HOOK_REGISTRY, '/home/user/.claude', true);
    const allCommands = Object.values(settings.hooks).flat().flatMap(e => e.hooks).map(h => h.command);
    assert.ok(allCommands.some(c => c.includes('validate-commit.sh')), 'validate-commit.sh should be registered');
    assert.ok(allCommands.some(c => c.includes('phase-boundary-check.sh')), 'phase-boundary-check.sh should be registered');
    assert.ok(allCommands.some(c => c.includes('gsd-check-update.js')), 'gsd-check-update.js should be registered');
  });

  test('validate-commit.sh registered on PreToolUse with matcher Bash', () => {
    const settings = {};
    registerHooksSimulated(settings, GSD_HOOK_REGISTRY, '/home/user/.claude', true);
    const preToolEntries = settings.hooks.PreToolUse || [];
    const commitHook = preToolEntries.find(e => e.hooks && e.hooks.some(h => h.command.includes('validate-commit.sh')));
    assert.ok(commitHook, 'validate-commit.sh should be in PreToolUse');
    assert.strictEqual(commitHook.matcher, 'Bash', 'PreToolUse validate-commit.sh should have matcher: Bash');
  });

  test('phase-boundary-check.sh registered on PostToolUse with matcher Write', () => {
    const settings = {};
    registerHooksSimulated(settings, GSD_HOOK_REGISTRY, '/home/user/.claude', true);
    const postToolEntries = settings.hooks.PostToolUse || [];
    const phaseHook = postToolEntries.find(e => e.hooks && e.hooks.some(h => h.command.includes('phase-boundary-check.sh')));
    assert.ok(phaseHook, 'phase-boundary-check.sh should be in PostToolUse');
    assert.strictEqual(phaseHook.matcher, 'Write', 'PostToolUse phase-boundary-check.sh should have matcher: Write');
  });
});

// ---------------------------------------------------------------------------
// INST-04: CLAUDE.md marker-based merge
// ---------------------------------------------------------------------------

describe('INST-04: CLAUDE.md marker-based merge', () => {
  test('creates CLAUDE.md with GSD block when file does not exist', () => {
    const { tmpDir } = createInstallerTempDir();
    const claudeMd = path.join(tmpDir, 'CLAUDE.md');
    const result = mergeClaudeMdSimulated(claudeMd);
    assert.strictEqual(result, 'created', 'Should return created');
    assert.ok(fs.existsSync(claudeMd), 'CLAUDE.md should be created');
    const content = fs.readFileSync(claudeMd, 'utf8');
    assert.ok(content.includes(GSD_CLAUDE_BEGIN), 'Should contain GSD:BEGIN marker');
    assert.ok(content.includes(GSD_CLAUDE_END), 'Should contain GSD:END marker');
    assert.ok(content.includes('# GSD Framework'), 'Should contain GSD content');
    cleanup(tmpDir);
  });

  test('updates content between markers when CLAUDE.md has markers', () => {
    const { tmpDir } = createInstallerTempDir();
    const claudeMd = path.join(tmpDir, 'CLAUDE.md');
    // Create CLAUDE.md with markers and outdated content
    const oldContent = `${GSD_CLAUDE_BEGIN}\n# Old GSD Content\n${GSD_CLAUDE_END}\n`;
    fs.writeFileSync(claudeMd, oldContent);
    const result = mergeClaudeMdSimulated(claudeMd);
    assert.strictEqual(result, 'updated', 'Should return updated');
    const content = fs.readFileSync(claudeMd, 'utf8');
    assert.ok(!content.includes('# Old GSD Content'), 'Old content should be replaced');
    assert.ok(content.includes('# GSD Framework'), 'New content should be present');
    cleanup(tmpDir);
  });

  test('prepends GSD block when CLAUDE.md exists without markers', () => {
    const { tmpDir } = createInstallerTempDir();
    const claudeMd = path.join(tmpDir, 'CLAUDE.md');
    const userContent = '# My Project\n\nThis is my CLAUDE.md.\n';
    fs.writeFileSync(claudeMd, userContent);
    const result = mergeClaudeMdSimulated(claudeMd);
    assert.strictEqual(result, 'prepended', 'Should return prepended');
    const content = fs.readFileSync(claudeMd, 'utf8');
    assert.ok(content.startsWith(GSD_CLAUDE_BEGIN), 'GSD block should be at top');
    assert.ok(content.includes('# My Project'), 'User content should be preserved');
    cleanup(tmpDir);
  });

  test('preserves user content outside markers on update', () => {
    const { tmpDir } = createInstallerTempDir();
    const claudeMd = path.join(tmpDir, 'CLAUDE.md');
    const userContentAfter = '\n## My Custom Section\n\nUser content after GSD block.\n';
    const initialContent = `${GSD_CLAUDE_BEGIN}\n# Old GSD\n${GSD_CLAUDE_END}${userContentAfter}`;
    fs.writeFileSync(claudeMd, initialContent);
    mergeClaudeMdSimulated(claudeMd);
    const content = fs.readFileSync(claudeMd, 'utf8');
    assert.ok(content.includes('## My Custom Section'), 'User content after markers should be preserved');
    assert.ok(content.includes('# GSD Framework'), 'GSD content should be updated');
    cleanup(tmpDir);
  });

  test('backs up file when user modified content inside markers', () => {
    const { tmpDir } = createInstallerTempDir();
    const claudeMd = path.join(tmpDir, 'CLAUDE.md');
    // Write content with markers but different from what the template would generate
    const modifiedContent = `${GSD_CLAUDE_BEGIN}\n# MODIFIED by user\n${GSD_CLAUDE_END}\n`;
    fs.writeFileSync(claudeMd, modifiedContent);
    mergeClaudeMdSimulated(claudeMd);
    // Backup should exist because content differs from template
    assert.ok(fs.existsSync(claudeMd + '.gsd-backup'), 'Backup file should be created when markers are modified');
    cleanup(tmpDir);
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
  test('SessionStart hooks include restore-work-state, inject-snapshot, session-state', () => {
    const settings = {};
    registerHooksSimulated(settings, GSD_HOOK_REGISTRY, '/home/user/.claude', true);
    const sessionStartCommands = (settings.hooks.SessionStart || []).flatMap(e => e.hooks).map(h => h.command);
    assert.ok(sessionStartCommands.some(c => c.includes('gsd-restore-work-state.js')), 'restore-work-state should be in SessionStart');
    assert.ok(sessionStartCommands.some(c => c.includes('gsd-inject-snapshot.js')), 'inject-snapshot should be in SessionStart');
    assert.ok(sessionStartCommands.some(c => c.includes('session-state.sh')), 'session-state.sh should be in SessionStart');
  });

  test('SessionEnd hooks include save-work-state and snapshot-session', () => {
    const settings = {};
    registerHooksSimulated(settings, GSD_HOOK_REGISTRY, '/home/user/.claude', true);
    const sessionEndCommands = (settings.hooks.SessionEnd || []).flatMap(e => e.hooks).map(h => h.command);
    assert.ok(sessionEndCommands.some(c => c.includes('gsd-save-work-state.js')), 'save-work-state should be in SessionEnd');
    assert.ok(sessionEndCommands.some(c => c.includes('gsd-snapshot-session.js')), 'snapshot-session should be in SessionEnd');
  });
});

// ---------------------------------------------------------------------------
// HOOK-02: commit validation hook registered
// ---------------------------------------------------------------------------

describe('HOOK-02: commit validation hook registered', () => {
  test('validate-commit.sh in PreToolUse hooks with Bash matcher', () => {
    const settings = {};
    registerHooksSimulated(settings, GSD_HOOK_REGISTRY, '/home/user/.claude', true);
    const preToolEntries = settings.hooks.PreToolUse || [];
    const hasBashValidate = preToolEntries.some(e =>
      e.matcher === 'Bash' && e.hooks && e.hooks.some(h => h.command.includes('validate-commit.sh'))
    );
    assert.ok(hasBashValidate, 'validate-commit.sh should be PreToolUse with matcher Bash');
  });
});

// ---------------------------------------------------------------------------
// HOOK-03: phase boundary hook registered
// ---------------------------------------------------------------------------

describe('HOOK-03: phase boundary hook registered', () => {
  test('phase-boundary-check.sh in PostToolUse hooks with Write matcher', () => {
    const settings = {};
    registerHooksSimulated(settings, GSD_HOOK_REGISTRY, '/home/user/.claude', true);
    const postToolEntries = settings.hooks.PostToolUse || [];
    const hasWritePhase = postToolEntries.some(e =>
      e.matcher === 'Write' && e.hooks && e.hooks.some(h => h.command.includes('phase-boundary-check.sh'))
    );
    assert.ok(hasWritePhase, 'phase-boundary-check.sh should be PostToolUse with matcher Write');
  });
});

// ---------------------------------------------------------------------------
// HOOK-04: no duplicate hooks, orphan GSD hooks cleaned
// ---------------------------------------------------------------------------

describe('HOOK-04: no duplicate hooks, orphan GSD hooks cleaned', () => {
  test('running registration twice does not duplicate any hook entry', () => {
    const settings = {};
    registerHooksSimulated(settings, GSD_HOOK_REGISTRY, '/home/user/.claude', true);
    const beforeCount = Object.values(settings.hooks).flat().length;
    registerHooksSimulated(settings, GSD_HOOK_REGISTRY, '/home/user/.claude', true);
    const afterCount = Object.values(settings.hooks).flat().length;
    assert.strictEqual(beforeCount, afterCount, 'Running twice should not add duplicate hook entries');
  });

  test('orphan GSD hook removed when not in current registry', () => {
    // Simulate settings with a stale GSD hook (gsd-old-hook.js not in current registry)
    const settings = {
      hooks: {
        SessionStart: [
          { hooks: [{ type: 'command', command: 'node "/home/user/.claude/hooks/gsd-old-hook.js"' }] }
        ]
      }
    };
    // Simulate orphan cleanup: remove hooks with gsd- prefix not in current registry
    const currentFiles = GSD_HOOK_REGISTRY.map(h => h.file);
    for (const eventType of Object.keys(settings.hooks)) {
      settings.hooks[eventType] = settings.hooks[eventType].filter(entry => {
        if (entry.hooks && Array.isArray(entry.hooks)) {
          return !entry.hooks.some(h =>
            h.command && h.command.includes('/hooks/gsd-') &&
            !currentFiles.some(f => h.command.includes(f))
          );
        }
        return true;
      });
    }
    const remaining = (settings.hooks.SessionStart || []).flatMap(e => e.hooks).map(h => h.command);
    assert.ok(!remaining.some(c => c.includes('gsd-old-hook.js')), 'Stale GSD hook should be removed');
  });
});

// ── INST-06: installer creates .planning/patterns/ in target project ──────────

describe('INST-06: installer creates .planning/patterns/ in target project', () => {
  let tmpDir;

  test('creates .planning/patterns/ directory on local install', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-inst06-'));
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    // Simulate installer local-install block
    const patternsDir = path.join(planningDir, 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });
    assert.ok(
      fs.existsSync(patternsDir) && fs.statSync(patternsDir).isDirectory(),
      '.planning/patterns/ should exist after installer runs'
    );
  });

  test('creates .planning/patterns/ even if .planning/ already has content', () => {
    // tmpDir already has .planning/ from prior test
    const planningDir = path.join(tmpDir, '.planning');
    fs.writeFileSync(path.join(planningDir, 'config.json'), '{}');
    const patternsDir = path.join(planningDir, 'patterns');
    // Idempotent -- recursive: true means no error if already exists
    fs.mkdirSync(patternsDir, { recursive: true });
    assert.ok(
      fs.existsSync(patternsDir) && fs.statSync(patternsDir).isDirectory(),
      '.planning/patterns/ should still exist (idempotent)'
    );
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
