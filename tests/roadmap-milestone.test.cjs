/**
 * GSD Tools Tests - Roadmap Update Plan Progress with --milestone
 *
 * FIX-02: roadmap update-plan-progress accepts and uses --milestone flag
 * to read/write the milestone-scoped ROADMAP.md instead of the root one.
 */

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createConcurrentProject, runGsdToolsFull, cleanup } = require('./helpers.cjs');

// ─────────────────────────────────────────────────────────────────────────────
// FIX-02: roadmap update-plan-progress with --milestone updates correct ROADMAP
// ─────────────────────────────────────────────────────────────────────────────

describe('FIX-02: roadmap update-plan-progress with --milestone flag', () => {
  let tmpDir;

  before(() => {
    tmpDir = createConcurrentProject('v3.0');

    const milestoneDir = path.join(tmpDir, '.planning', 'milestones', 'v3.0');

    // Create a phase directory in the milestone workspace with a PLAN and SUMMARY
    const phaseDir = path.join(milestoneDir, 'phases', '01-setup');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(
      path.join(phaseDir, '01-01-PLAN.md'),
      '---\nphase: 01\nplan: 01\n---\n# Plan 01\n',
      'utf-8'
    );
    fs.writeFileSync(
      path.join(phaseDir, '01-01-SUMMARY.md'),
      '---\none-liner: Setup complete\n---\n# Summary\n',
      'utf-8'
    );

    // Write a milestone ROADMAP.md with a Phase 1 entry that has a progress table
    fs.writeFileSync(
      path.join(milestoneDir, 'ROADMAP.md'),
      [
        '# Roadmap — Milestone v3.0',
        '',
        '## Phase 1: Setup',
        '',
        '**Goal:** Set up the project',
        '',
        '**Plans:** 0/1 plans complete',
        '',
        '| Phase | Plans | Status | Date |',
        '|-------|-------|--------|------|',
        '| 1. Setup | 0/1 | In Progress | - |',
        '',
      ].join('\n'),
      'utf-8'
    );

    // Also write a ROOT ROADMAP.md that should NOT be modified
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Root Roadmap\n\nThis file should not be modified by milestone-scoped commands.\n',
      'utf-8'
    );
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('roadmap update-plan-progress with --milestone updates milestone ROADMAP', () => {
    const result = runGsdToolsFull(
      ['--milestone', 'v3.0', 'roadmap', 'update-plan-progress', '01'],
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.stderr}`);

    // Without --raw, output is JSON
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.updated, true, 'Should report update occurred');
    assert.strictEqual(parsed.status, 'Complete', 'Should report phase as Complete');
    assert.strictEqual(parsed.summary_count, 1, 'Should find 1 summary');
    assert.strictEqual(parsed.plan_count, 1, 'Should find 1 plan');
  });

  test('roadmap update-plan-progress with --milestone does not modify root ROADMAP', () => {
    const rootRoadmap = fs.readFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      'utf-8'
    );
    assert.ok(
      rootRoadmap.includes('This file should not be modified'),
      'Root ROADMAP.md should remain unchanged'
    );
  });
});
