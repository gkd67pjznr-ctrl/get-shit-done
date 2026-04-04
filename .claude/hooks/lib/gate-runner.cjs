'use strict';
// Gate runner library: detects gate triggers from hook input and returns gate evaluation results.
//
// Zero external dependencies — built-in Node.js only plus require('./write-gate-execution.cjs').
// Called by gsd-run-gates.cjs (PostToolUse hook). Never calls writeGateExecution directly.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/**
 * Reads subdirectory names from .claude/skills/ as the active skill list.
 * Returns [] on any error or if the directory does not exist.
 *
 * @param {string} cwd - Project root directory
 * @returns {string[]}
 */
function readSkillNames(cwd) {
  try {
    const skillsDir = path.join(cwd, '.claude', 'skills');
    return fs.readdirSync(skillsDir).filter(name => {
      try {
        return fs.statSync(path.join(skillsDir, name)).isDirectory();
      } catch (e) {
        return false;
      }
    });
  } catch (e) {
    return [];
  }
}

/**
 * Runs ESLint on a single file path using the locally-installed eslint binary.
 * Returns { exitCode, errorCount, output, unavailable }.
 * unavailable=true means ESLint was not found — caller should log degradation.
 *
 * @param {string} filePath - Absolute path to the file
 * @param {string} cwd - Project root directory
 * @returns {{ exitCode: number, errorCount: number, output: string, unavailable: boolean }}
 */
function runEslint(filePath, cwd) {
  try {
    const result = spawnSync(
      'npx',
      ['--no-install', 'eslint', '--format', 'json', '--no-eslintrc', '--rule', '{}', filePath],
      { cwd, encoding: 'utf-8', timeout: 10000 }
    );

    // ENOENT or spawn error means eslint unavailable
    if (result.error) {
      return { exitCode: -1, errorCount: 0, output: '', unavailable: true };
    }

    // Try to parse JSON output to get error count
    let errorCount = 0;
    try {
      const parsed = JSON.parse(result.stdout || '[]');
      errorCount = parsed.reduce((sum, f) => sum + (f.errorCount || 0), 0);
    } catch (e) {
      // Non-JSON output — use exit code as signal
      errorCount = result.status !== 0 ? 1 : 0;
    }

    return {
      exitCode: result.status || 0,
      errorCount,
      output: (result.stdout || '').slice(0, 500), // cap stored output
      unavailable: false,
    };
  } catch (e) {
    return { exitCode: -1, errorCount: 0, output: '', unavailable: true };
  }
}

/**
 * Reads quality.level from .planning/config.json.
 * Returns 'fast' on any error.
 *
 * @param {string} cwd - Project root directory
 * @returns {'fast'|'standard'|'strict'}
 */
