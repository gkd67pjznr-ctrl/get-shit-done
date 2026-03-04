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

  test('prepends to existing MILESTONES.md (reverse chronological)', () => {
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
    assert.ok(milestones.includes('v1.0 Beta'), 'new entry should be present');
    // New entry should appear BEFORE old entry (reverse chronological)
    const newIdx = milestones.indexOf('v1.0 Beta');
    const oldIdx = milestones.indexOf('v0.9 Alpha');
    assert.ok(newIdx < oldIdx, 'new entry should appear before old entry (reverse chronological)');
  });

  test('three sequential completions maintain reverse-chronological order', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'MILESTONES.md'),
      `# Milestones\n\n## v1.0 First (Shipped: 2025-01-01)\n\n---\n\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.1\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    let result = runGsdTools('milestone complete v1.1 --name Second', tmpDir);
    assert.ok(result.success, `v1.1 failed: ${result.error}`);

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.2\n`
    );

    result = runGsdTools('milestone complete v1.2 --name Third', tmpDir);
    assert.ok(result.success, `v1.2 failed: ${result.error}`);

    const milestones = fs.readFileSync(
      path.join(tmpDir, '.planning', 'MILESTONES.md'), 'utf-8'
    );

    const idx10 = milestones.indexOf('v1.0 First');
    const idx11 = milestones.indexOf('v1.1 Second');
    const idx12 = milestones.indexOf('v1.2 Third');

    assert.ok(idx10 !== -1, 'v1.0 should be present');
    assert.ok(idx11 !== -1, 'v1.1 should be present');
    assert.ok(idx12 !== -1, 'v1.2 should be present');
    assert.ok(idx12 < idx11, 'v1.2 should appear before v1.1');
    assert.ok(idx11 < idx10, 'v1.1 should appear before v1.0');
  });

  test('archives phase directories with --archive-phases flag', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n`
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

    const result = runGsdTools('milestone complete v1.0 --name MVP --archive-phases', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.archived.phases, true, 'phases should be archived');

    // Phase directory moved to milestones/v1.0-phases/
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'milestones', 'v1.0-phases', '01-foundation')),
      'archived phase directory should exist in milestones/v1.0-phases/'
    );

    // Original phase directory no longer exists
    assert.ok(
      !fs.existsSync(p1),
      'original phase directory should no longer exist'
    );
  });

  test('archived REQUIREMENTS.md contains archive header', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements\n\n- [ ] **TEST-01**: core.cjs has tests\n- [ ] **TEST-02**: more tests\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const result = runGsdTools('milestone complete v1.0 --name MVP', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const archivedReq = fs.readFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v1.0-REQUIREMENTS.md'), 'utf-8'
    );
    assert.ok(archivedReq.includes('Requirements Archive: v1.0'), 'should contain archive version');
    assert.ok(archivedReq.includes('SHIPPED'), 'should contain SHIPPED status');
    assert.ok(archivedReq.includes('Archived:'), 'should contain Archived: date line');
    // Original content preserved after header
    assert.ok(archivedReq.includes('# Requirements'), 'original content should be preserved');
    assert.ok(archivedReq.includes('**TEST-01**'), 'original requirement items should be preserved');
  });

  test('STATE.md gets updated during milestone complete', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const result = runGsdTools('milestone complete v1.0 --name Test', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_updated, true, 'state_updated should be true');

    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(state.includes('v1.0 milestone complete'), 'status should be updated to milestone complete');
    assert.ok(
      state.includes('v1.0 milestone completed and archived'),
      'last activity description should reference milestone completion'
    );
  });

  test('handles missing ROADMAP.md gracefully', () => {
    // Only STATE.md — no ROADMAP.md, no REQUIREMENTS.md
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const result = runGsdTools('milestone complete v1.0 --name NoRoadmap', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.archived.roadmap, false, 'roadmap should not be archived');
    assert.strictEqual(output.archived.requirements, false, 'requirements should not be archived');
    assert.strictEqual(output.milestones_updated, true, 'MILESTONES.md should still be created');

    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'MILESTONES.md')),
      'MILESTONES.md should be created even without ROADMAP.md'
    );
  });

  test('scopes stats to current milestone phases only', () => {
    // Set up ROADMAP.md that only references Phase 3 and Phase 4
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.1\n\n### Phase 3: New Feature\n**Goal:** Build it\n\n### Phase 4: Polish\n**Goal:** Ship it\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    // Create phases from PREVIOUS milestone (should be excluded)
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-old-setup');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '---\none-liner: Old setup work\n---\n# Summary\n');
    const p2 = path.join(tmpDir, '.planning', 'phases', '02-old-core');
    fs.mkdirSync(p2, { recursive: true });
    fs.writeFileSync(path.join(p2, '02-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(p2, '02-01-SUMMARY.md'), '---\none-liner: Old core work\n---\n# Summary\n');

    // Create phases for CURRENT milestone (should be included)
    const p3 = path.join(tmpDir, '.planning', 'phases', '03-new-feature');
    fs.mkdirSync(p3, { recursive: true });
    fs.writeFileSync(path.join(p3, '03-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(p3, '03-01-SUMMARY.md'), '---\none-liner: Built new feature\n---\n# Summary\n');
    const p4 = path.join(tmpDir, '.planning', 'phases', '04-polish');
    fs.mkdirSync(p4, { recursive: true });
    fs.writeFileSync(path.join(p4, '04-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(p4, '04-02-PLAN.md'), '# Plan 2\n');
    fs.writeFileSync(path.join(p4, '04-01-SUMMARY.md'), '---\none-liner: Polished UI\n---\n# Summary\n');

    const result = runGsdTools('milestone complete v1.1 --name "Second Release"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // Should only count phases 3 and 4, not 1 and 2
    assert.strictEqual(output.phases, 2, 'should count only milestone phases (3, 4)');
    assert.strictEqual(output.plans, 3, 'should count only plans from phases 3 and 4');
    // Accomplishments should only be from phases 3 and 4
    assert.ok(output.accomplishments.includes('Built new feature'), 'should include current milestone accomplishment');
    assert.ok(output.accomplishments.includes('Polished UI'), 'should include current milestone accomplishment');
    assert.ok(!output.accomplishments.includes('Old setup work'), 'should NOT include previous milestone accomplishment');
    assert.ok(!output.accomplishments.includes('Old core work'), 'should NOT include previous milestone accomplishment');
  });

  test('archive-phases only archives current milestone phases', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.1\n\n### Phase 2: Current Work\n**Goal:** Do it\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    // Phase from previous milestone
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-old');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan\n');

    // Phase from current milestone
    const p2 = path.join(tmpDir, '.planning', 'phases', '02-current');
    fs.mkdirSync(p2, { recursive: true });
    fs.writeFileSync(path.join(p2, '02-01-PLAN.md'), '# Plan\n');

    const result = runGsdTools('milestone complete v1.1 --name Test --archive-phases', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // Phase 2 should be archived
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'milestones', 'v1.1-phases', '02-current')),
      'current milestone phase should be archived'
    );
    // Phase 1 should still be in place (not archived)
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'phases', '01-old')),
      'previous milestone phase should NOT be archived'
    );
  });

  test('phase 1 in roadmap does NOT match directory 10-something (no prefix collision)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n\n### Phase 1: Foundation\n**Goal:** Setup\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(
      path.join(p1, '01-01-SUMMARY.md'),
      '---\none-liner: Foundation work\n---\n'
    );

    const p10 = path.join(tmpDir, '.planning', 'phases', '10-scaling');
    fs.mkdirSync(p10, { recursive: true });
    fs.writeFileSync(path.join(p10, '10-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(
      path.join(p10, '10-01-SUMMARY.md'),
      '---\none-liner: Scaling work\n---\n'
    );

    const result = runGsdTools('milestone complete v1.0 --name MVP', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phases, 1, 'should count only phase 1, not phase 10');
    assert.strictEqual(output.plans, 1, 'should count only plans from phase 1');
    assert.ok(
      output.accomplishments.includes('Foundation work'),
      'should include phase 1 accomplishment'
    );
    assert.ok(
      !output.accomplishments.includes('Scaling work'),
      'should NOT include phase 10 accomplishment'
    );
  });

  test('non-numeric directory is excluded when milestone scoping is active', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n\n### Phase 1: Core\n**Goal:** Build core\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p1 = path.join(tmpDir, '.planning', 'phases', '01-core');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan\n');

    // Non-phase directory — should be excluded
    const misc = path.join(tmpDir, '.planning', 'phases', 'notes');
    fs.mkdirSync(misc, { recursive: true });
    fs.writeFileSync(path.join(misc, 'PLAN.md'), '# Not a phase\n');

    const result = runGsdTools('milestone complete v1.0 --name Test', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phases, 1, 'non-numeric dir should not be counted as a phase');
    assert.strictEqual(output.plans, 1, 'plans from non-numeric dir should not be counted');
  });

  test('large phase numbers (456, 457) scope correctly', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.49\n\n### Phase 456: DACP\n**Goal:** Ship DACP\n\n### Phase 457: Integration\n**Goal:** Integrate\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );

    const p456 = path.join(tmpDir, '.planning', 'phases', '456-dacp');
    fs.mkdirSync(p456, { recursive: true });
    fs.writeFileSync(path.join(p456, '456-01-PLAN.md'), '# Plan\n');

    const p457 = path.join(tmpDir, '.planning', 'phases', '457-integration');
    fs.mkdirSync(p457, { recursive: true });
    fs.writeFileSync(path.join(p457, '457-01-PLAN.md'), '# Plan\n');

    // Phase 45 from prior milestone — should not match
    const p45 = path.join(tmpDir, '.planning', 'phases', '45-old');
    fs.mkdirSync(p45, { recursive: true });
    fs.writeFileSync(path.join(p45, 'PLAN.md'), '# Plan\n');

    const result = runGsdTools('milestone complete v1.49 --name DACP', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phases, 2, 'should count only phases 456 and 457');
  });

  test('handles empty phases directory', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      `# State\n\n**Status:** In progress\n**Last Activity:** 2025-01-01\n**Last Activity Description:** Working\n`
    );
    // phases directory exists but is empty (from createTempProject)

    const result = runGsdTools('milestone complete v1.0 --name EmptyPhases', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phases, 0, 'phase count should be 0');
    assert.strictEqual(output.plans, 0, 'plan count should be 0');
    assert.strictEqual(output.tasks, 0, 'task count should be 0');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// requirements mark-complete command
