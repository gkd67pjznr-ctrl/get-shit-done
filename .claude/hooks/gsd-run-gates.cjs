'use strict';
// PostToolUse hook: evaluates quality gates on Bash test runs and Write code file operations.
//
// Reads stdin JSON with the PostToolUse hook payload:
//   { session_id, cwd, tool_name, tool_input, tool_response }
// Always exits 0 — hook must never block Claude execution.

const fs = require('fs');
const path = require('path');

try {
  // ─── Read stdin ─────────────────────────────────────────────────────────────

  let input = '';
  try { input = fs.readFileSync('/dev/stdin', 'utf-8'); } catch (e) {}

  let parsed = {};
  try { parsed = JSON.parse(input); } catch (e) {
    // Silent failure on parse error
    process.exit(0);
  }

  const sessionId = parsed.session_id || 'unknown';
  const cwd = parsed.cwd || process.cwd();
  const toolName = parsed.tool_name || '';
  const toolInput = parsed.tool_input || {};
  const toolResponse = parsed.tool_response || '';

  // ─── Load gate-runner from project hooks lib ─────────────────────────────

  let gateRunner;
  try {
    gateRunner = require(path.join(cwd, '.claude/hooks/lib/gate-runner.cjs'));
  } catch (e) {
    // File not found or require error — exit silently
    process.exit(0);
  }

  const { evaluateGate } = gateRunner;

  // ─── Evaluate gate ───────────────────────────────────────────────────────

  const result = evaluateGate(toolName, toolInput, toolResponse, {
    cwd,
    sessionId,
    taskIndex: 0,
  });

  if (!result.evaluated) {
    process.exit(0);
  }

  // ─── Write gate execution entry ──────────────────────────────────────────

  let writeGateExecution;
  try {
    const writeLib = require(path.join(cwd, '.claude/hooks/lib/write-gate-execution.cjs'));
    writeGateExecution = writeLib.writeGateExecution;
  } catch (e) {
    // write-gate-execution.cjs unavailable — exit silently
    process.exit(0);
  }

  const writeResult = writeGateExecution(result.entry, { cwd });

  // Debug output if DEBUG_GATE_RUNNER env var is set
  if (process.env.DEBUG_GATE_RUNNER) {
    process.stdout.write(
      JSON.stringify({ gate: result.gate, outcome: result.outcome, written: writeResult.written }) + '\n'
    );
  }
} catch (e) {
  // Top-level catch — hook must always exit 0
}

process.exit(0);
