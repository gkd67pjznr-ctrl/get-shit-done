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
    const phaseDir = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');

    const result = runGsdTools('init execute-phase 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/milestones/v1.0/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/milestones/v1.0/ROADMAP.md');
    assert.strictEqual(output.config_path, '.planning/config.json');
  });

  test('init plan-phase returns file paths', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-CONTEXT.md'), '# Phase Context');
    fs.writeFileSync(path.join(phaseDir, '03-RESEARCH.md'), '# Research Findings');
    fs.writeFileSync(path.join(phaseDir, '03-VERIFICATION.md'), '# Verification');
    fs.writeFileSync(path.join(phaseDir, '03-UAT.md'), '# UAT');

    const result = runGsdTools('init plan-phase 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/milestones/v1.0/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/milestones/v1.0/ROADMAP.md');
    assert.strictEqual(output.requirements_path, '.planning/milestones/v1.0/REQUIREMENTS.md');
    assert.strictEqual(output.context_path, '.planning/milestones/v1.0/phases/03-api/03-CONTEXT.md');
    assert.strictEqual(output.research_path, '.planning/milestones/v1.0/phases/03-api/03-RESEARCH.md');
    assert.strictEqual(output.verification_path, '.planning/milestones/v1.0/phases/03-api/03-VERIFICATION.md');
    assert.strictEqual(output.uat_path, '.planning/milestones/v1.0/phases/03-api/03-UAT.md');
  });

  test('init progress returns file paths', () => {
    const result = runGsdTools('init progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/milestones/v1.0/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/milestones/v1.0/ROADMAP.md');
    assert.strictEqual(output.project_path, '.planning/PROJECT.md');
    assert.strictEqual(output.config_path, '.planning/config.json');
  });

  test('init phase-op returns core and optional phase file paths', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-CONTEXT.md'), '# Phase Context');
    fs.writeFileSync(path.join(phaseDir, '03-RESEARCH.md'), '# Research');
    fs.writeFileSync(path.join(phaseDir, '03-VERIFICATION.md'), '# Verification');
    fs.writeFileSync(path.join(phaseDir, '03-UAT.md'), '# UAT');

    const result = runGsdTools('init phase-op 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.state_path, '.planning/milestones/v1.0/STATE.md');
    assert.strictEqual(output.roadmap_path, '.planning/milestones/v1.0/ROADMAP.md');
    assert.strictEqual(output.requirements_path, '.planning/milestones/v1.0/REQUIREMENTS.md');
    assert.strictEqual(output.context_path, '.planning/milestones/v1.0/phases/03-api/03-CONTEXT.md');
    assert.strictEqual(output.research_path, '.planning/milestones/v1.0/phases/03-api/03-RESEARCH.md');
    assert.strictEqual(output.verification_path, '.planning/milestones/v1.0/phases/03-api/03-VERIFICATION.md');
    assert.strictEqual(output.uat_path, '.planning/milestones/v1.0/phases/03-api/03-UAT.md');
  });

  test('init plan-phase omits optional paths if files missing', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });

    const result = runGsdTools('init plan-phase 03', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.context_path, undefined);
    assert.strictEqual(output.research_path, undefined);
  });

  // ── phase_req_ids extraction (fix for #684) ──────────────────────────────

  test('init plan-phase extracts phase_req_ids from ROADMAP', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '03-api'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 3: API\n**Goal:** Build API\n**Requirements**: CP-01, CP-02, CP-03\n**Plans:** 0 plans\n`
    );

    const result = runGsdTools('init plan-phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_req_ids, 'CP-01, CP-02, CP-03');
  });

  test('init plan-phase strips brackets from phase_req_ids', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '03-api'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 3: API\n**Goal:** Build API\n**Requirements**: [CP-01, CP-02]\n**Plans:** 0 plans\n`
    );

    const result = runGsdTools('init plan-phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_req_ids, 'CP-01, CP-02');
  });

  test('init plan-phase returns null phase_req_ids when Requirements line is absent', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '03-api'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 3: API\n**Goal:** Build API\n**Plans:** 0 plans\n`
    );

    const result = runGsdTools('init plan-phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_req_ids, null);
  });

  test('init plan-phase returns null phase_req_ids when ROADMAP is absent', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '03-api'), { recursive: true });

    const result = runGsdTools('init plan-phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_req_ids, null);
  });

  test('init execute-phase extracts phase_req_ids from ROADMAP', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 3: API\n**Goal:** Build API\n**Requirements**: EX-01, EX-02\n**Plans:** 1 plans\n`
    );

    const result = runGsdTools('init execute-phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_req_ids, 'EX-01, EX-02');
  });

  test('init plan-phase returns null phase_req_ids when value is TBD', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '03-api'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'ROADMAP.md'),
      `# Roadmap\n\n### Phase 3: API\n**Goal:** Build API\n**Requirements**: TBD\n**Plans:** 0 plans\n`
    );

    const result = runGsdTools('init plan-phase 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_req_ids, null, 'TBD placeholder should return null');
  });

  test('init execute-phase returns null phase_req_ids when Requirements line is absent', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'ROADMAP.md'),
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
    fs.mkdirSync(path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '01-test'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'ROADMAP.md'), '# Roadmap\n## Phases\n### Phase 1: Test\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'STATE.md'), '# State\n');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('--milestone flag parsed in space form', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ concurrent: true }));

    const result = runGsdTools('--milestone v1.0 init plan-phase 1 --raw', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error || ''}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.milestone_scope, 'v1.0');
  });

  test('--milestone=value equals form parsed', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ concurrent: true }));

    const result = runGsdTools('--milestone=v1.0 init plan-phase 1 --raw', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error || ''}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.milestone_scope, 'v1.0');
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

  test('no --milestone flag auto-detects milestone_scope from layout', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), '{}');

    const result = runGsdTools('init plan-phase 1 --raw', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error || ''}`);
    const parsed = JSON.parse(result.output);
    // createTempProject creates milestone-scoped layout (v1.0), so auto-detection returns v1.0
    assert.strictEqual(parsed.milestone_scope, 'v1.0');
  });

  test('planning_root uses milestone-scoped path when --milestone provided', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ concurrent: true }));

    const result = runGsdTools('--milestone v1.0 init plan-phase 1 --raw', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error || ''}`);
    const parsed = JSON.parse(result.output);
    assert.ok(
      parsed.planning_root.endsWith(path.join('.planning', 'milestones', 'v1.0')),
      `planning_root should end with milestone path: ${parsed.planning_root}`
    );
  });

  test('planning_root uses milestone-scoped path when no --milestone provided (auto-detected)', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), '{}');

    const result = runGsdTools('init plan-phase 1 --raw', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error || ''}`);
    const parsed = JSON.parse(result.output);
    // createTempProject creates milestone-scoped layout, so auto-detection returns milestones/v1.0
    assert.ok(
      parsed.planning_root.includes('milestones/v1.0'),
      `planning_root should contain milestones/v1.0: ${parsed.planning_root}`
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
// cmdInitTodos (INIT-01)
// ─────────────────────────────────────────────────────────────────────────────

describe('cmdInitTodos', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('empty pending dir returns zero count', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'todos', 'pending'), { recursive: true });

    const result = runGsdTools('init todos', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.todo_count, 0);
    assert.deepStrictEqual(output.todos, []);
    assert.strictEqual(output.pending_dir_exists, true);
  });

  test('missing pending dir returns zero count', () => {
    const result = runGsdTools('init todos', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.todo_count, 0);
    assert.deepStrictEqual(output.todos, []);
    assert.strictEqual(output.pending_dir_exists, false);
  });

  test('multiple todos with fields are read correctly', () => {
    const pendingDir = path.join(tmpDir, '.planning', 'todos', 'pending');
    fs.mkdirSync(pendingDir, { recursive: true });

    fs.writeFileSync(path.join(pendingDir, 'task-1.md'), 'title: Fix bug\narea: backend\ncreated: 2026-02-25');
    fs.writeFileSync(path.join(pendingDir, 'task-2.md'), 'title: Add feature\narea: frontend\ncreated: 2026-02-24');
    fs.writeFileSync(path.join(pendingDir, 'task-3.md'), 'title: Write docs\narea: backend\ncreated: 2026-02-23');

    const result = runGsdTools('init todos', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.todo_count, 3);
    assert.strictEqual(output.todos.length, 3);

    const task1 = output.todos.find(t => t.file === 'task-1.md');
    assert.ok(task1, 'task-1.md should be in todos');
    assert.strictEqual(task1.title, 'Fix bug');
    assert.strictEqual(task1.area, 'backend');
    assert.strictEqual(task1.created, '2026-02-25');
    assert.strictEqual(task1.path, '.planning/todos/pending/task-1.md');
  });

  test('area filter returns only matching todos', () => {
    const pendingDir = path.join(tmpDir, '.planning', 'todos', 'pending');
    fs.mkdirSync(pendingDir, { recursive: true });

    fs.writeFileSync(path.join(pendingDir, 'task-1.md'), 'title: Fix bug\narea: backend\ncreated: 2026-02-25');
    fs.writeFileSync(path.join(pendingDir, 'task-2.md'), 'title: Add feature\narea: frontend\ncreated: 2026-02-24');
    fs.writeFileSync(path.join(pendingDir, 'task-3.md'), 'title: Write docs\narea: backend\ncreated: 2026-02-23');

    const result = runGsdTools('init todos backend', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.todo_count, 2);
    assert.strictEqual(output.area_filter, 'backend');
    for (const todo of output.todos) {
      assert.strictEqual(todo.area, 'backend');
    }
  });

  test('area filter miss returns zero count', () => {
    const pendingDir = path.join(tmpDir, '.planning', 'todos', 'pending');
    fs.mkdirSync(pendingDir, { recursive: true });

    fs.writeFileSync(path.join(pendingDir, 'task-1.md'), 'title: Fix bug\narea: backend\ncreated: 2026-02-25');

    const result = runGsdTools('init todos nonexistent', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.todo_count, 0);
    assert.strictEqual(output.area_filter, 'nonexistent');
  });

  test('malformed file uses defaults', () => {
    const pendingDir = path.join(tmpDir, '.planning', 'todos', 'pending');
    fs.mkdirSync(pendingDir, { recursive: true });

    fs.writeFileSync(path.join(pendingDir, 'broken.md'), 'some random content without fields');

    const result = runGsdTools('init todos', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.todo_count, 1);
    const todo = output.todos[0];
    assert.strictEqual(todo.title, 'Untitled');
    assert.strictEqual(todo.area, 'general');
    assert.strictEqual(todo.created, 'unknown');
  });

  test('non-md files are ignored', () => {
    const pendingDir = path.join(tmpDir, '.planning', 'todos', 'pending');
    fs.mkdirSync(pendingDir, { recursive: true });

    fs.writeFileSync(path.join(pendingDir, 'task.md'), 'title: Real task\narea: dev\ncreated: 2026-01-01');
    fs.writeFileSync(path.join(pendingDir, 'notes.txt'), 'title: Not a task\narea: dev\ncreated: 2026-01-01');

    const result = runGsdTools('init todos', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.todo_count, 1);
    assert.strictEqual(output.todos[0].file, 'task.md');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cmdInitMilestoneOp (INIT-02)
// ─────────────────────────────────────────────────────────────────────────────

describe('cmdInitMilestoneOp', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('no phase directories returns zero counts', () => {
    const result = runGsdTools('init milestone-op', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_count, 0);
    assert.strictEqual(output.completed_phases, 0);
    assert.strictEqual(output.all_phases_complete, false);
  });

  test('multiple phases with no summaries', () => {
    const phase1 = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '01-setup');
    const phase2 = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '02-api');
    fs.mkdirSync(phase1, { recursive: true });
    fs.mkdirSync(phase2, { recursive: true });
    fs.writeFileSync(path.join(phase1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phase2, '02-01-PLAN.md'), '# Plan');

    const result = runGsdTools('init milestone-op', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_count, 2);
    assert.strictEqual(output.completed_phases, 0);
    assert.strictEqual(output.all_phases_complete, false);
  });

  test('mix of complete and incomplete phases', () => {
    const phase1 = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '01-setup');
    const phase2 = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '02-api');
    fs.mkdirSync(phase1, { recursive: true });
    fs.mkdirSync(phase2, { recursive: true });
    fs.writeFileSync(path.join(phase1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phase1, '01-01-SUMMARY.md'), '# Summary');
    fs.writeFileSync(path.join(phase2, '02-01-PLAN.md'), '# Plan');

    const result = runGsdTools('init milestone-op', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_count, 2);
    assert.strictEqual(output.completed_phases, 1);
    assert.strictEqual(output.all_phases_complete, false);
  });

  test('all phases complete', () => {
    const phase1 = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '01-setup');
    fs.mkdirSync(phase1, { recursive: true });
    fs.writeFileSync(path.join(phase1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phase1, '01-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('init milestone-op', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_count, 1);
    assert.strictEqual(output.completed_phases, 1);
    assert.strictEqual(output.all_phases_complete, true);
  });

  test('archive directory scanning', () => {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'archive', 'v1.0'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, '.planning', 'archive', 'v0.9'), { recursive: true });

    const result = runGsdTools('init milestone-op', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.archive_count, 2);
    assert.strictEqual(output.archived_milestones.length, 2);
  });

  test('no archive directory returns empty', () => {
    const result = runGsdTools('init milestone-op', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.archive_count, 0);
    assert.deepStrictEqual(output.archived_milestones, []);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cmdInitPhaseOp fallback (INIT-04)
// ─────────────────────────────────────────────────────────────────────────────

describe('cmdInitPhaseOp fallback', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('normal path with existing directory', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '03-api');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '03-CONTEXT.md'), '# Context');
    fs.writeFileSync(path.join(phaseDir, '03-01-PLAN.md'), '# Plan');
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'ROADMAP.md'),
      '# Roadmap\n\n### Phase 3: API\n**Goal:** Build API\n**Plans:** 1 plans\n'
    );

    const result = runGsdTools('init phase-op 3', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_found, true);
    assert.ok(output.phase_dir.includes('03-api'), 'phase_dir should contain 03-api');
    assert.strictEqual(output.has_context, true);
    assert.strictEqual(output.has_plans, true);
  });

  test('fallback to ROADMAP when no directory exists', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'ROADMAP.md'),
      '# Roadmap\n\n### Phase 5: Widget Builder\n**Goal:** Build widgets\n**Plans:** TBD\n'
    );

    const result = runGsdTools('init phase-op 5', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_found, true);
    assert.strictEqual(output.phase_dir, null);
    assert.strictEqual(output.phase_slug, 'widget-builder');
    assert.strictEqual(output.has_research, false);
    assert.strictEqual(output.has_context, false);
    assert.strictEqual(output.has_plans, false);
  });

  test('neither directory nor roadmap entry returns not found', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'ROADMAP.md'),
      '# Roadmap\n\n### Phase 1: Setup\n**Goal:** Setup project\n**Plans:** TBD\n'
    );

    const result = runGsdTools('init phase-op 99', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_found, false);
    assert.strictEqual(output.phase_dir, null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cmdInitProgress (INIT-03)
// ─────────────────────────────────────────────────────────────────────────────

describe('cmdInitProgress', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('no phases returns empty state', () => {
    const result = runGsdTools('init progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_count, 0);
    assert.deepStrictEqual(output.phases, []);
    assert.strictEqual(output.current_phase, null);
    assert.strictEqual(output.next_phase, null);
    assert.strictEqual(output.has_work_in_progress, false);
  });

  test('multiple phases with mixed statuses', () => {
    // Phase 01: complete (has plan + summary)
    const phase1 = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '01-setup');
    fs.mkdirSync(phase1, { recursive: true });
    fs.writeFileSync(path.join(phase1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phase1, '01-01-SUMMARY.md'), '# Summary');

    // Phase 02: in_progress (has plan, no summary)
    const phase2 = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '02-api');
    fs.mkdirSync(phase2, { recursive: true });
    fs.writeFileSync(path.join(phase2, '02-01-PLAN.md'), '# Plan');

    // Phase 03: pending (no plan, no research)
    const phase3 = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '03-ui');
    fs.mkdirSync(phase3, { recursive: true });
    fs.writeFileSync(path.join(phase3, '03-CONTEXT.md'), '# Context');

    const result = runGsdTools('init progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.phase_count, 3);
    assert.strictEqual(output.completed_count, 1);
    assert.strictEqual(output.in_progress_count, 1);
    assert.strictEqual(output.has_work_in_progress, true);

    assert.strictEqual(output.current_phase.number, '02');
    assert.strictEqual(output.current_phase.status, 'in_progress');

    assert.strictEqual(output.next_phase.number, '03');
    assert.strictEqual(output.next_phase.status, 'pending');

    // Verify phase entries have expected structure
    const p1 = output.phases.find(p => p.number === '01');
    assert.strictEqual(p1.status, 'complete');
    assert.strictEqual(p1.plan_count, 1);
    assert.strictEqual(p1.summary_count, 1);
  });

  test('researched status detected correctly', () => {
    const phase1 = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '01-setup');
    fs.mkdirSync(phase1, { recursive: true });
    fs.writeFileSync(path.join(phase1, '01-RESEARCH.md'), '# Research');

    const result = runGsdTools('init progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const p1 = output.phases.find(p => p.number === '01');
    assert.strictEqual(p1.status, 'researched');
    assert.strictEqual(p1.has_research, true);
    assert.strictEqual(output.current_phase.number, '01');
  });

  test('all phases complete returns no current or next', () => {
    const phase1 = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '01-setup');
    fs.mkdirSync(phase1, { recursive: true });
    fs.writeFileSync(path.join(phase1, '01-01-PLAN.md'), '# Plan');
    fs.writeFileSync(path.join(phase1, '01-01-SUMMARY.md'), '# Summary');

    const result = runGsdTools('init progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.completed_count, 1);
    assert.strictEqual(output.current_phase, null);
    assert.strictEqual(output.next_phase, null);
  });

  test('paused_at detected from STATE.md', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'STATE.md'),
      '# Project State\n\n**Paused At:** Phase 2, Task 3 — implementing auth\n'
    );

    const result = runGsdTools('init progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.paused_at, 'paused_at should be set');
    assert.ok(output.paused_at.includes('Phase 2, Task 3'), 'paused_at should contain pause location');
  });

  test('no paused_at when STATE.md has no pause line', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'STATE.md'),
      '# Project State\n\nSome content without pause.\n'
    );

    const result = runGsdTools('init progress', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.paused_at, null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cmdInitQuick (INIT-05)
// ─────────────────────────────────────────────────────────────────────────────

describe('cmdInitQuick', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('with description generates slug and task_dir', () => {
    const result = runGsdTools('init quick "Fix login bug"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.slug, 'fix-login-bug');
    assert.strictEqual(output.next_num, 1);
    assert.strictEqual(output.task_dir, '.planning/quick/1-fix-login-bug');
    assert.strictEqual(output.description, 'Fix login bug');
  });

  test('without description returns null slug and task_dir', () => {
    const result = runGsdTools('init quick', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.slug, null);
    assert.strictEqual(output.task_dir, null);
    assert.strictEqual(output.description, null);
    assert.strictEqual(output.next_num, 1);
  });

  test('next number increments from existing entries', () => {
    const quickDir = path.join(tmpDir, '.planning', 'quick');
    fs.mkdirSync(path.join(quickDir, '1-old-task'), { recursive: true });
    fs.mkdirSync(path.join(quickDir, '3-another-task'), { recursive: true });

    const result = runGsdTools('init quick "New task"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.next_num, 4);
  });

  test('long description truncates slug to 40 chars', () => {
    const result = runGsdTools('init quick "This is a very long description that should get truncated to forty characters maximum"', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.slug.length <= 40, `Slug should be <= 40 chars, got ${output.slug.length}: "${output.slug}"`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cmdInitMapCodebase (INIT-05)
// ─────────────────────────────────────────────────────────────────────────────

describe('cmdInitMapCodebase', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('no codebase dir returns empty', () => {
    const result = runGsdTools('init map-codebase', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.has_maps, false);
    assert.deepStrictEqual(output.existing_maps, []);
    assert.strictEqual(output.codebase_dir_exists, false);
  });

  test('with existing maps lists md files only', () => {
    const codebaseDir = path.join(tmpDir, '.planning', 'codebase');
    fs.mkdirSync(codebaseDir, { recursive: true });
    fs.writeFileSync(path.join(codebaseDir, 'STACK.md'), '# Stack');
    fs.writeFileSync(path.join(codebaseDir, 'ARCHITECTURE.md'), '# Architecture');
    fs.writeFileSync(path.join(codebaseDir, 'notes.txt'), 'not a markdown file');

    const result = runGsdTools('init map-codebase', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.has_maps, true);
    assert.strictEqual(output.existing_maps.length, 2);
    assert.ok(output.existing_maps.includes('STACK.md'), 'Should include STACK.md');
    assert.ok(output.existing_maps.includes('ARCHITECTURE.md'), 'Should include ARCHITECTURE.md');
  });

  test('empty codebase dir returns no maps', () => {
    const codebaseDir = path.join(tmpDir, '.planning', 'codebase');
    fs.mkdirSync(codebaseDir, { recursive: true });

    const result = runGsdTools('init map-codebase', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.has_maps, false);
    assert.deepStrictEqual(output.existing_maps, []);
    assert.strictEqual(output.codebase_dir_exists, true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cmdInitNewProject (INIT-06)
// ─────────────────────────────────────────────────────────────────────────────

describe('cmdInitNewProject', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('greenfield project with no code', () => {
    const result = runGsdTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.has_existing_code, false);
    assert.strictEqual(output.has_package_file, false);
    assert.strictEqual(output.is_brownfield, false);
    assert.strictEqual(output.needs_codebase_map, false);
  });

  test('brownfield with package.json detected', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');

    const result = runGsdTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.has_package_file, true);
    assert.strictEqual(output.is_brownfield, true);
    assert.strictEqual(output.needs_codebase_map, true);
  });

  test('brownfield with codebase map does not need map', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');
    fs.mkdirSync(path.join(tmpDir, '.planning', 'codebase'), { recursive: true });

    const result = runGsdTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.is_brownfield, true);
    assert.strictEqual(output.needs_codebase_map, false);
  });

  test('planning_exists flag is correct', () => {
    const result = runGsdTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.planning_exists, true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cmdInitNewMilestone (INIT-06)
// ─────────────────────────────────────────────────────────────────────────────

describe('cmdInitNewMilestone', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns expected fields', () => {
    const result = runGsdTools('init new-milestone', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok('current_milestone' in output, 'Should have current_milestone');
    assert.ok('current_milestone_name' in output, 'Should have current_milestone_name');
    assert.ok('researcher_model' in output, 'Should have researcher_model');
    assert.ok('synthesizer_model' in output, 'Should have synthesizer_model');
    assert.ok('roadmapper_model' in output, 'Should have roadmapper_model');
    assert.ok('commit_docs' in output, 'Should have commit_docs');
    assert.strictEqual(output.project_path, '.planning/PROJECT.md');
    // new-milestone uses project-root paths (not milestone-scoped) — it reads from the root level
    assert.strictEqual(output.roadmap_path, '.planning/ROADMAP.md');
    assert.strictEqual(output.state_path, '.planning/STATE.md');
  });

  test('file existence flags reflect actual state', () => {
    // new-milestone checks root-level files (.planning/STATE.md, .planning/ROADMAP.md)
    // createTempProject creates milestone-scoped layout, NOT root-level files
    const result1 = runGsdTools('init new-milestone', tmpDir);
    assert.ok(result1.success, `Command failed: ${result1.error}`);

    const output1 = JSON.parse(result1.output);
    assert.strictEqual(output1.state_exists, false);
    assert.strictEqual(output1.roadmap_exists, false);
    assert.strictEqual(output1.project_exists, false);

    // Create root-level files (what new-milestone checks for)
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# Project');

    const result2 = runGsdTools('init new-milestone', tmpDir);
    assert.ok(result2.success, `Command failed: ${result2.error}`);

    const output2 = JSON.parse(result2.output);
    assert.strictEqual(output2.state_exists, true);
    assert.strictEqual(output2.roadmap_exists, true);
    assert.strictEqual(output2.project_exists, true);
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

// ─────────────────────────────────────────────────────────────────────────────
// getHighestPhaseNumber (PHASE-NUM-01)
// ─────────────────────────────────────────────────────────────────────────────

describe('getHighestPhaseNumber (PHASE-NUM-01)', () => {
  const { getHighestPhaseNumber } = require('../get-shit-done/bin/lib/init.cjs');
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns 0 when no milestones exist (empty .planning/milestones/)', () => {
    // createTempProject creates v1.0 with empty phases dir — no phase dirs
    const result = getHighestPhaseNumber(tmpDir);
    assert.strictEqual(result, 0);
  });

  test('returns 4 when single milestone has phases 01-04', () => {
    const phasesDir = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases');
    fs.mkdirSync(path.join(phasesDir, '01-setup'), { recursive: true });
    fs.mkdirSync(path.join(phasesDir, '02-api'), { recursive: true });
    fs.mkdirSync(path.join(phasesDir, '03-ui'), { recursive: true });
    fs.mkdirSync(path.join(phasesDir, '04-deploy'), { recursive: true });

    const result = getHighestPhaseNumber(tmpDir);
    assert.strictEqual(result, 4);
  });

  test('returns 14 when multiple milestones exist (v1.0 phases 01-04, v2.0 phases 08-14)', () => {
    // v1.0 phases 01-04
    const v1Phases = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases');
    fs.mkdirSync(path.join(v1Phases, '01-setup'), { recursive: true });
    fs.mkdirSync(path.join(v1Phases, '04-deploy'), { recursive: true });

    // v2.0 with phases 08-14
    const v2Phases = path.join(tmpDir, '.planning', 'milestones', 'v2.0', 'phases');
    fs.mkdirSync(path.join(v2Phases, '08-data'), { recursive: true });
    fs.mkdirSync(path.join(v2Phases, '14-integration'), { recursive: true });

    const result = getHighestPhaseNumber(tmpDir);
    assert.strictEqual(result, 14);
  });

  test('handles decimal phases correctly — "3.1-foo" has integer base 3, "14-bar" has integer 14', () => {
    const phasesDir = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases');
    fs.mkdirSync(path.join(phasesDir, '3.1-integration-fixes'), { recursive: true });
    fs.mkdirSync(path.join(phasesDir, '14-final-wiring'), { recursive: true });

    const result = getHighestPhaseNumber(tmpDir);
    assert.strictEqual(result, 14);
  });

  test('parses root ROADMAP.md "Phases X-Y" ranges and uses the Y values', () => {
    // Write root ROADMAP.md with phase range indicating archived work
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Root Roadmap\n\n## Milestones\n\n- v1.0 MVP — Phases 1-4\n- v2.0 Big Release — Phases 5-14\n'
    );

    const result = getHighestPhaseNumber(tmpDir);
    assert.strictEqual(result, 14);
  });

  test('cmdInitNewMilestone returns next_starting_phase field (highest + 1)', () => {
    // Create v1.0 phases up to 04
    const phasesDir = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases');
    fs.mkdirSync(path.join(phasesDir, '01-setup'), { recursive: true });
    fs.mkdirSync(path.join(phasesDir, '04-deploy'), { recursive: true });

    const result = runGsdTools('init new-milestone', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok('next_starting_phase' in output, 'Should have next_starting_phase');
    assert.ok('highest_phase' in output, 'Should have highest_phase');
    assert.strictEqual(output.highest_phase, 4);
    assert.strictEqual(output.next_starting_phase, 5);
  });
});