// ─────────────────────────────────────────────────────────────────────────────

describe('requirements mark-complete command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  // ─── helpers ──────────────────────────────────────────────────────────────

  function writeRequirements(tmpDir, content) {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), content, 'utf-8');
  }

  function readRequirements(tmpDir) {
    return fs.readFileSync(path.join(tmpDir, '.planning', 'REQUIREMENTS.md'), 'utf-8');
  }

  const STANDARD_REQUIREMENTS = `# Requirements

## Test Coverage
- [ ] **TEST-01**: core.cjs has tests for loadConfig
- [ ] **TEST-02**: core.cjs has tests for resolveModelInternal
- [x] **TEST-03**: core.cjs has tests for escapeRegex (already complete)

## Bug Regressions
- [ ] **REG-01**: Test confirms loadConfig returns model_overrides

## Infrastructure
- [ ] **INFRA-01**: GitHub Actions workflow runs tests

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | Phase 1 | Pending |
| TEST-02 | Phase 1 | Pending |
| TEST-03 | Phase 1 | Complete |
| REG-01 | Phase 1 | Pending |
| INFRA-01 | Phase 6 | Pending |
`;

  // ─── tests ────────────────────────────────────────────────────────────────

  test('marks single requirement complete (checkbox + table)', () => {
    writeRequirements(tmpDir, STANDARD_REQUIREMENTS);

    const result = runGsdTools('requirements mark-complete TEST-01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, true);
    assert.ok(output.marked_complete.includes('TEST-01'), 'TEST-01 should be marked complete');

    const content = readRequirements(tmpDir);
    assert.ok(content.includes('- [x] **TEST-01**'), 'checkbox should be checked');
    assert.ok(content.includes('| TEST-01 | Phase 1 | Complete |'), 'table row should be Complete');
    // Other checkboxes unchanged
    assert.ok(content.includes('- [ ] **TEST-02**'), 'TEST-02 should remain unchecked');
  });

  test('handles mixed prefixes in single call (TEST-XX, REG-XX, INFRA-XX)', () => {
    writeRequirements(tmpDir, STANDARD_REQUIREMENTS);

    const result = runGsdTools('requirements mark-complete TEST-01,REG-01,INFRA-01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.marked_complete.length, 3, 'should mark 3 requirements complete');
    assert.ok(output.marked_complete.includes('TEST-01'));
    assert.ok(output.marked_complete.includes('REG-01'));
    assert.ok(output.marked_complete.includes('INFRA-01'));

    const content = readRequirements(tmpDir);
    assert.ok(content.includes('- [x] **TEST-01**'), 'TEST-01 checkbox should be checked');
    assert.ok(content.includes('- [x] **REG-01**'), 'REG-01 checkbox should be checked');
    assert.ok(content.includes('- [x] **INFRA-01**'), 'INFRA-01 checkbox should be checked');
    assert.ok(content.includes('| TEST-01 | Phase 1 | Complete |'), 'TEST-01 table should be Complete');
    assert.ok(content.includes('| REG-01 | Phase 1 | Complete |'), 'REG-01 table should be Complete');
    assert.ok(content.includes('| INFRA-01 | Phase 6 | Complete |'), 'INFRA-01 table should be Complete');
  });

  test('accepts space-separated IDs', () => {
    writeRequirements(tmpDir, STANDARD_REQUIREMENTS);

    const result = runGsdTools('requirements mark-complete TEST-01 TEST-02', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.marked_complete.length, 2, 'should mark 2 requirements complete');

    const content = readRequirements(tmpDir);
    assert.ok(content.includes('- [x] **TEST-01**'), 'TEST-01 should be checked');
    assert.ok(content.includes('- [x] **TEST-02**'), 'TEST-02 should be checked');
  });

  test('accepts bracket-wrapped IDs [REQ-01, REQ-02]', () => {
    writeRequirements(tmpDir, STANDARD_REQUIREMENTS);

    const result = runGsdTools('requirements mark-complete [TEST-01,TEST-02]', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.marked_complete.length, 2, 'should mark 2 requirements complete');

    const content = readRequirements(tmpDir);
    assert.ok(content.includes('- [x] **TEST-01**'), 'TEST-01 should be checked');
    assert.ok(content.includes('- [x] **TEST-02**'), 'TEST-02 should be checked');
  });

  test('returns not_found for invalid IDs while updating valid ones', () => {
    writeRequirements(tmpDir, STANDARD_REQUIREMENTS);

    const result = runGsdTools('requirements mark-complete TEST-01,FAKE-99', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, true, 'should still update valid IDs');
    assert.ok(output.marked_complete.includes('TEST-01'), 'TEST-01 should be marked complete');
    assert.ok(output.not_found.includes('FAKE-99'), 'FAKE-99 should be in not_found');
    assert.strictEqual(output.total, 2, 'total should reflect all IDs attempted');
  });

  test('idempotent — re-marking already-complete requirement does not corrupt', () => {
    writeRequirements(tmpDir, STANDARD_REQUIREMENTS);

    // TEST-03 already has [x] and Complete in the fixture
    const result = runGsdTools('requirements mark-complete TEST-03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    // Regex only matches [ ] (space), not [x], so TEST-03 goes to not_found
    assert.ok(output.not_found.includes('TEST-03'), 'already-complete ID should be in not_found');

    const content = readRequirements(tmpDir);
    // File should not be corrupted — no [xx] or doubled markers
    assert.ok(content.includes('- [x] **TEST-03**'), 'existing [x] should remain intact');
    assert.ok(!content.includes('[xx]'), 'should not have doubled x markers');
    assert.ok(!content.includes('- [x] [x]'), 'should not have duplicate checkbox');
  });

  test('missing REQUIREMENTS.md returns expected error structure', () => {
    // createTempProject does not create REQUIREMENTS.md — so it's already missing

    const result = runGsdTools('requirements mark-complete TEST-01', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, false, 'updated should be false');
    assert.strictEqual(output.reason, 'REQUIREMENTS.md not found', 'should report file not found');
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
// Phase 09 Plan 02 — CLI routing integration tests
// ─────────────────────────────────────────────────────────────────────────────

const { runGsdToolsFull } = require('./helpers.cjs');

describe('milestone new-workspace via CLI routing (Plan 02)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('milestone new-workspace via CLI creates workspace directory tree', () => {
    const result = runGsdToolsFull(['milestone', 'new-workspace', 'v3.0', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true, 'created should be true');
    assert.strictEqual(output.version, 'v3.0');

    const workspaceDir = path.join(tmpDir, '.planning', 'milestones', 'v3.0');
    assert.ok(fs.existsSync(workspaceDir), 'workspace dir should exist');
    assert.ok(fs.existsSync(path.join(workspaceDir, 'STATE.md')), 'STATE.md should exist');
    assert.ok(fs.existsSync(path.join(workspaceDir, 'ROADMAP.md')), 'ROADMAP.md should exist');
    assert.ok(fs.existsSync(path.join(workspaceDir, 'REQUIREMENTS.md')), 'REQUIREMENTS.md should exist');
    assert.ok(fs.existsSync(path.join(workspaceDir, 'conflict.json')), 'conflict.json should exist');
    assert.ok(fs.existsSync(path.join(workspaceDir, 'phases')), 'phases/ should exist');
    assert.ok(fs.existsSync(path.join(workspaceDir, 'research')), 'research/ should exist');
  });

  test('milestone update-manifest via CLI updates files_touched in conflict.json', () => {
    // Create workspace first
    runGsdToolsFull(['milestone', 'new-workspace', 'v3.0', '--raw'], tmpDir);

    // Update manifest with two files
    const result = runGsdToolsFull(['milestone', 'update-manifest', 'v3.0', '--files', 'a.js', 'b.js', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const conflictPath = path.join(tmpDir, '.planning', 'milestones', 'v3.0', 'conflict.json');
    const conflict = JSON.parse(fs.readFileSync(conflictPath, 'utf-8'));
    assert.ok(conflict.files_touched.includes('a.js'), 'a.js should be in files_touched');
    assert.ok(conflict.files_touched.includes('b.js'), 'b.js should be in files_touched');
  });

  test('milestone complete marks workspace conflict.json as complete', () => {
    // Create workspace
    runGsdToolsFull(['milestone', 'new-workspace', 'v3.0', '--raw'], tmpDir);

    // Create minimal ROADMAP.md and STATE.md required by cmdMilestoneComplete
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap v3.0\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# State\n\n**Status:** In progress\n**Last Activity:** 2026-02-24\n**Last Activity Description:** Working\n'
    );

    const result = runGsdToolsFull(['milestone', 'complete', 'v3.0', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.conflict_marked_complete, true, 'conflict_marked_complete should be true');

    const conflictPath = path.join(tmpDir, '.planning', 'milestones', 'v3.0', 'conflict.json');
    const conflict = JSON.parse(fs.readFileSync(conflictPath, 'utf-8'));
    assert.strictEqual(conflict.status, 'complete', 'conflict.json status should be complete');
    assert.ok(conflict.completed_at, 'conflict.json should have completed_at timestamp');
  });

  test('milestone complete without workspace succeeds (old-style compat, conflict_marked_complete is false)', () => {
    // No workspace created — old-style project
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap v1.0\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# State\n\n**Status:** In progress\n**Last Activity:** 2026-02-24\n**Last Activity Description:** Working\n'
    );

    const result = runGsdToolsFull(['milestone', 'complete', 'v1.0', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.conflict_marked_complete, false, 'conflict_marked_complete should be false for old-style projects');
  });
});

describe('init new-milestone returns milestones_dir fields', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('init new-milestone returns milestones_dir and milestones_dir_exists', () => {
    const result = runGsdToolsFull(['init', 'new-milestone', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.milestones_dir, '.planning/milestones', 'milestones_dir should be the standard path');
    assert.strictEqual(typeof output.milestones_dir_exists, 'boolean', 'milestones_dir_exists should be a boolean');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// milestone workspace finalization (FLOW-02)
// ─────────────────────────────────────────────────────────────────────────────

describe('milestone workspace finalization (cmdMilestoneComplete)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('updates workspace ROADMAP plan checkboxes before archiving', () => {
    // Root ROADMAP.md (required by cmdMilestoneComplete)
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap v2.0\n\n### Phase 8: Feature\n**Goal:** Build features\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# State\n\n**Status:** In progress\n**Last Activity:** 2026-02-25\n**Last Activity Description:** Working\n'
    );

    // Create workspace with ROADMAP.md containing unchecked plan lines
    const workspaceDir = path.join(tmpDir, '.planning', 'milestones', 'v2.0');
    fs.mkdirSync(workspaceDir, { recursive: true });
    fs.writeFileSync(
      path.join(workspaceDir, 'ROADMAP.md'),
      `# Roadmap v2.0

### Phase 8: Feature
**Goal:** Build features
**Plans:** 1/1 plans complete
Plans:
- [ ] 08-01-PLAN.md — Feature plan

| 8 | Feature | 1/1 | Complete | 2026-02-25 |
`
    );
    fs.writeFileSync(
      path.join(workspaceDir, 'conflict.json'),
      JSON.stringify({ version: 'v2.0', created_at: '2026-02-25', status: 'active', files_touched: [] }, null, 2)
    );

    // Create a phase dir in the workspace phases dir (not root) so cmdMilestoneComplete finds it
    const workspacePhasesDir = path.join(workspaceDir, 'phases', '08-feature');
    fs.mkdirSync(workspacePhasesDir, { recursive: true });
    fs.writeFileSync(path.join(workspacePhasesDir, '08-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(workspacePhasesDir, '08-01-SUMMARY.md'), '# Summary');

    const result = runGsdToolsFull(['milestone', 'complete', 'v2.0', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // The workspace ROADMAP should have [x] plan checkboxes after finalization
    const workspaceRoadmap = fs.readFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v2.0', 'ROADMAP.md'), 'utf-8'
    );
    assert.ok(
      workspaceRoadmap.includes('- [x] 08-01-PLAN.md'),
      `Expected [x] plan checkbox in workspace ROADMAP, got:\n${workspaceRoadmap}`
    );
  });

  test('updates workspace ROADMAP phase-level checkboxes before archiving', () => {
    // Root ROADMAP.md
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap v2.0\n\n### Phase 8: Feature\n**Goal:** Build features\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# State\n\n**Status:** In progress\n**Last Activity:** 2026-02-25\n**Last Activity Description:** Working\n'
    );

    // Create workspace with ROADMAP.md containing unchecked phase-level checkbox
    const workspaceDir = path.join(tmpDir, '.planning', 'milestones', 'v2.0');
    fs.mkdirSync(workspaceDir, { recursive: true });
    fs.writeFileSync(
      path.join(workspaceDir, 'ROADMAP.md'),
      `# Roadmap v2.0

## Phases

- [ ] **Phase 8: Feature**

### Phase 8: Feature
**Goal:** Build features
**Plans:** 1/1 plans complete
Plans:
- [ ] 08-01-PLAN.md — Feature plan
`
    );
    fs.writeFileSync(
      path.join(workspaceDir, 'conflict.json'),
      JSON.stringify({ version: 'v2.0', created_at: '2026-02-25', status: 'active', files_touched: [] }, null, 2)
    );

    // Complete phase — create in workspace phases dir so cmdMilestoneComplete finds it
    const workspacePhasesDir = path.join(workspaceDir, 'phases', '08-feature');
    fs.mkdirSync(workspacePhasesDir, { recursive: true });
    fs.writeFileSync(path.join(workspacePhasesDir, '08-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(workspacePhasesDir, '08-01-SUMMARY.md'), '# Summary');

    const result = runGsdToolsFull(['milestone', 'complete', 'v2.0', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const workspaceRoadmap = fs.readFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v2.0', 'ROADMAP.md'), 'utf-8'
    );
    assert.ok(
      workspaceRoadmap.includes('[x]') && workspaceRoadmap.includes('Phase 8'),
      `Expected [x] phase checkbox in workspace ROADMAP, got:\n${workspaceRoadmap}`
    );
  });

  test('skips finalization gracefully when no workspace exists (legacy mode)', () => {
    // NO workspace directory — legacy project
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap v2.0\n\n### Phase 8: Feature\n**Goal:** Build features\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# State\n\n**Status:** In progress\n**Last Activity:** 2026-02-25\n**Last Activity Description:** Working\n'
    );

    // No workspace directory created
    const result = runGsdToolsFull(['milestone', 'complete', 'v2.0', '--raw'], tmpDir);
    assert.ok(result.success, `Command should not throw for legacy mode: ${result.error}`);

    // Standard archive should still work
    assert.ok(
      fs.existsSync(path.join(tmpDir, '.planning', 'milestones', 'v2.0-ROADMAP.md')),
      'archived root ROADMAP should still be created'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validate consistency command
// ─────────────────────────────────────────────────────────────────────────────

