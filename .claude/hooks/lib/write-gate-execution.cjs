'use strict';
// Library for persisting quality gate execution outcomes to .planning/observations/gate-executions.jsonl.
// Called by the gsd-executor after summary creation in standard or strict mode.
// Fast mode never calls this — fast mode produces no gate-execution entries.
//
// Uses CommonJS (require/module.exports) so it can be require()-d by hooks and scripts.

const fs = require('fs');
const path = require('path');

// Valid gate names for the quality sentinel gates
const VALID_GATES = new Set([
  'codebase_scan',
  'context7_lookup',
  'test_baseline',
  'test_gate',
  'diff_review',
  'eslint_gate',
]);

// Valid gate outcomes
const VALID_OUTCOMES = new Set([
  'passed',
  'warned',
  'skipped',
  'blocked',
]);

/**
 * Reads adaptive_learning.observation config from .planning/config.json.
 * Returns defaults on any error.
 *
 * @param {string} cwd - Project root directory
 * @returns {{ retentionDays: number, maxEntries: number }}
 */
function getObservationConfig(cwd) {
  const defaults = { retentionDays: 90, maxEntries: 5000 };
  try {
    const configPath = path.join(cwd, '.planning', 'config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);
    const obs = (config.adaptive_learning || {}).observation || {};
    return {
      retentionDays: typeof obs.retention_days === 'number' ? obs.retention_days : defaults.retentionDays,
      maxEntries: defaults.maxEntries, // Gate events use fixed 5000 rotation threshold
    };
  } catch (e) {
    return defaults;
  }
}

/**
 * Deletes archive files in observationsDir older than retentionDays.
 * Silent on all errors.
 *
 * @param {string} observationsDir
 * @param {number} retentionDays
 */
function cleanupArchives(observationsDir, retentionDays) {
  try {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(observationsDir);
    for (const file of files) {
      if (!file.startsWith('gate-executions-') || !file.endsWith('.jsonl')) continue;
      const filePath = path.join(observationsDir, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        // Silent on individual file errors
      }
    }
  } catch (e) {
    // Silent on directory read errors
  }
}

/**
 * Renames gate-executions.jsonl to a dated archive.
 * If the dated name already exists, appends -1, -2, etc. until a free name is found.
 * Calls cleanupArchives after renaming.
 *
 * @param {string} filePath - path to gate-executions.jsonl
 * @param {string} observationsDir
 * @param {number} retentionDays
 */
function rotateFile(filePath, observationsDir, retentionDays) {
  try {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    let archiveName = `gate-executions-${dateStr}.jsonl`;
    let archivePath = path.join(observationsDir, archiveName);

    // Find a free archive name
    let seq = 1;
    while (fs.existsSync(archivePath)) {
      archiveName = `gate-executions-${dateStr}-${seq}.jsonl`;
      archivePath = path.join(observationsDir, archiveName);
      seq++;
    }

    fs.renameSync(filePath, archivePath);
    cleanupArchives(observationsDir, retentionDays);
  } catch (e) {
    // Silent on rotation errors
  }
}

/**
 * Validates a gate execution entry has all required fields with non-empty values,
 * gate is one of the 5 valid gate names, outcome is one of the 4 valid outcomes,
 * and quality_level is never 'fast'.
 *
 * Required fields: gate, task, outcome, quality_level, phase, plan, timestamp.
 * detail is optional.
 *
 * @param {object} entry
 * @returns {boolean}
 */
function validateEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;

  const requiredFields = [
    'gate',
    'task',
    'outcome',
    'quality_level',
    'phase',
    'plan',
    'timestamp',
  ];

  for (const field of requiredFields) {
    const val = entry[field];
    if (val === undefined || val === null || val === '') return false;
    // task may be 0 (sentinel entry before first task) — treat 0 as valid
    if (field === 'task' && (typeof val !== 'number' || !Number.isInteger(val) || val < 0)) return false;
  }

  // Validate gate is one of the 5 valid gate names
  if (!VALID_GATES.has(entry.gate)) return false;

  // Validate outcome is one of the 4 valid outcomes
  if (!VALID_OUTCOMES.has(entry.outcome)) return false;

  // quality_level must not be 'fast' — fast mode never calls this library
  if (entry.quality_level === 'fast') return false;

  // quality_level must be standard or strict
  if (entry.quality_level !== 'standard' && entry.quality_level !== 'strict') return false;

  return true;
}

/**
 * Writes a gate execution entry to .planning/observations/gate-executions.jsonl.
 * Handles directory creation, rotation, and retention cleanup.
 * Never throws -- all errors are caught and returned as { written: false, reason, error }.
 *
 * @param {object} entry - Gate execution entry
 * @param {{ cwd?: string }} [options]
 * @returns {{ written: boolean, reason?: string, error?: string }}
 */
function writeGateExecution(entry, options) {
  try {
    const cwd = (options && options.cwd) ? options.cwd : process.cwd();
    const { retentionDays, maxEntries } = getObservationConfig(cwd);

    if (!validateEntry(entry)) {
      return { written: false, reason: 'invalid_entry' };
    }

    const observationsDir = path.join(cwd, '.planning', 'observations');
    fs.mkdirSync(observationsDir, { recursive: true });

    const filePath = path.join(observationsDir, 'gate-executions.jsonl');

    // Check line count; rotate if at or above maxEntries (5000)
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lineCount = content.split('\n').filter(l => l.trim() !== '').length;
      if (lineCount >= maxEntries) {
        rotateFile(filePath, observationsDir, retentionDays);
      }
    }

    fs.appendFileSync(filePath, JSON.stringify(entry) + '\n');

    return { written: true };
  } catch (e) {
    return { written: false, reason: 'error', error: e.message };
  }
}

module.exports = { writeGateExecution };

// CLI invocation: node write-gate-execution.cjs '{"gate":"codebase_scan","task":1,...}' '<cwd>'
if (require.main === module) {
  const arg = process.argv[2] || '';
  let entry = {};
  try { entry = JSON.parse(arg); } catch (e) {
    process.stderr.write('write-gate-execution: invalid JSON argument\n');
    process.exit(0); // silent failure even in CLI mode
  }
  const cwd = process.argv[3] || process.cwd();
  const result = writeGateExecution(entry, { cwd });
  if (process.env.DEBUG_GATE_EXECUTION) {
    process.stdout.write(JSON.stringify(result) + '\n');
  }
  process.exit(0);
}
