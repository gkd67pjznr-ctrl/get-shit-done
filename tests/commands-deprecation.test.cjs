'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const COMMANDS_GSD = path.join(ROOT, 'commands', 'gsd');
const CLAUDE_COMMANDS = path.join(ROOT, '.claude', 'commands');
const SKILLS_DIR = path.join(ROOT, 'skills');

// Helper: read file content
function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

// Helper: check frontmatter name field
function getFrontmatterName(content) {
  const match = content.match(/^---\n[\s\S]*?name:\s*(.+)\n[\s\S]*?---/m);
  return match ? match[1].trim() : null;
}

// ===== CMD-01: /gsd:suggest =====
test('CMD-01: commands/gsd/suggest.md exists', () => {
  const filePath = path.join(COMMANDS_GSD, 'suggest.md');
  assert.ok(fs.existsSync(filePath), 'suggest.md must exist in commands/gsd/');
});

test('CMD-01: suggest.md has correct frontmatter name', () => {
  const content = readFile(path.join(COMMANDS_GSD, 'suggest.md'));
  const name = getFrontmatterName(content);
  assert.equal(name, 'gsd:suggest', 'frontmatter name must be gsd:suggest');
});

test('CMD-01: suggest.md has no skill-creator.json references', () => {
  const content = readFile(path.join(COMMANDS_GSD, 'suggest.md'));
  assert.ok(!content.includes('skill-creator.json'), 'must not reference skill-creator.json');
});

test('CMD-01: suggest.md has no npx skill-creator references', () => {
  const content = readFile(path.join(COMMANDS_GSD, 'suggest.md'));
  assert.ok(!content.includes('npx skill-creator'), 'must not reference npx skill-creator');
});

// ===== CMD-02: /gsd:digest =====
test('CMD-02: commands/gsd/digest.md exists', () => {
  const filePath = path.join(COMMANDS_GSD, 'digest.md');
  assert.ok(fs.existsSync(filePath), 'digest.md must exist in commands/gsd/');
});

test('CMD-02: digest.md has correct frontmatter name', () => {
  const content = readFile(path.join(COMMANDS_GSD, 'digest.md'));
  const name = getFrontmatterName(content);
  assert.equal(name, 'gsd:digest', 'frontmatter name must be gsd:digest');
});

test('CMD-02: digest.md has no skill-creator.json references', () => {
  const content = readFile(path.join(COMMANDS_GSD, 'digest.md'));
  assert.ok(!content.includes('skill-creator.json'), 'must not reference skill-creator.json');
});

test('CMD-02: digest.md has no sc: cross-references', () => {
  const content = readFile(path.join(COMMANDS_GSD, 'digest.md'));
  assert.ok(!content.includes('/sc:'), 'must not reference /sc: commands');
});

// ===== CMD-03: /gsd:session-start =====
test('CMD-03: commands/gsd/session-start.md exists', () => {
  const filePath = path.join(COMMANDS_GSD, 'session-start.md');
  assert.ok(fs.existsSync(filePath), 'session-start.md must exist in commands/gsd/');
});

test('CMD-03: session-start.md has correct frontmatter name', () => {
  const content = readFile(path.join(COMMANDS_GSD, 'session-start.md'));
  const name = getFrontmatterName(content);
  assert.equal(name, 'gsd:session-start', 'frontmatter name must be gsd:session-start');
});

test('CMD-03: session-start.md has no skill-creator.json references', () => {
  const content = readFile(path.join(COMMANDS_GSD, 'session-start.md'));
  assert.ok(!content.includes('skill-creator.json'), 'must not reference skill-creator.json');
});

test('CMD-03: session-start.md has no npx skill-creator references', () => {
  const content = readFile(path.join(COMMANDS_GSD, 'session-start.md'));
  assert.ok(!content.includes('npx skill-creator'), 'must not reference npx skill-creator');
});

// ===== CMD-04: 13 standalone commands in commands/gsd/ =====
const STANDALONE_COMMANDS = [
  { file: 'beautiful-commits.md', name: 'gsd:beautiful-commits' },
  { file: 'code-review.md', name: 'gsd:code-review' },
  { file: 'decision-framework.md', name: 'gsd:decision-framework' },
  { file: 'file-operation-patterns.md', name: 'gsd:file-operation-patterns' },
  { file: 'context-handoff.md', name: 'gsd:context-handoff' },
  { file: 'preflight.md', name: 'gsd:preflight' },
  { file: 'onboard.md', name: 'gsd:onboard' },
  { file: 'trace.md', name: 'gsd:trace' },
  { file: 'dashboard.md', name: 'gsd:dashboard' },
  { file: 'typescript-patterns.md', name: 'gsd:typescript-patterns' },
  { file: 'api-design.md', name: 'gsd:api-design' },
  { file: 'env-setup.md', name: 'gsd:env-setup' },
  { file: 'test-generator.md', name: 'gsd:test-generator' },
];

for (const { file, name } of STANDALONE_COMMANDS) {
  test(`CMD-04: commands/gsd/${file} exists`, () => {
    const filePath = path.join(COMMANDS_GSD, file);
    assert.ok(fs.existsSync(filePath), `${file} must exist in commands/gsd/`);
  });

  test(`CMD-04: ${file} has correct frontmatter name ${name}`, () => {
    const filePath = path.join(COMMANDS_GSD, file);
    if (!fs.existsSync(filePath)) return; // skip if not yet created (Wave 0 only)
    const content = readFile(filePath);
    const actualName = getFrontmatterName(content);
    assert.equal(actualName, name, `frontmatter name in ${file} must be ${name}`);
  });
}

// ===== DEPR-01: No wrap/ commands =====
test('DEPR-01: .claude/commands/wrap/ directory does not exist', () => {
  const wrapDir = path.join(CLAUDE_COMMANDS, 'wrap');
  assert.ok(!fs.existsSync(wrapDir), '.claude/commands/wrap/ must not exist');
});

// ===== DEPR-02: No sc/ commands =====
test('DEPR-02: .claude/commands/sc/ directory does not exist', () => {
  const scDir = path.join(CLAUDE_COMMANDS, 'sc');
  assert.ok(!fs.existsSync(scDir), '.claude/commands/sc/ must not exist');
});

// ===== DEPR-03: No skill-creator.json references in skill files =====
test('DEPR-03: no skill-creator.json references in skills/', () => {
  const skillFiles = [
    'gsd-workflow/SKILL.md',
    'gsd-workflow/references/command-routing.md',
    'gsd-workflow/references/yolo-mode.md',
    'skill-integration/SKILL.md',
    'skill-integration/references/bounded-guardrails.md',
    'session-awareness/SKILL.md',
    'security-hygiene/SKILL.md',
  ];
  for (const rel of skillFiles) {
    const filePath = path.join(SKILLS_DIR, rel);
    if (!fs.existsSync(filePath)) continue;
    const content = readFile(filePath);
    assert.ok(
      !content.includes('skill-creator.json'),
      `${rel} must not reference skill-creator.json`
    );
  }
});

test('DEPR-03: no wrapper_commands field in schema.ts', () => {
  const schemaPath = path.join(ROOT, 'src', 'integration', 'config', 'schema.ts');
  const content = readFile(schemaPath);
  assert.ok(!content.includes('wrapper_commands'), 'schema.ts must not contain wrapper_commands field');
});

// ===== DEPR-04: Deprecation notice exists =====
test('DEPR-04: deprecation notice exists in docs/', () => {
  const noticePath = path.join(ROOT, 'docs', 'skill-creator-deprecation.md');
  assert.ok(fs.existsSync(noticePath), 'docs/skill-creator-deprecation.md must exist');
});