function getQualityLevel(cwd) {
  try {
    const configPath = path.join(cwd, '.planning', 'config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);
    const level = (config.quality || {}).level;
    if (level === 'fast' || level === 'standard' || level === 'strict') return level;
    return 'fast';
  } catch (e) {
    return 'fast';
  }
}

/**
 * Reads phase and plan from the active STATE.md (milestone-scoped if available).
 * Uses same logic as gsd-correction-capture.js.
 * Returns { phase: 0, plan: '0' } on error.
 *
 * @param {string} cwd - Project root directory
 * @returns {{ phase: number, plan: string }}
 */
function getPhaseAndPlan(cwd) {
  try {
    const possiblePaths = [];

    // Look for milestone dirs under .planning/milestones/
    const milestonesDir = path.join(cwd, '.planning', 'milestones');
    try {
      const entries = fs.readdirSync(milestonesDir);
      const versionDirs = entries.filter(e => /^v\d/.test(e)).sort().reverse();
      for (const dir of versionDirs) {
        possiblePaths.push(path.join(milestonesDir, dir, 'STATE.md'));
      }
    } catch (e) {
      // No milestones dir
    }

    possiblePaths.push(path.join(cwd, '.planning', 'STATE.md'));

    for (const statePath of possiblePaths) {
      try {
        const content = fs.readFileSync(statePath, 'utf-8');
        const lines = content.split('\n');

        let phase = 0;
        let plan = '0';

        for (const line of lines) {
          const trimmed = line.trim();

          if (trimmed.startsWith('Phase:')) {
            const rest = trimmed.slice('Phase:'.length).trim();
            const match = rest.match(/^(\d+)/);
            if (match) {
              phase = parseInt(match[1], 10);
            }
          }

          if (trimmed.startsWith('Plan:')) {
            const rest = trimmed.slice('Plan:'.length).trim();
            // Parse "N of M in current phase" or just "N"
            const match = rest.match(/^(\d+)/);
            if (match) {
              plan = match[1];
            }
          }
        }

        if (phase !== 0 || plan !== '0') {
          return { phase, plan };
        }
      } catch (e) {
        // Try next path
      }
    }

    return { phase: 0, plan: '0' };
  } catch (e) {
    return { phase: 0, plan: '0' };
  }
}

/**
 * Detects which gate (if any) is triggered by a tool call.
 * Pure function — no I/O.
 *
 * @param {string} toolName - Tool name from hook input (e.g., 'Bash', 'Write')
 * @param {object} toolInput - Tool input from hook input
 * @returns {null | { gate: string, rawOutcome: string, detail?: string }}
 */
function detectGate(toolName, toolInput) {
  if (toolName === 'Bash') {
    const command = (toolInput && toolInput.command) ? String(toolInput.command) : '';
    if (/npm\s+test|vitest|node\s+--test|npx\s+vitest/.test(command)) {
      return {
        gate: 'test_gate',
        rawOutcome: 'check_response',
        detail: 'test run detected',
      };
    }
    return null;
  }

  if (toolName === 'Write') {
    const filePath = (toolInput && (toolInput.file_path || toolInput.path))
      ? String(toolInput.file_path || toolInput.path)
      : '';
    if (/\.(ts|tsx|js|cjs|mjs)$/.test(filePath)) {
      return {
        gate: 'eslint_gate',
        rawOutcome: 'check_response',
        detail: 'code file written',
        filePath,
      };
    }
    return null;
  }

  return null;
}

/**
 * Maps a raw gate outcome to a final outcome based on quality level.
 *
 * @param {string} rawOutcome - 'passed', 'blocked', 'warned', or 'skipped'
 * @param {'fast'|'standard'|'strict'} qualityLevel
 * @returns {'passed'|'warned'|'blocked'|'skipped'}
 */
function applyQualityLevel(rawOutcome, qualityLevel) {
  if (qualityLevel === 'fast') return 'skipped';

  if (qualityLevel === 'standard') {
    if (rawOutcome === 'blocked') return 'warned';
    return rawOutcome;
  }

  if (qualityLevel === 'strict') {
    return rawOutcome;
  }

  // Default to skipped for unknown levels
  return 'skipped';
}

/**
 * Main function called by the hook. Evaluates a gate for the given tool call.
 *
 * @param {string} toolName
 * @param {object} toolInput
 * @param {string|object} toolResponse
 * @param {{ cwd: string, sessionId: string, taskIndex?: number }} options
 * @returns {{ evaluated: boolean, reason?: string, gate?: string, outcome?: string, entry?: object, error?: string }}
 */
function evaluateGate(toolName, toolInput, toolResponse, options) {
  try {
    const cwd = (options && options.cwd) ? options.cwd : process.cwd();
    const sessionId = (options && options.sessionId) ? options.sessionId : 'unknown';
    const taskIndex = (options && typeof options.taskIndex === 'number') ? options.taskIndex : 0;

    const detection = detectGate(toolName, toolInput);
    if (!detection) {
      return { evaluated: false, reason: 'no_gate_triggered' };
    }

    const qualityLevel = getQualityLevel(cwd);
    if (qualityLevel === 'fast') {
      return { evaluated: false, reason: 'fast_mode_skip' };
    }

    const phaseAndPlan = getPhaseAndPlan(cwd);

    let rawOutcome;

    if (detection.gate === 'test_gate') {
      // Parse toolResponse to determine if tests passed or failed
      const responseStr = typeof toolResponse === 'string'
        ? toolResponse
        : JSON.stringify(toolResponse || '');

      const failurePatterns = [
        /[1-9]\d*\s+failing/i,    // "5 failing" but not "0 failing"
        / fail[^i]/i,
        /FAIL\b/,
        /Error:/,
        /exit code [1-9]/,
      ];

      const hasFailed = failurePatterns.some(p => p.test(responseStr));
      rawOutcome = hasFailed ? 'blocked' : 'passed';
    } else if (detection.gate === 'eslint_gate') {
      const eslintFilePath = detection.filePath || '';
      if (!eslintFilePath) {
        rawOutcome = 'passed'; // no path to lint
      } else {
        const eslintResult = runEslint(eslintFilePath, cwd);
        if (eslintResult.unavailable) {
          rawOutcome = 'warned'; // degradation: ESLint not installed
          detection.detail = 'eslint_unavailable';
        } else if (eslintResult.errorCount > 0) {
          rawOutcome = 'blocked';
          detection.detail = `eslint_errors:${eslintResult.errorCount}`;
        } else {
          rawOutcome = 'passed';
        }
      }
    } else {
      rawOutcome = detection.rawOutcome || 'passed';
    }

    const outcome = applyQualityLevel(rawOutcome, qualityLevel);

    const entry = {
      gate: detection.gate,
      task: taskIndex,
      outcome,
      quality_level: qualityLevel,
      phase: phaseAndPlan.phase,
      plan: phaseAndPlan.plan,
      timestamp: new Date().toISOString(),
      detail: detection.detail || '',
      skills_active: readSkillNames(cwd),
    };

    return { evaluated: true, gate: detection.gate, outcome, entry };
  } catch (e) {
    return { evaluated: false, reason: 'error', error: e.message };
  }
}

module.exports = {
  getQualityLevel,
  getPhaseAndPlan,
  detectGate,
  applyQualityLevel,
  evaluateGate,
};
