/**
 * GSD Tools Tests - CLI Help Text Completeness
 *
 * CLI-01: gsd-tools with no args shows all top-level commands including milestone, debt
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { runGsdToolsFull } = require('./helpers.cjs');

// ─────────────────────────────────────────────────────────────────────────────
// CLI-01: CLI help text lists all major commands
// ─────────────────────────────────────────────────────────────────────────────

describe('CLI-01: gsd-tools no-args help text lists all commands', () => {
  test('help output includes milestone command', () => {
    const result = runGsdToolsFull([], process.cwd());
    // gsd-tools with no args exits non-zero with help text on stderr
    assert.ok(!result.success, 'Should exit with error when no command given');
    const output = result.stderr || result.output;
    assert.ok(output.includes('milestone'), 'Help text should include "milestone"');
  });

  test('help output includes debt command', () => {
    const result = runGsdToolsFull([], process.cwd());
    const output = result.stderr || result.output;
    assert.ok(output.includes('debt'), 'Help text should include "debt"');
  });

  test('help output includes --milestone flag in usage line', () => {
    const result = runGsdToolsFull([], process.cwd());
    const output = result.stderr || result.output;
    assert.ok(output.includes('--milestone'), 'Usage line should include --milestone flag');
  });

  test('help output includes categorized command groups', () => {
    const result = runGsdToolsFull([], process.cwd());
    const output = result.stderr || result.output;
    const expectedGroups = ['State:', 'Phase:', 'Roadmap:', 'Milestone:', 'Debt:', 'Verify:', 'Config:', 'Init:'];
    for (const group of expectedGroups) {
      assert.ok(output.includes(group), `Help text should include category "${group}"`);
    }
  });
});
