/**
 * GSD Tools Tests - Roadmap
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, createConcurrentProject, cleanup } = require('./helpers.cjs');

describe('roadmap get-phase command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('extracts phase section from ROADMAP.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0

## Phases

### Phase 1: Foundation
**Goal:** Set up project infrastructure
**Plans:** 2 plans

Some description here.

### Phase 2: API
**Goal:** Build REST API
**Plans:** 3 plans
`
    );

    const result = runGsdTools('roadmap get-phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, true, 'phase should be found');
    assert.strictEqual(output.phase_number, '1', 'phase number correct');
    assert.strictEqual(output.phase_name, 'Foundation', 'phase name extracted');
    assert.strictEqual(output.goal, 'Set up project infrastructure', 'goal extracted');
  });

  test('returns not found for missing phase', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0

### Phase 1: Foundation
**Goal:** Set up project
`
    );

    const result = runGsdTools('roadmap get-phase 5', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, false, 'phase should not be found');
  });

  test('handles decimal phase numbers', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 2: Main
**Goal:** Main work

### Phase 2.1: Hotfix
**Goal:** Emergency fix
`
    );

    const result = runGsdTools('roadmap get-phase 2.1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, true, 'decimal phase should be found');
    assert.strictEqual(output.phase_name, 'Hotfix', 'phase name correct');
    assert.strictEqual(output.goal, 'Emergency fix', 'goal extracted');
  });

  test('extracts full section content', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Setup
**Goal:** Initialize everything

This phase covers:
- Database setup
- Auth configuration
- CI/CD pipeline

### Phase 2: Build
**Goal:** Build features
`
    );

    const result = runGsdTools('roadmap get-phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.section.includes('Database setup'), 'section includes description');
    assert.ok(output.section.includes('CI/CD pipeline'), 'section includes all bullets');
    assert.ok(!output.section.includes('Phase 2'), 'section does not include next phase');
  });

  test('handles missing ROADMAP.md gracefully', () => {
    const result = runGsdTools('roadmap get-phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, false, 'should return not found');
    assert.strictEqual(output.error, 'ROADMAP.md not found', 'should explain why');
  });

  test('accepts ## phase headers (two hashes)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0

## Phase 1: Foundation
**Goal:** Set up project infrastructure
**Plans:** 2 plans

## Phase 2: API
**Goal:** Build REST API
`
    );

    const result = runGsdTools('roadmap get-phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, true, 'phase with ## header should be found');
    assert.strictEqual(output.phase_name, 'Foundation', 'phase name extracted');
    assert.strictEqual(output.goal, 'Set up project infrastructure', 'goal extracted');
  });

  test('detects malformed ROADMAP with summary list but no detail sections', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0

## Phases

- [ ] **Phase 1: Foundation** - Set up project
- [ ] **Phase 2: API** - Build REST API
`
    );

    const result = runGsdTools('roadmap get-phase 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.found, false, 'phase should not be found');
    assert.strictEqual(output.error, 'malformed_roadmap', 'should identify malformed roadmap');
    assert.ok(output.message.includes('missing'), 'should explain the issue');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase next-decimal command
// ─────────────────────────────────────────────────────────────────────────────


describe('roadmap analyze command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('missing ROADMAP.md returns error', () => {
    const result = runGsdTools('roadmap analyze', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.error, 'ROADMAP.md not found');
  });

  test('parses phases with goals and disk status', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap v1.0

### Phase 1: Foundation
**Goal:** Set up infrastructure

### Phase 2: Authentication
**Goal:** Add user auth

### Phase 3: Features
**Goal:** Build core features
`
    );

    // Create phase dirs with varying completion
    const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');

    const p2 = path.join(tmpDir, '.planning', 'phases', '02-authentication');
    fs.mkdirSync(p2, { recursive: true });
    fs.writeFileSync(path.join(p2, '02-01-PLAN.md'), '# Plan');

    const result = runGsdTools('roadmap analyze', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_count, 3, 'should find 3 phases');
    assert.strictEqual(output.phases[0].disk_status, 'complete', 'phase 1 complete');
    assert.strictEqual(output.phases[1].disk_status, 'planned', 'phase 2 planned');
    assert.strictEqual(output.phases[2].disk_status, 'no_directory', 'phase 3 no directory');
    assert.strictEqual(output.completed_phases, 1, '1 phase complete');
    assert.strictEqual(output.total_plans, 2, '2 total plans');
    assert.strictEqual(output.total_summaries, 1, '1 total summary');
    assert.strictEqual(output.progress_percent, 50, '50% complete');
    assert.strictEqual(output.current_phase, '2', 'current phase is 2');
  });

  test('extracts goals and dependencies', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 1: Setup
**Goal:** Initialize project
**Depends on:** Nothing

### Phase 2: Build
**Goal:** Build features
**Depends on:** Phase 1
`
    );

    const result = runGsdTools('roadmap analyze', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phases[0].goal, 'Initialize project');
    assert.strictEqual(output.phases[0].depends_on, 'Nothing');
    assert.strictEqual(output.phases[1].goal, 'Build features');
    assert.strictEqual(output.phases[1].depends_on, 'Phase 1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// milestone-scoped roadmap commands (INTG-02)
// ─────────────────────────────────────────────────────────────────────────────

describe('milestone-scoped roadmap commands (INTG-02)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createConcurrentProject('v2.0');
    // Write a real ROADMAP.md in the milestone workspace
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v2.0', 'ROADMAP.md'),
      `# Roadmap v2.0\n\n## Phases\n\n### Phase 1: Foundation\n**Goal:** Set up infrastructure\n\n### Phase 2: Features\n**Goal:** Build features\n`
    );
    // Create phase directories in milestone workspace
    fs.mkdirSync(path.join(tmpDir, '.planning', 'milestones', 'v2.0', 'phases', '01-foundation'), { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('roadmap get-phase reads milestone-scoped ROADMAP.md', () => {
    const result = runGsdTools('--milestone v2.0 roadmap get-phase 1', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error || ''}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.found, true, 'Phase 1 should be found in milestone ROADMAP');
    assert.strictEqual(parsed.phase_name, 'Foundation');
    assert.strictEqual(parsed.goal, 'Set up infrastructure');
  });

  test('roadmap get-phase returns not found for missing phase in milestone', () => {
    const result = runGsdTools('--milestone v2.0 roadmap get-phase 99', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error || ''}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.found, false);
  });

  test('roadmap analyze reads milestone-scoped ROADMAP.md', () => {
    const result = runGsdTools('--milestone v2.0 roadmap analyze --raw', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error || ''}`);
    const parsed = JSON.parse(result.output);
    assert.ok(Array.isArray(parsed.phases), 'phases should be an array');
    assert.ok(parsed.phases.length >= 1, `Should find phases in milestone ROADMAP: ${JSON.stringify(parsed.phases)}`);
    // Verify it found our milestone-specific phases
    const phase1 = parsed.phases.find(p => p.number === '1');
    assert.ok(phase1, 'Phase 1 should exist');
    assert.strictEqual(phase1.name, 'Foundation');
  });

  test('roadmap analyze without --milestone reads root ROADMAP.md', () => {
    // Write a different ROADMAP at root level to prove it reads the right one
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Root Roadmap\n\n### Phase 1: Root Phase\n**Goal:** Root goal\n'
    );
    const result = runGsdTools('roadmap analyze --raw', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error || ''}`);
    const parsed = JSON.parse(result.output);
    const phase1 = parsed.phases.find(p => p.number === '1');
    assert.ok(phase1, 'Phase 1 should exist');
    assert.strictEqual(phase1.name, 'Root Phase', 'Should read from root ROADMAP, not milestone');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// plan-level checkbox update (FLOW-01)
// ─────────────────────────────────────────────────────────────────────────────

describe('plan-level checkbox update (cmdRoadmapUpdatePlanProgress)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('flips plan-level checkboxes to [x] when phase is complete', () => {
    // Create ROADMAP.md with an unchecked plan-level checkbox
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 5: Config Foundation
**Goal:** Configure everything
**Plans:** 1/1 plans complete
Plans:
- [ ] 05-01-PLAN.md — Some description
`
    );

    // Create phase directory with 1 PLAN and 1 SUMMARY (isComplete = true)
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '05-config-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '05-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phaseDir, '05-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('roadmap update-plan-progress 5 --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const roadmapContent = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmapContent.includes('- [x] 05-01-PLAN.md'), `Expected [x] checkbox, got:\n${roadmapContent}`);
  });

  test('flips multiple plan checkboxes when phase has multiple plans', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 11: Multi-plan
**Goal:** Multi plan test
**Plans:** 3/3 plans complete
Plans:
- [ ] 11-01-PLAN.md — Plan A
- [ ] 11-02-PLAN.md — Plan B
- [ ] 11-03-PLAN.md — Plan C
`
    );

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '11-multi-plan');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '11-01-PLAN.md'), '# Plan A');
    fs.writeFileSync(path.join(phaseDir, '11-01-SUMMARY.md'), '# Summary A');
    fs.writeFileSync(path.join(phaseDir, '11-02-PLAN.md'), '# Plan B');
    fs.writeFileSync(path.join(phaseDir, '11-02-SUMMARY.md'), '# Summary B');
    fs.writeFileSync(path.join(phaseDir, '11-03-PLAN.md'), '# Plan C');
    fs.writeFileSync(path.join(phaseDir, '11-03-SUMMARY.md'), '# Summary C');

    const result = runGsdTools('roadmap update-plan-progress 11 --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const roadmapContent = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmapContent.includes('- [x] 11-01-PLAN.md'), `Expected [x] for 11-01, got:\n${roadmapContent}`);
    assert.ok(roadmapContent.includes('- [x] 11-02-PLAN.md'), `Expected [x] for 11-02, got:\n${roadmapContent}`);
    assert.ok(roadmapContent.includes('- [x] 11-03-PLAN.md'), `Expected [x] for 11-03, got:\n${roadmapContent}`);
  });

  test('handles decimal phase numbers (e.g., 16.1)', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 16.1: Planning Cleanup
**Goal:** Cleanup
**Plans:** 1/1 plans complete
Plans:
- [ ] 16.1-01-PLAN.md — Cleanup
`
    );

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '16.1-planning-cleanup');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '16.1-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phaseDir, '16.1-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('roadmap update-plan-progress 16.1 --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const roadmapContent = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmapContent.includes('- [x] 16.1-01-PLAN.md'), `Expected [x] for decimal phase, got:\n${roadmapContent}`);
  });

  test('does not flip plan checkboxes when phase is incomplete', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap

### Phase 7: Incomplete
**Goal:** Not done yet
**Plans:** 1/2 plans executed
Plans:
- [ ] 07-01-PLAN.md — Plan A
- [ ] 07-02-PLAN.md — Plan B
`
    );

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '07-incomplete');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '07-01-PLAN.md'), '# Plan A');
    fs.writeFileSync(path.join(phaseDir, '07-01-SUMMARY.md'), '# Summary A');
    fs.writeFileSync(path.join(phaseDir, '07-02-PLAN.md'), '# Plan B');
    // No SUMMARY for 07-02 — incomplete

    const result = runGsdTools('roadmap update-plan-progress 7 --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const roadmapContent = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmapContent.includes('- [ ] 07-01-PLAN.md'), `Expected unchecked for incomplete phase, got:\n${roadmapContent}`);
    assert.ok(roadmapContent.includes('- [ ] 07-02-PLAN.md'), `Expected unchecked for incomplete phase, got:\n${roadmapContent}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// phase add command
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// milestone-scoped roadmap update-plan-progress
// ─────────────────────────────────────────────────────────────────────────────

describe('milestone-scoped roadmap update-plan-progress', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createConcurrentProject('v3.0');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('cmdRoadmapUpdatePlanProgress with milestoneScope reads/writes workspace ROADMAP', () => {
    // Write ROADMAP.md in the milestone workspace
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v3.0', 'ROADMAP.md'),
      `# Roadmap v3.0\n\n### Phase 3.1: Test\n**Goal:** Test\n**Plans:** 1/1 plans complete\nPlans:\n- [ ] 3.1-01-PLAN.md -- Some desc\n`
    );

    // Create phase directory with both PLAN and SUMMARY (complete)
    const phaseDir = path.join(tmpDir, '.planning', 'milestones', 'v3.0', 'phases', '3.1-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '3.1-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phaseDir, '3.1-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('--milestone v3.0 roadmap update-plan-progress 3.1 --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // Read the milestone workspace ROADMAP.md and assert checkbox was flipped
    const roadmapContent = fs.readFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v3.0', 'ROADMAP.md'),
      'utf-8'
    );
    assert.ok(
      roadmapContent.includes('- [x] 3.1-01-PLAN.md'),
      `Expected [x] checkbox in milestone ROADMAP, got:\n${roadmapContent}`
    );
  });
});

