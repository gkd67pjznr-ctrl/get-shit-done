/**
 * GSD Tools Tests - Milestone Complete with Milestone-Scoped Layout
 * FIX-01: cmdMilestoneComplete resolves phasesDir from planningRoot when milestoneScope is provided
 */

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createConcurrentProject, runGsdToolsFull, cleanup } = require('./helpers.cjs');

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: FIX-01: milestone complete with --milestone resolves phasesDir correctly
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX-01: milestone complete with --milestone resolves phasesDir correctly', () => {
  let tmpDir;

  before(() => {
    tmpDir = createConcurrentProject('v2.0');

    // Create a phase directory in the milestone workspace (NOT at root .planning/phases)
    const phaseDir = path.join(tmpDir, '.planning', 'milestones', 'v2.0', 'phases', '01-test-phase');
    fs.mkdirSync(phaseDir, { recursive: true });

    // Write a PLAN.md and SUMMARY.md in the milestone phase dir
    fs.writeFileSync(
      path.join(phaseDir, '01-01-PLAN.md'),
      '---\nphase: 01\nplan: 01\n---\n# Plan\n',
      'utf-8'
    );
    fs.writeFileSync(
      path.join(phaseDir, '01-01-SUMMARY.md'),
      '---\none-liner: Test milestone complete fix\n---\n# Summary\n',
      'utf-8'
    );

    // Write a ROADMAP.md into the milestone workspace with a Phase 1 entry
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v2.0', 'ROADMAP.md'),
      [
        '# Roadmap — Milestone v2.0',
        '',
        '- [ ] Phase 1: Test Phase',
        '',
        '| Phase | Status | Date |',
        '|-------|--------|------|',
        '| 1. Test Phase | Planned | - |',
        '',
      ].join('\n'),
      'utf-8'
    );

    // Write STATE.md into the milestone workspace
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v2.0', 'STATE.md'),
      '# State — Milestone v2.0\n\n**Status:** In Progress\n',
      'utf-8'
    );

    // Create conflict.json for the workspace
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'milestones', 'v2.0', 'conflict.json'),
      JSON.stringify({ version: 'v2.0', created_at: '2026-02-27', status: 'active', files_touched: [] }, null, 2),
      'utf-8'
    );

    // Do NOT create phases at .planning/phases/ — milestone-scoped layout should find them in the workspace
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('milestone complete reads phases from milestone workspace', () => {
    const result = runGsdToolsFull(
      ['--milestone', 'v2.0', 'milestone', 'complete', 'v2.0', '--name', 'Test Milestone', '--raw'],
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.stderr}`);
    const parsed = JSON.parse(result.output);
    assert.ok(parsed.phases >= 1, `Expected at least 1 phase, got ${parsed.phases}`);
    assert.ok(parsed.plans >= 1, `Expected at least 1 plan, got ${parsed.plans}`);
  });

  test('milestone complete creates MILESTONES.md entry', () => {
    const milestonesPath = path.join(tmpDir, '.planning', 'MILESTONES.md');
    assert.ok(fs.existsSync(milestonesPath), 'MILESTONES.md should exist after milestone complete');
    const content = fs.readFileSync(milestonesPath, 'utf-8');
    assert.ok(content.includes('v2.0'), 'MILESTONES.md should contain v2.0 entry');
  });
});
